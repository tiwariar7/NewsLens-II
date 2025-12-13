import feedparser
import urllib.parse
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)

def fetch_rss_feed(feed_url):
    """
    Fetches and parses any standard RSS feed.
    """
    try:
        logger.info(f"Parsing RSS Feed: {feed_url}")
        feed = feedparser.parse(feed_url)
        articles = []
        for entry in feed.entries:
            # Parse published date safely
            published_parsed = entry.get('published_parsed')
            if published_parsed:
                dt = datetime.fromtimestamp(time.mktime(published_parsed))
                published_at = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                published_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

            # Extract image if available in links or media content
            image_url = ""
            if 'links' in entry:
                for link in entry.links:
                    if 'image' in link.get('type', ''):
                        image_url = link.get('href', '')
                        break
            
            # Format to match NewsAPI schema
            article = {
                'title': entry.get('title', ''),
                'description': entry.get('summary', ''),
                'url': entry.get('link', ''),
                'urlToImage': image_url or None,
                'publishedAt': published_at,
                'source': {'name': feed.feed.get('title', 'RSS Feed')},
                'content': entry.get('content', [{}])[0].get('value', entry.get('summary', ''))
            }
            articles.append(article)
        return {'status': 'ok', 'articles': articles, 'totalResults': len(articles)}
    except Exception as e:
        logger.error(f"Error fetching RSS feed from {feed_url}: {e}")
        return {'status': 'error', 'message': str(e), 'articles': []}

def fetch_google_news_rss(query, country="us"):
    """
    Fetches articles matching a query from Google News RSS.
    """
    from modules.locales import get_locale
    locale = get_locale(country)
    
    encoded_query = urllib.parse.quote_plus(query)
    feed_url = f"https://news.google.com/rss/search?q={encoded_query}&hl={locale['hl']}&gl={locale['gl']}&ceid={locale['ceid']}"
    result = fetch_rss_feed(feed_url)
    if result['status'] == 'ok':
        for article in result['articles']:
            article['source'] = {'name': 'Google News'}
    return result
