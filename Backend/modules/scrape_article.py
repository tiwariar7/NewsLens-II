import logging
from datetime import timedelta
import time
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import requests

from cache import r

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    )
}

# Domain-level rate-limiting mapping
LAST_DOMAIN_ACCESS = {}
POLITENESS_DELAY = 1.5  # Seconds between requests to the same domain

def enforce_rate_limiting(url):
    domain = urlparse(url).netloc
    if not domain:
        return
    
    last_access = LAST_DOMAIN_ACCESS.get(domain, 0)
    elapsed = time.time() - last_access
    if elapsed < POLITENESS_DELAY:
        sleep_time = POLITENESS_DELAY - elapsed
        logger.info(f"Rate limiting active for {domain}. Sleeping for {sleep_time:.2f}s")
        time.sleep(sleep_time)
    
    LAST_DOMAIN_ACCESS[domain] = time.time()

def extract_article_image(soup, url):
    """
    Extract the best cover image from a page.
    Priority: og:image > twitter:image > largest <img> in article body.
    """
    # 1. Open Graph image (most reliable)
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        img_url = og_image["content"].strip()
        if img_url.startswith("//"):
            img_url = "https:" + img_url
        elif img_url.startswith("/"):
            img_url = urljoin(url, img_url)
        if img_url.startswith("http"):
            return img_url

    # 2. Twitter card image
    twitter_image = soup.find("meta", attrs={"name": "twitter:image"}) or soup.find("meta", property="twitter:image")
    if twitter_image and twitter_image.get("content"):
        img_url = twitter_image["content"].strip()
        if img_url.startswith("//"):
            img_url = "https:" + img_url
        elif img_url.startswith("/"):
            img_url = urljoin(url, img_url)
        if img_url.startswith("http"):
            return img_url

    # 3. First large image in article body
    article_tag = soup.find("article") or soup.find("div", class_=["article-content", "post-content", "entry-content", "content"])
    search_area = article_tag if article_tag else soup
    for img in search_area.find_all("img", src=True):
        src = img.get("src", "")
        # Skip tiny icons/trackers/base64
        if "data:" in src or "pixel" in src or "logo" in src.lower() or "icon" in src.lower():
            continue
        width = img.get("width")
        height = img.get("height")
        # If dimensions are available, skip small images
        if width and str(width).isdigit() and int(width) < 200:
            continue
        if height and str(height).isdigit() and int(height) < 150:
            continue
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            src = urljoin(url, src)
        if src.startswith("http"):
            return src

    return None

def scrape_article(url, use_cache=True, max_retries=3):
    if "news.google.com" in url:
        try:
            from googlenewsdecoder import gnewsdecoder
            decoded = gnewsdecoder(url)
            if decoded.get("status"):
                url = decoded["decoded_url"]
                logger.info(f"Decoded Google News URL to: {url}")
        except Exception as e:
            logger.error(f"Error decoding Google News URL: {e}")

    cache_key = f"article_cache:{url}"
    image_cache_key = f"article_image:{url}"
    
    if use_cache:
        try:
            cached_content = r.get(cache_key)
            if cached_content:
                logger.info(f"Cache hit for: {url}")
                cached_image = r.get(image_cache_key)
                return cached_content.decode('utf-8'), cached_image.decode('utf-8') if cached_image else None
        except Exception as e:
            logger.error(f"Redis get error for {url}: {e}")
            
    # Politeness / rate-limiting delay
    enforce_rate_limiting(url)
    
    attempt = 1
    backoff = 2
    while attempt <= max_retries:
        try:
            logger.info(f"Scraping article (Attempt {attempt}/{max_retries}): {url}")
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, "html.parser")

            # Extract cover image before removing tags
            cover_image = extract_article_image(soup, url)
            
            for tag in soup(['script', 'style', 'nav', 'footer', 'aside', 'header', 'iframe']):
                tag.decompose()
            
            selectors = [
                'article',
                {'class': ['article-content', 'post-content', 'entry-content', 'content', 'article-body']},
                {'id': ['article', 'content', 'main-content']}
            ]
            
            article_content = None
            for selector in selectors:
                if isinstance(selector, str):
                    article_content = soup.find(selector)
                else:
                    article_content = soup.find('div', selector)
                if article_content:
                    break
            
            if article_content:
                paragraphs = article_content.find_all("p")
            else:
                paragraphs = soup.find_all("p")
            
            article_text = "\n".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))
            
            if article_text and use_cache:
                try:
                    r.setex(cache_key, timedelta(hours=24), article_text)
                    if cover_image:
                        r.setex(image_cache_key, timedelta(hours=24), cover_image)
                    logger.info(f"Cached article: {url}")
                except Exception as e:
                    logger.error(f"Redis set error: {e}")
            
            return (article_text.strip() if article_text else "", cover_image)
            
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout scraping article {url} on attempt {attempt}: {e}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error scraping article {url} on attempt {attempt}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error scraping {url} on attempt {attempt}: {e}")
        
        attempt += 1
        if attempt <= max_retries:
            logger.info(f"Retrying scraping in {backoff} seconds...")
            time.sleep(backoff)
            backoff *= 2
            
    return ("", None)