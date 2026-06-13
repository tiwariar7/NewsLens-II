import requests
import json

# Register and Login
requests.post("http://localhost:5000/signup", json={"name": "testchat", "email": "testchat@example.com", "password": "password123"})
res = requests.post("http://localhost:5000/login", json={"email": "testchat@example.com", "password": "password123"})
token = res.json().get('token')
print("Token:", token[:10] if token else "None")

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Give it 1 fake article
fake_article = [{
    "title": "Titanic submarine implosion confirmed",
    "description": "The titanic submarine imploded, ending the search.",
    "content": "The titanic submarine imploded due to pressure.",
    "url": "http://fake.com",
    "source": {"name": "Fake News"}
}]

# POST to /chat with context_articles
payload = {
    "query": "What happened to the Titanic submarine?",
    "context_articles": fake_article
}

print("Testing /chat...")
try:
    res2 = requests.post("http://localhost:5000/chat", json=payload, headers=headers, stream=True, timeout=10)
    print("Status:", res2.status_code)
    for line in res2.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print("Error:", e)
