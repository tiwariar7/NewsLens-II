import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def generate_rag_response_stream(query, context_articles):
    """
    context_articles: list of dicts from execute_hybrid_search
    Yields chunks of the LLM response in SSE format.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "dummy_key_replace_me":
        yield f"data: {json.dumps({'error': 'GEMINI_API_KEY not configured. Cannot generate AI response.'})}\n\n"
        yield f"data: [DONE]\n\n"
        return

    context_text = ""
    for i, article in enumerate(context_articles):
        title = article.get('title', 'Unknown')
        source = article.get('source_name', 'Unknown')
        url = article.get('url', '#')
        content = article.get('content', '')[:1000] # Limit to 1000 chars per article
        context_text += f"\n[Article {i+1}]\nTitle: {title}\nSource: {source}\nURL: {url}\nContent Snippet: {content}\n"
    
    prompt = f"""You are NewsLens AI, a helpful, objective, and concise news assistant.
The user asked: "{query}"

Please answer the user's question based strictly on the following context articles. 
If the context doesn't contain the answer, simply say that you couldn't find the information in the recent news.
Do not hallucinate facts.

Use markdown for formatting. Make it conversational and easy to read.
Important: Whenever you use information from an article, add an inline citation using the [Article X] format.

Context:
{context_text}
"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt, stream=True)
        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
        yield f"data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Gemini RAG generation call failed: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: [DONE]\n\n"
