import os
import logging
import google.generativeai as genai
from flask import jsonify
from datetime import datetime, timedelta

from modules.scrape_article import scrape_article
from modules.content import clean_and_format_content

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def find_related_articles_db(article_url, limit=9):
    """
    Finds semantically related articles in the local database using pgvector.
    If less than `limit` related articles are found locally, searches online
    using Google News RSS and scrapes their contents.
    Returns list of clean contents and metadata.
    """
    from models import Article, db
    from modules.scrape_article import scrape_article
    from modules.content import clean_and_format_content
    from modules.rss_ingest import fetch_google_news_rss
    
    # 1. Look up the original article in DB
    original_art = Article.query.filter_by(url=article_url).first()
    content = None
    emb = None
    title = ""
    
    if original_art:
        content = original_art.content
        emb = original_art.embedding
        title = original_art.title
    else:
        # Fallback: scrape the article and generate embedding on the fly
        logger.info(f"Article {article_url} not in DB. Scraping and embedding on-the-fly.")
        raw, _ = scrape_article(article_url)
        if raw:
            content = clean_and_format_content(raw)
            from tasks import generate_embedding
            emb = generate_embedding(content[:8000]) if content else None
            
        # Try to parse title for online search fallback
        try:
            import requests
            from bs4 import BeautifulSoup
            from modules.scrape_article import HEADERS
            res = requests.get(article_url, headers=HEADERS, timeout=5)
            soup = BeautifulSoup(res.content, "html.parser")
            title = soup.find("title").get_text(strip=True) if soup.find("title") else ""
        except Exception as e:
            logger.warning(f"Could not parse title from url: {e}")
            title = ""

    if not content:
        return None, []

    # 2. Find closest neighbors using pgvector cosine distance
    related_local = []
    if emb is not None:
        try:
            related_local = Article.query.filter(
                Article.url != article_url,
                Article.embedding.isnot(None)
            ).order_by(
                Article.embedding.cosine_distance(emb)
            ).limit(limit).all()
        except Exception as e:
            logger.error(f"Error finding related articles via pgvector: {e}")

    docs = [content]
    info = []
    
    # Track URLs to avoid duplicates
    seen_urls = {article_url}
    
    for art in related_local:
        docs.append(art.content)
        info.append({'title': art.title, 'url': art.url})
        seen_urls.add(art.url)
        
    logger.info(f"Found {len(related_local)} semantically related articles in local database.")
    
    # 3. If we don't have enough articles, search online!
    needed = limit - len(related_local)
    if needed > 0 and title:
        search_query = title
        # Clean title: typically titles have " - Source Name" or " | Source" at the end, let's remove it
        if " - " in search_query:
            search_query = search_query.rsplit(" - ", 1)[0]
        if " | " in search_query:
            search_query = search_query.rsplit(" | ", 1)[0]
            
        logger.info(f"Need {needed} more articles. Searching online for '{search_query}'...")
        try:
            search_results = fetch_google_news_rss(search_query)
            if search_results.get('status') == 'ok':
                online_articles = search_results.get('articles', [])
                logger.info(f"Online search returned {len(online_articles)} results.")
                
                count_added = 0
                for online_art in online_articles:
                    url = online_art.get('url')
                    if not url or url in seen_urls:
                        continue
                    
                    logger.info(f"Scraping online article: {online_art.get('title')} ({url})")
                    scraped_raw, _ = scrape_article(url, use_cache=True)
                    if scraped_raw:
                        scraped_clean = clean_and_format_content(scraped_raw)
                        if scraped_clean and len(scraped_clean.strip()) > 100:
                            docs.append(scraped_clean)
                            info.append({
                                'title': online_art.get('title', 'Related News'),
                                'url': url
                            })
                            seen_urls.add(url)
                            count_added += 1
                            if count_added >= needed:
                                break
                logger.info(f"Successfully scraped and added {count_added} online articles.")
        except Exception as e:
            logger.error(f"Error during online related articles search: {e}")

    return docs, info

def gemini_summarizer(docs, info=None):
    """
    Generates a professional news briefing summary using a 100% free, unlimited,
    and local NLTK-based extractive summarizer.
    """
    if not docs:
        return {"error": "No content available to summarize."}

    import re
    from collections import Counter
    import string

    primary_text = docs[0]
    related_text = "\n\n".join(docs[1:5])  # grab up to 4 related articles for context
    num_sentences = 5
    summary = ""

    try:
        import nltk
        from nltk.tokenize import sent_tokenize, word_tokenize
        from nltk.corpus import stopwords

        # Tokenize primary article sentences
        sentences = sent_tokenize(primary_text)
        if len(sentences) <= num_sentences:
            summary = primary_text
        else:
            # Combine primary and related text to calculate global word frequencies
            combined_text = primary_text + " " + related_text
            words = word_tokenize(combined_text.lower())
            
            # Filter stopwords and punctuation
            stop_words = set(stopwords.words('english'))
            punctuation = set(string.punctuation)
            filtered_words = [w for w in words if w.isalnum() and w not in stop_words and w not in punctuation]
            
            # Word frequency
            word_frequencies = Counter(filtered_words)
            if not word_frequencies:
                summary = " ".join(sentences[:num_sentences])
            else:
                max_frequency = max(word_frequencies.values())
                for word in word_frequencies:
                    word_frequencies[word] = word_frequencies[word] / max_frequency

                # Score sentences based on normalized frequency
                sentence_scores = {}
                for sent in sentences:
                    sentence_words = word_tokenize(sent.lower())
                    score = 0
                    word_count = 0
                    for word in sentence_words:
                        if word in word_frequencies:
                            score += word_frequencies[word]
                            word_count += 1
                    if word_count > 0:
                        sentence_scores[sent] = score / (1 + (word_count ** 0.5))

                import heapq
                summary_sentences = heapq.nlargest(num_sentences, sentence_scores, key=sentence_scores.get)
                summary_sentences.sort(key=lambda s: sentences.index(s))
                summary = " ".join(summary_sentences)
                
                logger.info("Successfully generated summary using local NLTK extractive summarizer.")

    except Exception as e:
        logger.error(f"Local NLTK summarizer failed: {e}. Falling back to basic paragraph heuristic.")
        # Fallback to splitting by simple sentence-ending punctuation
        sentences = re.split(r'(?<=[.!?])\s+', primary_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) <= num_sentences:
            summary = primary_text
        else:
            summary = " ".join(sentences[:num_sentences])

    if not summary:
        summary = primary_text[:400] + "..." if len(primary_text) > 400 else primary_text

    summary_data = {
        'articles': [{
            'title': 'Summary',
            'description': summary,
            'info': info if info else []
        }]
    }
    
    return summary_data