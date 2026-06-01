import os
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from datetime import datetime, timedelta
from functools import wraps

import jwt
import bcrypt
import nltk

from modules.news_api import get_articles, top_headlines
from modules.content import fetch_full_content
from modules.sentiment import analyze_sentiments
from modules.summarizer import gemini_summarizer

from models import db, User, Article, SavedArticle, ArticleReadHistory
from cache import r
from flask_migrate import Migrate

from sqlalchemy import or_, case
from rq import Queue
from tasks import ingest_articles_task
from modules.hybrid_search import execute_hybrid_search
from modules.sse import event_stream, update_task_progress
from modules.cache_manager import get_cached_search, set_cached_search, get_cached_summary, set_cached_summary

from pydantic import ValidationError
from schemas import SignupSchema, LoginSchema, UpdatePreferencesSchema

nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

import logging
from logging.handlers import RotatingFileHandler

if not os.path.exists('logs'):
    os.mkdir('logs')
file_handler = RotatingFileHandler('logs/newslens.log', maxBytes=10485760, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('NewsLens backend starting up...')

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment variables!")
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
migrate = Migrate(app, db)
q = Queue('default', connection=r)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS(app, resources={
    r"/*": {
        "origins": [FRONTEND_URL, "http://192.168.55.182:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_here")
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")

if not NEWSAPI_KEY:
    raise ValueError("NEWSAPI_KEY not found in environment variables!")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(None, *args, **kwargs)
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid Authorization header format"}), 401
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = User.query.filter_by(email=data['email']).first()
            if not current_user:
                return jsonify({"error": "User not found"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route("/signup", methods=["POST", "OPTIONS"])
@limiter.limit("5 per minute")
def signup():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    data = request.get_json()
    try:
        validated_data = SignupSchema(**data)
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.errors()}), 400
    
    existing_user = User.query.filter_by(email=validated_data.email).first()
    if existing_user:
        return jsonify({"error": "User already exists"}), 400
    
    hashed_pw = bcrypt.hashpw(validated_data.password.encode(), bcrypt.gensalt()).decode()
    
    country = validated_data.country or "us"
    language = validated_data.language or "en"
    
    new_user = User(
        name=validated_data.name,
        email=validated_data.email,
        password=hashed_pw,
        location=validated_data.location or "",
        country=country,
        language=language,
        preferred_domains=[]
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    return jsonify({"message": "User registered successfully", "redirect": "/preferences"}), 201

@app.route("/login", methods=["POST", "OPTIONS"])
@limiter.limit("5 per minute")
def login():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    data = request.get_json()
    try:
        validated_data = LoginSchema(**data)
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.errors()}), 400
        
    email = validated_data.email
    password = validated_data.password
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        return jsonify({"error": "Invalid credentials"}), 401
    
    token = jwt.encode({"email": email, "exp": datetime.utcnow() + timedelta(hours=24)}, SECRET_KEY, algorithm="HS256")
    
    return jsonify({
        "token": token,
        "redirect": "/news-home",
        "user": user.as_dict()
    }), 200

@app.route("/update_preferences", methods=["POST", "OPTIONS"])
@token_required
@limiter.limit("10 per minute")
def update_preferences(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    data = request.get_json()
    try:
        validated_data = UpdatePreferencesSchema(**data)
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.errors()}), 400
        
    preferences = validated_data.preferred_domains
    country = validated_data.country
    language = validated_data.language
    news_scope = validated_data.news_scope
        
    try:
        current_user.preferred_domains = preferences
        current_user.country = country
        current_user.language = language
        current_user.news_scope = news_scope
        db.session.commit()
        return jsonify({"message": "Preferences updated successfully!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/get_preferences", methods=["POST", "OPTIONS"])
@token_required
def get_preferences(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    return jsonify({
        "preferred_domains": current_user.preferred_domains or [],
        "country": current_user.country,
        "language": current_user.language,
        "news_scope": current_user.news_scope
    }), 200

@app.route("/bookmarks", methods=["POST", "OPTIONS"])
@token_required
def add_bookmark(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    
    data = request.get_json() or {}
    article_id = data.get('article_id')
    
    if not article_id:
        return jsonify({"error": "article_id is required"}), 400
        
    article = Article.query.get(article_id)
    if not article:
        return jsonify({"error": "Article not found"}), 404
        
    existing = SavedArticle.query.filter_by(user_id=current_user.id, article_id=article_id).first()
    if existing:
        return jsonify({"message": "Article already bookmarked"}), 200
        
    new_bookmark = SavedArticle(user_id=current_user.id, article_id=article_id)
    try:
        db.session.add(new_bookmark)
        db.session.commit()
        return jsonify({"message": "Article bookmarked successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/bookmarks/<int:article_id>", methods=["DELETE", "OPTIONS"])
@token_required
def remove_bookmark(current_user, article_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
        
    bookmark = SavedArticle.query.filter_by(user_id=current_user.id, article_id=article_id).first()
    if not bookmark:
        return jsonify({"error": "Bookmark not found"}), 404
        
    try:
        db.session.delete(bookmark)
        db.session.commit()
        return jsonify({"message": "Bookmark removed successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/bookmarks", methods=["GET", "OPTIONS"])
@token_required
def get_bookmarks(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
        
    page = request.args.get('page', 1, type=int)
    per_page = 20
    
    bookmarks = SavedArticle.query.filter_by(user_id=current_user.id).order_by(SavedArticle.saved_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    articles = [b.article.as_dict() for b in bookmarks.items]
    
    return jsonify({
        "articles": articles,
        "totalResults": bookmarks.total,
        "page": page
    }), 200

FEED_CONFIG = {
    "interest_weight": 0.7,
    "regional_weight": 0.3
}

@app.route("/news", methods=["POST", "OPTIONS"])
@token_required
@limiter.limit("30 per minute")
def fetch_news(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    
    data = request.get_json() or {}
    page = data.get("page", 1)
    category = data.get("category")
    
    per_page = 20
    articles_list = []
    total_results = 0

    if category:
        articles_query = Article.query.filter(Article.category == category)
        total_results = articles_query.count()
        articles_list = articles_query.order_by(Article.published_at.desc()).paginate(page=page, per_page=per_page, error_out=False).items
    else:
        if current_user.preferred_domains:
            filters = []
            for domain in current_user.preferred_domains:
                filters.append(Article.title.ilike(f"%{domain}%"))
                filters.append(Article.content.ilike(f"%{domain}%"))
            
            match_cond = or_(*filters)
            sort_score = case((match_cond, 1), else_=0)
            query = Article.query.order_by(sort_score.desc(), Article.published_at.desc())
        else:
            query = Article.query.order_by(Article.published_at.desc())
            
        total_results = query.count()
        articles_list = query.paginate(page=page, per_page=per_page, error_out=False).items

    # Trigger ingestion if we don't have enough articles for the dashboard
    if len(articles_list) < 5:
        try:
            from tasks import ingest_articles_task
            job = q.enqueue(ingest_articles_task, current_user.email, query=None, category=category, country=current_user.country, language=current_user.language)
            app.logger.info(f"Triggered background ingestion from /news endpoint for user {current_user.email}. Job ID: {job.id}")
            # We don't return 202 here to keep it simple, frontend will just show empty state and user can refresh
        except Exception as e:
            app.logger.warning(f"Redis unavailable for enqueue in /news: {e}")

    articles_dicts = [art.as_dict() for art in articles_list]
    for art in articles_dicts:
        art['urlToImage'] = art.get('urlToImage', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=600')
        
    return jsonify({
        "articles": articles_dicts,
        "totalResults": total_results,
        "page": page
    }), 200

@app.route("/top-headlines", methods=["POST", "OPTIONS"])
def fetch_top_headlines():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    
    data = request.get_json() or {}
    page = data.get("page", 1)
    
    country = 'us'
    token = None
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        try:
            token = auth_header.split(" ")[1]
            token_data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = User.query.filter_by(email=token_data['email']).first()
            if current_user:
                country = current_user.country
        except Exception:
            pass # fallback to 'us'
            
    from modules.locales import get_locale
    locale = get_locale(country)
    
    import json
    cached_data = None
    try:
        cached_data = r.get(cache_key)
    except Exception as e:
        app.logger.warning(f"Redis unavailable for get: {e}")
        
    if cached_data:
        return jsonify(json.loads(cached_data)), 200
    
    params = {'country': locale['country'], 'page': page, 'pageSize': 20, 'apiKey': NEWSAPI_KEY}
    
    try:
        api_response = top_headlines(params)
        if api_response.get('status') != 'ok':
            return jsonify({"error": "Failed to fetch top headlines", "details": api_response.get('message', 'Unknown')}), 500
        
        api_response = fetch_full_content(api_response)
        api_response = analyze_sentiments(api_response)
        api_response['articles'] = [a for a in api_response.get('articles', []) if a.get('content') and a.get('urlToImage')]
        
        response_data = {"articles": api_response.get('articles', []), "totalResults": api_response.get('totalResults', 0), "page": page}
        
        # Set cache with 15 mins TTL
        try:
            r.setex(cache_key, 900, json.dumps(response_data))
        except Exception as e:
            app.logger.warning(f"Redis unavailable for setex: {e}")
        
        return jsonify(response_data), 200
    
    except Exception as e:
        return jsonify({"error": f"Error fetching top headlines: {str(e)}"}), 500

@app.route("/search", methods=["POST", "OPTIONS"])
@token_required
def search(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    data = request.get_json() or {}
    query = data.get('query', '')
    page = data.get('page', 1)
    refresh = data.get('refresh', False)

    if not query:
        return jsonify({"error": "Search query is required"}), 400

    # 1. Check Redis Cache
    if not refresh:
        cached_results = get_cached_search(query, page)
        if cached_results:
            return jsonify(cached_results), 200

    # 2. Execute Hybrid Search
    search_results = execute_hybrid_search(query, limit=20, page=page)
    
    # 3. Determine if we need to crawl for new articles matching query
    if refresh or search_results.get("totalResults", 0) < 5:
        # Enqueue ingestion task for this query
        try:
            job = q.enqueue(ingest_articles_task, current_user.email, query=query, country=current_user.country, language=current_user.language)
            update_task_progress(job.id, "started", 10, f"Searching and indexing articles for '{query}'...")
            
            # If we have no local results, return a 202 status so frontend can show progress
            if not search_results.get("articles"):
                return jsonify({
                    "status": "processing",
                    "task_id": job.id,
                    "message": f"Crawling the web for '{query}'..."
                }), 202
            else:
                # We have some results, return them but flag that we are searching for more in the background
                search_results["background_task_id"] = job.id
        except Exception as e:
            app.logger.warning(f"Redis unavailable for enqueue: {e}")

    # 4. Cache results in Redis
    if "background_task_id" not in search_results:
        # For compatibility, ensure each article has urlToImage and content fields matching frontend expectations
        for art in search_results.get("articles", []):
            art['urlToImage'] = art.get('urlToImage', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=600') # fallback image
        set_cached_search(query, page, search_results)

    return jsonify(search_results), 200

@app.route("/chat", methods=["POST", "OPTIONS"])
@token_required
def chat(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    
    data = request.get_json() or {}
    query = data.get('query', '')
    provided_context = data.get('context_articles', None)
    
    if not query:
        return jsonify({"error": "Search query is required"}), 400

    from modules.chat import generate_rag_response_stream
    
    if provided_context is not None:
        context_articles = provided_context
    else:
        from modules.hybrid_search import execute_hybrid_search
        # 1. Execute Hybrid Search for Context
        search_results = execute_hybrid_search(query, limit=5, page=1)
        context_articles = search_results.get("articles", [])
    
    # 2. Return SSE response
    return Response(generate_rag_response_stream(query, context_articles), mimetype='text/event-stream')

@app.route("/historical-search", methods=["POST", "OPTIONS"])
@limiter.exempt
@token_required
def historical_search(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
        
    data = request.get_json() or {}
    query = data.get('query', '')
    mode = data.get('mode', 'historical')
    
    if not query:
        return jsonify({"error": "Search query is required"}), 400
        
    cache_key = f"historical:{mode}:{query}"
    try:
        cached_val = r.get(cache_key)
        if cached_val:
            return jsonify(json.loads(cached_val)), 200
    except Exception as e:
        app.logger.warning(f"Redis get error: {e}")
        
    from modules.ddg_search import fetch_historical_search
    results = fetch_historical_search(query, max_results=10, search_mode=mode)
    
    response_data = {
        "articles": results,
        "totalResults": len(results),
        "page": 1,
        "mode": mode
    }
    
    try:
        # Cache for 24 hours (86400 seconds)
        r.setex(cache_key, 86400, json.dumps(response_data))
    except Exception as e:
        app.logger.warning(f"Redis setex error: {e}")
        
    return jsonify(response_data), 200

@app.route("/scrape-ephemeral", methods=["POST", "OPTIONS"])
@limiter.exempt
@token_required
def scrape_ephemeral(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
        
    data = request.get_json() or {}
    url = data.get('url', '')
    
    if not url:
        return jsonify({"error": "URL is required"}), 400
        
    import hashlib
    url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()
    cache_key = f"scrape:{url_hash}"
    
    try:
        cached_val = r.get(cache_key)
        if cached_val:
            return jsonify(json.loads(cached_val)), 200
    except Exception:
        pass
        
    from modules.scrape_article import scrape_article
    from modules.content import clean_and_format_content
    raw_content, metadata = scrape_article(url, use_cache=True)
    
    if not raw_content:
        return jsonify({"error": "Failed to scrape article content."}), 500
        
    clean_content = clean_and_format_content(raw_content)
    
    response_data = {
        "url": url,
        "title": metadata.get('title', ''),
        "content": clean_content,
        "publishedAt": metadata.get('publish_date', '')
    }
    
    try:
        r.setex(cache_key, 86400, json.dumps(response_data))
    except Exception:
        pass
        
    return jsonify(response_data), 200

@app.route("/article-chat", methods=["POST", "OPTIONS"])
@token_required
def article_chat(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    
    data = request.get_json() or {}
    url = data.get('article_url')
    query = data.get('query')
    
    if not url or not query:
        return jsonify({"error": "article_url and query are required"}), 400

    article = Article.query.filter_by(url=url).first()
    content = None
    title = 'Unknown'
    
    if article and article.content:
        content = article.content
        title = article.title
    else:
        # Fallback to scraping
        try:
            from modules.scrape_article import scrape_article
            from modules.content import clean_and_format_content
            raw_text, _ = scrape_article(url)
            content = clean_and_format_content(raw_text) if raw_text else None
            
            # Extract title for query context
            try:
                import requests
                from bs4 import BeautifulSoup
                from modules.scrape_article import HEADERS
                res = requests.get(url, headers=HEADERS, timeout=5)
                soup = BeautifulSoup(res.content, "html.parser")
                title = soup.find("title").get_text(strip=True) if soup.find("title") else "Unknown"
            except Exception:
                title = "Unknown"
        except Exception as e:
            app.logger.error(f"Failed to scrape article for chat: {e}")
            content = None

    if not content:
        return jsonify({"error": "Could not retrieve article content."}), 400

    from modules.article_chat import generate_article_chat_stream
    return Response(generate_article_chat_stream(content, title, query), mimetype='text/event-stream')

@app.route("/summarize", methods=["POST", "OPTIONS"])
@token_required
def summarize(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    data = request.get_json() or {}
    article_url = data.get('article_url')
    if not article_url:
        return jsonify({"error": "Article URL is required"}), 400
        
    # 1. Check Redis Cache
    cached_summary = get_cached_summary(article_url)
    if cached_summary:
        return jsonify(cached_summary), 200
        
    try:
        from modules.summarizer import find_related_articles_db, gemini_summarizer
        docs, info = find_related_articles_db(article_url)
        if not docs:
            return jsonify({"error": "Could not retrieve content for summarization"}), 404
            
        summary_data = gemini_summarizer(docs, info=info)
        if "error" in summary_data:
            return jsonify(summary_data), 500
            
        # 2. Store in Redis Cache
        set_cached_summary(article_url, summary_data)
        
        return jsonify(summary_data), 200
    except Exception as e:
        return jsonify({"error": f"Summarization failed: {str(e)}"}), 500

@app.route("/record-read", methods=["POST", "OPTIONS"])
@limiter.exempt
@token_required
def record_read(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    data = request.get_json() or {}
    article_id = data.get('article_id')
    duration_seconds = data.get('duration_seconds', 0)

    if not article_id:
        return jsonify({"error": "article_id is required"}), 400

    try:
        from sqlalchemy import cast, Date
        from datetime import datetime
        
        today = datetime.utcnow().date()
        record = ArticleReadHistory.query.filter(
            ArticleReadHistory.user_id == current_user.id,
            ArticleReadHistory.article_id == int(article_id),
            cast(ArticleReadHistory.read_at, Date) == today
        ).first()

        if record:
            record.read_duration_seconds = max(record.read_duration_seconds, int(duration_seconds))
        else:
            record = ArticleReadHistory(
                user_id=current_user.id,
                article_id=int(article_id),
                read_duration_seconds=int(duration_seconds)
            )
            db.session.add(record)
            
        db.session.commit()
        return jsonify({"message": "Read recorded"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to record read: {str(e)}"}), 500


@app.route("/analytics", methods=["GET", "OPTIONS"])
@limiter.exempt
@token_required
def analytics(current_user):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    from sqlalchemy import func as sql_func, cast, Date

    user_id = current_user.id
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    # ── 1. Weekly Reading Time (minutes per day, last 7 days) ──
    daily_reads = (
        db.session.query(
            cast(ArticleReadHistory.read_at, Date).label('day'),
            sql_func.sum(ArticleReadHistory.read_duration_seconds).label('total_seconds')
        )
        .filter(
            ArticleReadHistory.user_id == user_id,
            ArticleReadHistory.read_at >= seven_days_ago
        )
        .group_by('day')
        .order_by('day')
        .all()
    )
    weekly_reading_time = []
    for i in range(7):
        day = (seven_days_ago + timedelta(days=i + 1)).date()
        matched = next((row for row in daily_reads if row.day == day), None)
        weekly_reading_time.append({
            "day": day.strftime("%a"),
            "minutes": round((matched.total_seconds or 0) / 60, 1) if matched else 0
        })

    # ── 2. Top Categories ──
    category_reads = (
        db.session.query(
            Article.category,
            sql_func.count(sql_func.distinct(ArticleReadHistory.article_id)).label('count')
        )
        .join(Article, Article.id == ArticleReadHistory.article_id)
        .filter(ArticleReadHistory.user_id == user_id)
        .group_by(Article.category)
        .order_by(sql_func.count(sql_func.distinct(ArticleReadHistory.article_id)).desc())
        .limit(6)
        .all()
    )
    top_categories = [
        {"name": (row.category or "General").title(), "value": row.count}
        for row in category_reads
    ]

    # ── 3. Sentiment Bias ──
    sentiment_reads = (
        db.session.query(Article.sentiment_polarity)
        .join(Article, Article.id == ArticleReadHistory.article_id)
        .filter(
            ArticleReadHistory.user_id == user_id,
            Article.sentiment_polarity.isnot(None)
        )
        .distinct(Article.id)
        .all()
    )
    positive = sum(1 for row in sentiment_reads if row.sentiment_polarity > 0.05)
    negative = sum(1 for row in sentiment_reads if row.sentiment_polarity < -0.05)
    neutral = len(sentiment_reads) - positive - negative

    return jsonify({
        "weekly_reading_time": weekly_reading_time,
        "top_categories": top_categories,
        "sentiment_bias": [
            {"label": "Positive", "value": positive},
            {"label": "Neutral",  "value": neutral},
            {"label": "Negative", "value": negative},
        ],
        "total_articles_read": len(sentiment_reads)
    }), 200


@app.route("/ingest/status/<task_id>", methods=["GET"])
def ingest_status(task_id):
    return Response(event_stream(task_id), mimetype='text/event-stream')

@app.route("/health", methods=["GET"])
def health():
    db_status = "disconnected"
    redis_status = "disconnected"
    
    try:
        db.session.execute(db.text('SELECT 1'))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    try:
        r.ping()
        redis_status = "connected"
    except Exception as e:
        redis_status = f"error: {str(e)}"

    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "cache": redis_status
    }), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)