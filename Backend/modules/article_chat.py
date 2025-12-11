import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def generate_article_chat_stream(content, title, query):
    """
    Streams a chat response based specifically on a single article's context.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "dummy_key_replace_me":
        yield f"data: {json.dumps({'error': 'GEMINI_API_KEY not configured. Cannot generate AI response.'})}\n\n"
        yield f"data: [DONE]\n\n"
        return

    # Limit content length to fit inside context window comfortably
    content_snippet = content[:8000]

    prompt = f"""You are NewsLens AI, a helpful and intelligent news assistant.
The user is asking a question specifically about the following article.

Article Title: {title}
Article Content: 
{content_snippet}

User's Question: "{query}"

Answer the user's question based strictly on the article content provided above. 
If the article does not contain the answer, politely inform the user that the information is not in the article.
Use markdown for formatting to make the answer easy to read.
"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt, stream=True)
        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
        yield f"data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Gemini Article Chat generation call failed: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: [DONE]\n\n"
