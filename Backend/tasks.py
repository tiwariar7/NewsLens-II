import os
import hashlib
from datetime import datetime, timedelta
import logging
import spacy
from textblob import TextBlob
from sqlalchemy import func, or_
import google.generativeai as genai
from rq import get_current_job
from modules.sse import update_task_progress

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Lazy load spaCy to avoid loading overhead during worker initialization
_nlp = None
def get_nlp():
    global _nlp
    if _nlp is None:
        logger.info("Loading spaCy en_core_web_sm model...")
        _nlp = spacy.load("en_core_web_sm")
    return _nlp

# Configure Gemini for Embeddings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def generate_embedding(text):
    """
    Generates a 768-dimension vector embedding using Gemini gemini-embedding-001.
    """
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not configured. Skipping embedding generation.")
        return None
    try:
        response = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text,
            task_type="retrieval_document",
            output_dimensionality=768
        )
        return response.get('embedding')
    except Exception as e:
        logger.error(f"Error generating embedding via Gemini: {e}")
        return None

def calculate_sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def ingest_articles_task(user_email, query=None, category=None, country="us", language="en"):
    """
    Background job to ingest articles.
    Fetches articles from RSS/NewsAPI, scrapes, deduplicates, analyzes, embeds, and saves to database.
    """
    from app import app
    from models import db, Article, User
    from modules.news_api import get_articles
    from modules.rss_ingest import fetch_google_news_rss
    from modules.scrape_article import scrape_article
    from modules.content import clean_and_format_content

    job = get_current_job()
    task_id = job.id if job else "local_run"

    try:
        with app.app_context():
            logger.info(f"Starting ingestion task {task_id} for user {user_email} (Query: {query}, Category: {category}, Country: {country}, Lang: {language})")
            update_task_progress(task_id, "started", 15, "Resolving request feed parameters...")
            
            # 1. Determine search query
            search_query = query
            if not search_query:
                if category:
                    search_query = category
                else:
                    user = User.query.filter_by(email=user_email).first()
                    if not user or not user.preferred_domains:
                        logger.info("No query or user preferences found. Skipping ingestion.")
                        update_task_progress(task_id, "completed", 100, "No domains preferred. Complete.")
                        return {"status": "success", "count": 0}
                    search_query = ' OR '.join(user.preferred_domains)
            
            # 2. Fetch raw article metadata
            articles_data = []
            update_task_progress(task_id, "started", 30, f"Fetching articles for '{search_query}'...")
            
            # Try fetching from Google News RSS
            try:
                rss_result = fetch_google_news_rss(search_query, country=country)
                if rss_result.get('status') == 'ok':
                    articles_data.extend(rss_result.get('articles', []))
                    logger.info(f"Fetched {len(rss_result.get('articles', []))} articles from Google News RSS.")
            except Exception as e:
                logger.error(f"Failed to fetch from Google News RSS: {e}")
                
            # Also try NewsAPI if we don't have enough articles
            if len(articles_data) < 10:
                try:
                    from_date = (datetime.utcnow() - timedelta(days=3)).strftime('%Y-%m-%d')
                    params = {
                        'q': search_query,
                        'language': language,
                        'sortBy': 'relevancy',
                        'pageSize': 15,
                        'apiKey': os.getenv("NEWSAPI_KEY")
                    }
                    newsapi_res = get_articles(params)
                    if newsapi_res.get('status') == 'ok':
                        articles_data.extend(newsapi_res.get('articles', []))
                        logger.info(f"Fetched {len(newsapi_res.get('articles', []))} articles from NewsAPI.")
                except Exception as e:
                    logger.error(f"Failed to fetch from NewsAPI: {e}")

            if not articles_data:
                logger.warning("No article metadata retrieved from any feed sources.")
                update_task_progress(task_id, "completed", 100, "No new articles found in feeds.")
                return {"status": "success", "count": 0}

            # 3. Process and Ingest Articles
            ingested_count = 0
            nlp = get_nlp()
            total_items = len(articles_data)
            
            update_task_progress(task_id, "started", 45, f"Scraping and analyzing {total_items} articles...")
            
            for idx, art_meta in enumerate(articles_data):
                url = art_meta.get('url')
                title = art_meta.get('title')
                if not url or not title:
                    continue
                    
                # Update progress within loop (45% to 95%)
                loop_progress = 45 + int((idx / total_items) * 50)
                update_task_progress(task_id, "started", loop_progress, f"Analyzing: {title[:40]}...")

                # A. URL Hash Deduplication
                url_hash = calculate_sha256(url)
                existing_article = Article.query.filter_by(url_hash=url_hash).first()
                if existing_article:
                    logger.info(f"Article already exists (URL hash match): {title}")
                    continue
                    
                # B. Scrape Full Content
                scrape_result = scrape_article(url)
                if isinstance(scrape_result, tuple):
                    raw_content, scraped_image = scrape_result
                else:
                    raw_content, scraped_image = scrape_result, None
                    
                if not raw_content:
                    logger.warning(f"Could not scrape content for URL: {url}")
                    continue
                    
                cleaned_content = clean_and_format_content(raw_content)
                if not cleaned_content or len(cleaned_content.strip()) < 100:
                    logger.warning(f"Cleaned content too short for URL: {url}")
                    continue
                    
                # C. Content Hash Deduplication
                content_hash = calculate_sha256(cleaned_content)
                existing_content = Article.query.filter_by(content_hash=content_hash).first()
                if existing_content:
                    logger.info(f"Article content already exists (Content hash match): {title}")
                    continue
                    
                # D. Named Entity Recognition (spaCy NER)
                doc = nlp(cleaned_content[:20000])  # limit to first 20k characters for performance
                entities = {}
                for ent in doc.ents:
                    if ent.label_ in ['ORG', 'PERSON', 'GPE', 'LAW', 'MONEY', 'PRODUCT']:
                        if ent.label_ not in entities:
                            entities[ent.label_] = []
                        if ent.text not in entities[ent.label_]:
                            entities[ent.label_].append(ent.text)

                # E. Sentiment Analysis
                tb = TextBlob(cleaned_content)
                sentiment_polarity = tb.sentiment.polarity
                sentiment_subjectivity = tb.sentiment.subjectivity
                
                # F. Embeddings (Cost Optimized: only embed unique, parsed, non-duplicate content)
                embedding = generate_embedding(cleaned_content[:8000]) # embed the first 8000 characters
                
                # G. Date Parsing
                pub_date = None
                published_at_str = art_meta.get('publishedAt')
                if published_at_str:
                    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
                        try:
                            pub_date = datetime.strptime(published_at_str[:19], fmt[:19])
                            break
                        except ValueError:
                            continue
                if not pub_date:
                    pub_date = datetime.utcnow()
                
                # H. Resolve best image: scraped og:image > RSS urlToImage > None
                article_image = scraped_image or art_meta.get('urlToImage') or None

                # I. Create Article Record
                new_article = Article(
                    title=title,
                    content=cleaned_content,
                    url=url,
                    url_hash=url_hash,
                    content_hash=content_hash,
                    published_at=pub_date,
                    source_name=art_meta.get('source', {}).get('name', 'Unknown Source'),
                    category=category,
                    url_to_image=article_image,
                    sentiment_polarity=sentiment_polarity,
                    sentiment_subjectivity=sentiment_subjectivity,
                    entities=entities,
                    embedding=embedding
                )
                
                # I. Set FTS document field using SQLAlchemy PostgreSQL func
                new_article.fts_document = func.to_tsvector('english', title + ' ' + cleaned_content)
                
                try:
                    db.session.add(new_article)
                    db.session.commit()
                    ingested_count += 1
                    logger.info(f"Successfully ingested article: {title}")
                except Exception as e:
                    db.session.rollback()
                    logger.error(f"Failed to save article '{title}' to database: {e}")
                    
            logger.info(f"Ingestion task complete. Ingested {ingested_count} new articles.")
            update_task_progress(task_id, "completed", 100, f"Briefing compiled! {ingested_count} new articles added.")
            return {"status": "success", "count": ingested_count}
            
    except Exception as e:
        logger.error(f"Critical failure in ingestion task {task_id}: {e}")
        update_task_progress(task_id, "failed", 0, f"Task failure: {str(e)}")
        return {"status": "failed", "error": str(e)}

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(to_email, subject, html_content):
    sender_email = os.getenv("SMTP_EMAIL", "test@example.com")
    sender_password = os.getenv("SMTP_PASSWORD", "")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not sender_password:
        logger.warning("SMTP_PASSWORD not set, printing email to console instead of sending.")
        logger.info(f"--- EMAIL TO: {to_email} ---\nSUBJECT: {subject}\nCONTENT:\n{html_content}\n---")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = to_email

        part2 = MIMEText(html_content, "html")
        msg.attach(part2)

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        logger.info(f"Successfully sent daily briefing to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")

def generate_and_send_briefing(user_email):
    from app import app
    from models import db, Article, User
    import google.generativeai as genai
    
    try:
        with app.app_context():
            user = User.query.filter_by(email=user_email).first()
            if not user:
                logger.error(f"User {user_email} not found for daily briefing.")
                return {"status": "failed", "error": "User not found"}
                
            # Get recent articles
            recent_date = datetime.utcnow() - timedelta(days=2)
            query = Article.query.filter(Article.published_at >= recent_date)
            
            if user.preferred_domains:
                filters = []
                for domain in user.preferred_domains:
                    filters.append(Article.title.ilike(f"%{domain}%"))
                    filters.append(Article.content.ilike(f"%{domain}%"))
                query = query.filter(or_(*filters))
                
            articles = query.order_by(Article.published_at.desc()).limit(5).all()
            
            if not articles:
                logger.info(f"Not enough recent articles to generate a briefing for {user_email}.")
                return {"status": "success", "message": "No recent articles"}
                
            # Construct content for Gemini
            prompt = "You are a professional news editor. Create a concise, engaging 'Daily Morning Briefing' email newsletter summarizing the following articles. Format it nicely in HTML with clear headings and bullet points.\n\n"
            for i, article in enumerate(articles):
                prompt += f"Article {i+1}: {article.title}\nSource: {article.source_name}\nContent: {article.content[:500]}...\nURL: {article.url}\n\n"
                
            # Assume API key is configured globally
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(prompt)
            html_content = response.text
            
            # Clean up markdown formatting if present
            if html_content.startswith("```html"):
                html_content = html_content[7:]
            if html_content.endswith("```"):
                html_content = html_content[:-3]
                
            send_email(user_email, "Your NewsLens Daily Briefing 🌅", html_content.strip())
            
            return {"status": "success"}
    except Exception as e:
        logger.error(f"Error generating briefing for {user_email}: {e}")
        return {"status": "failed", "error": str(e)}
