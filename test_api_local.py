import requests
import json

# Login
requests.post("http://localhost:5000/signup", json={"name": "test2", "email": "test2@example.com", "password": "password123"})
res = requests.post("http://localhost:5000/login", json={"email": "test2@example.com", "password": "password123"})

token = res.json().get('token')

headers = {"Authorization": f"Bearer {token}"}
res2 = requests.post("http://localhost:5000/historical-search", json={"query": "Titanic submarine implosion", "mode": "historical"}, headers=headers)

data = res2.json()
print("Found:", len(data.get('articles', [])))
for art in data.get('articles', []):
    print(f"[{art.get('tier_label')}] {art.get('title')} ({art.get('source')})")
