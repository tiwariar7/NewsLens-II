import logging
import google.generativeai as genai
from sqlalchemy import func, or_
from models import db, Article

logger = logging.getLogger(__name__)

def generate_query_embedding(query_text):
    """
    Generates embedding vector for the search query using Gemini gemini-embedding-001.
    """
    try:
        response = genai.embed_content(
            model="models/gemini-embedding-001",
            content=query_text,
            task_type="retrieval_query",
            output_dimensionality=768
        )
        return response.get('embedding')
    except Exception as e:
        logger.error(f"Error generating query embedding: {e}")
        return None

def parse_ts_query(query_text):
    """
    Cleans and prepares standard text queries into a formatted tsquery string.
    Example: 'market shifts' -> 'market & shifts'
    """
    words = [w.strip() for w in query_text.split() if w.strip()]
    cleaned_words = [f"{w}:*" for w in words]  # Prefix matching
    return ' & '.join(cleaned_words) if cleaned_words else ""

def execute_hybrid_search(query_text, limit=20, page=1):
    """
    Executes a hybrid search combining PostgreSQL Full-Text Search (lexical)
    and pgvector cosine distance (semantic) using Reciprocal Rank Fusion (RRF).
    """
    if not query_text:
        return {"articles": [], "totalResults": 0}
        
    offset = (page - 1) * limit
    
    # 1. Lexical Search (Full Text Search)
    fts_query_str = parse_ts_query(query_text)
    lexical_results = []
    if fts_query_str:
        try:
            # Query articles matching the tsquery and get ranks
            fts_query = db.session.query(
                Article.id,
                func.ts_rank(Article.fts_document, func.to_tsquery('english', fts_query_str)).label('rank')
            ).filter(
                Article.fts_document.op('@@')(func.to_tsquery('english', fts_query_str))
            ).order_by(
                func.ts_rank(Article.fts_document, func.to_tsquery('english', fts_query_str)).desc()
            ).limit(100).all()
            
            lexical_results = [r[0] for r in fts_query]
        except Exception as e:
            logger.error(f"Postgres Lexical FTS search failed: {e}")

    # 2. Semantic Search (pgvector)
    semantic_results = []
    query_vector = generate_query_embedding(query_text)
    if query_vector:
        try:
            # Query using pgvector cosine distance (<=>)
            vector_query = db.session.query(
                Article.id,
                Article.embedding.cosine_distance(query_vector).label('distance')
            ).filter(
                Article.embedding.isnot(None)
            ).order_by(
                'distance'
            ).limit(100).all()
            
            semantic_results = [r[0] for r in vector_query]
        except Exception as e:
            logger.error(f"Postgres pgvector similarity search failed: {e}")

    # 3. Reciprocal Rank Fusion (RRF)
    # RRF Score = sum(1 / (k + rank))
    # We use standard k = 60
    k = 60
    rrf_scores = {}
    
    # Rank mapping (1-indexed)
    for rank, art_id in enumerate(lexical_results, start=1):
        rrf_scores[art_id] = rrf_scores.get(art_id, 0.0) + (1.0 / (k + rank))
        
    for rank, art_id in enumerate(semantic_results, start=1):
        rrf_scores[art_id] = rrf_scores.get(art_id, 0.0) + (1.0 / (k + rank))

    # Sort merged list by RRF score descending
    sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
    
    total_results = len(sorted_ids)
    paginated_ids = sorted_ids[offset:offset+limit]
    
    if not paginated_ids:
        return {"articles": [], "totalResults": 0}
        
    # Fetch actual Article records in the specific sorted order
    # To preserve RRF order in PostgreSQL query, we construct case-when mapping or sort in Python
    articles_db = Article.query.filter(Article.id.in_(paginated_ids)).all()
    articles_map = {art.id: art for art in articles_db}
    
    final_articles = []
    for art_id in paginated_ids:
        if art_id in articles_map:
            final_articles.append(articles_map[art_id].as_dict())
            
    return {
        "articles": final_articles,
        "totalResults": total_results,
        "page": page
    }
