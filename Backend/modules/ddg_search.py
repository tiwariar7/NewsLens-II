import time
import random
import logging
from urllib.parse import urlparse
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

# ============================================================
# TIER 1 — HIGH TRUST / FACT-FIRST SOURCES
# ============================================================
TIER_1_SOURCES = [
    "reuters.com", "apnews.com", "afp.com", "bloomberg.com",
    "bbc.com", "bbc.co.uk", "dw.com", "france24.com",
    "ft.com", "wsj.com", "economist.com",
    "thehindu.com", "indianexpress.com",
    "nikkei.com", "straitstimes.com", "channelnewsasia.com",
    "cbc.ca", "abc.net.au", "swissinfo.ch"
]

# ============================================================
# TIER 2 — MAJOR NATIONAL NEWS ORGANIZATIONS
# ============================================================
TIER_2_SOURCES = [
    "timesofindia.indiatimes.com", "hindustantimes.com", "ndtv.com",
    "indiatoday.in", "news18.com", "theprint.in", "deccanherald.com",
    "livemint.com", "business-standard.com", "financialexpress.com",
    "newindianexpress.com", "aninews.in", "outlookindia.com",
    "firstpost.com", "moneycontrol.com", "telegraphindia.com",
    "washingtonpost.com", "nytimes.com", "cnn.com", "usatoday.com",
    "abcnews.go.com", "cbsnews.com", "nbcnews.com", "npr.org", "politico.com", "axios.com",
    "theguardian.com", "independent.co.uk", "telegraph.co.uk", "standard.co.uk",
    "euronews.com", "elpais.com", "lemonde.fr", "spiegel.de", "corriere.it",
    "globalnews.ca", "ctvnews.ca",
    "smh.com.au", "theage.com.au", "news.com.au",
    "nzherald.co.nz", "stuff.co.nz",
    "aljazeera.com", "arabnews.com", "thenationalnews.com", "jordantimes.com",
    "scmp.com", "japantimes.co.jp", "koreatimes.co.kr", "koreaherald.com",
    "bangkokpost.com", "jakartapost.com", "philstar.com",
    "allafrica.com", "mg.co.za", "news24.com",
    "batimes.com.ar", "brazilreports.com", "folha.uol.com.br", "oglobo.globo.com"
]

GOVERNMENT_SOURCES = [
    ".gov", ".gov.in", ".europa.eu", "who.int", "un.org",
    "worldbank.org", "imf.org", "nasa.gov", "cdc.gov", "nih.gov"
]

def get_source_tier(url):
    domain = urlparse(url).netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
        
    for t1 in TIER_1_SOURCES:
        if domain == t1 or domain.endswith(f".{t1}"):
            return 1, "Tier 1"
            
    for t2 in TIER_2_SOURCES:
        if domain == t2 or domain.endswith(f".{t2}"):
            return 2, "Tier 2"
            
    for gov in GOVERNMENT_SOURCES:
        if domain.endswith(gov):
            return 1, "Government"
            
    return 3, "Tier 3"

def fetch_historical_search(query, max_results=10, search_mode="historical"):
    """
    Fetches top 50 results from DDG, ranks by Source Tier, and returns top `max_results`.
    search_mode: "historical", "research", or "recent"
    """
    try:
        # Respect DDG rate limits
        time.sleep(random.uniform(1, 2))
        
        # Modify query based on mode
        ddg_query = query
        if search_mode == "research":
            ddg_query = f"{query} history OR research OR study"
            
        with DDGS() as ddgs:
            results = [r for r in ddgs.text(ddg_query, max_results=50)]
            
        if not results:
            raise Exception("No results found from DDG text, forcing fallback.")
            
        ranked_results = []
        for r in results:
            url = r.get('href')
            if not url:
                continue
                
            tier_score, tier_label = get_source_tier(url)
            
            ranked_results.append({
                "title": r.get('title', ''),
                "url": url,
                "description": r.get('body', ''),
                "source": urlparse(url).netloc,
                "tier_score": tier_score,
                "tier_label": tier_label,
                "publishedAt": None # DDG text doesn't explicitly return dates, extraction happens on scrape
            })
            
        # Sort by tier (1 is best), keeping original DDG rank within same tier
        ranked_results.sort(key=lambda x: x["tier_score"])
        
        # If we have enough high-quality Tier 1/2 results, filter out Tier 3
        top_tier_only = [r for r in ranked_results if r["tier_score"] <= 2]
        
        if len(top_tier_only) > 0:
            final_results = top_tier_only[:max_results]
        else:
            final_results = ranked_results[:max_results]
            
        if not final_results:
            raise Exception("No results found from DDG, forcing fallback.")
            
        return final_results
        
    except Exception as e:
        logger.warning(f"DDG Search failed or empty for '{query}', falling back to Google News RSS: {e}")
        from modules.rss_ingest import fetch_google_news_rss
        rss_result = fetch_google_news_rss(query)
        articles = rss_result.get('articles', [])
        
        fallback_results = []
        for art in articles:
            tier_score, tier_label = get_source_tier(art.get('url', ''))
            fallback_results.append({
                "title": art.get('title', ''),
                "url": art.get('url', ''),
                "description": art.get('description', ''),
                "source": urlparse(art.get('url', '')).netloc,
                "tier_score": tier_score,
                "tier_label": tier_label,
                "publishedAt": art.get('publishedAt')
            })
            
        fallback_results.sort(key=lambda x: x["tier_score"])
        return fallback_results[:max_results]
