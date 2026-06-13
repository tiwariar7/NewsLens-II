import requests

login_res = requests.post('http://localhost:5000/login', json={'email': 'test@example.com', 'password': 'password123'})
if login_res.status_code != 200:
    print('Login failed:', login_res.json())
else:
    token = login_res.json()['token']
    
    headers = {'Authorization': f'Bearer {token}'}
    res = requests.post('http://localhost:5000/historical-search', json={'query': 'Titanic submarine implosion', 'mode': 'historical'}, headers=headers)
    print("Status:", res.status_code)
    data = res.json()
    if 'articles' in data:
        print(f"Found {len(data['articles'])} articles.")
        for a in data['articles']:
            print(f"[{a.get('tier_label')}] {a.get('title')} - {a.get('source')}")
    else:
        print(data)
