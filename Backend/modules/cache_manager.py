import json
import logging
from cache import r

logger = logging.getLogger(__name__)

def get_cached_search(query, page):
    """
    Retrieves cached search results for a given query and page.
    """
    key = f"search:{query}:{page}"
    try:
        data = r.get(key)
        if data:
            logger.info(f"Redis Cache Hit for search query: {query} (page {page})")
            return json.loads(data.decode('utf-8'))
    except Exception as e:
        logger.error(f"Error reading search cache: {e}")
    return None

def set_cached_search(query, page, results, ttl=3600):
    """
    Stores search results in Redis cache.
    """
    key = f"search:{query}:{page}"
    try:
        r.setex(key, ttl, json.dumps(results))
        logger.info(f"Redis Cache Set for search query: {query} (page {page})")
    except Exception as e:
        logger.error(f"Error setting search cache: {e}")

def get_cached_summary(article_url):
    """
    Retrieves cached AI summary for an article URL.
    """
    key = f"summary:{article_url}"
    try:
        data = r.get(key)
        if data:
            logger.info(f"Redis Cache Hit for summary of URL: {article_url}")
            return json.loads(data.decode('utf-8'))
    except Exception as e:
        logger.error(f"Error reading summary cache: {e}")
    return None

def set_cached_summary(article_url, summary_data, ttl=86400):
    """
    Stores article summary in Redis cache.
    """
    key = f"summary:{article_url}"
    try:
        r.setex(key, ttl, json.dumps(summary_data))
        logger.info(f"Redis Cache Set for summary of URL: {article_url}")
    except Exception as e:
        logger.error(f"Error setting summary cache: {e}")

def is_embedding_cached(content_hash):
    """
    Checks if an article's embedding has already been generated and saved.
    This helps in avoiding redundant calls to Gemini Embedding API.
    """
    key = f"embedding_exists:{content_hash}"
    try:
        return r.get(key) is not None
    except Exception as e:
        logger.error(f"Error reading embedding cache: {e}")
        return False

def set_embedding_cached(content_hash, ttl=604800):
    """
    Caches the existence of a content embedding.
    """
    key = f"embedding_exists:{content_hash}"
    try:
        r.setex(key, ttl, "1")
    except Exception as e:
        logger.error(f"Error setting embedding cache: {e}")
