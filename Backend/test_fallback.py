import sys
import os
import logging
logging.basicConfig(level=logging.INFO)
sys.path.append('/app')

from modules.ddg_search import fetch_historical_search

results = fetch_historical_search('Titanic submarine implosion', max_results=10, search_mode='historical')
print('FOUND:', len(results))
for r in results:
    print(f"[{r.get('tier_label')}] {r.get('title')} ({r.get('source')})")
