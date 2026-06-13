import sys
import os

# Add Backend to path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'Backend'))

from modules.ddg_search import fetch_historical_search

query = "Titanic submarine implosion"
print(f"Testing DDG search for: {query}")

results = fetch_historical_search(query, max_results=10, search_mode="historical")

print(f"\nFound {len(results)} results:")
for i, r in enumerate(results):
    print(f"{i+1}. [{r.get('tier_label')}] {r.get('title')} ({r.get('source')})")
