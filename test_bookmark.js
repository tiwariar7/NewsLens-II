const http = require('http');

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const bodyStr = JSON.stringify({ email: "tiwariar@rknec.edu", password: "test123" });

  // 1. Login
  console.log("=== Testing Login ===");
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
  }, bodyStr);

  console.log("Login status:", loginRes.status);
  console.log("Login body:", JSON.stringify(loginRes.body).slice(0, 200));

  if (loginRes.status !== 200) {
    console.log("Login failed, trying to get articles without auth first...");
    // Try fetching news articles to see what IDs exist
    const newsBody = JSON.stringify({ email: "tiwariar@rknec.edu", category: null, page: 1 });
    const newsRes = await httpRequest({
      hostname: 'localhost', port: 5000, path: '/news', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(newsBody) }
    }, newsBody);
    console.log("News status:", newsRes.status);
    return;
  }

  const token = loginRes.body.token;
  console.log("Got token:", token ? "YES" : "NO");

  // 2. Fetch news to get a valid article ID
  console.log("\n=== Fetching News ===");
  const newsBody = JSON.stringify({ email: "tiwariar@rknec.edu", category: null, page: 1 });
  const newsRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/news', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(newsBody), 'Authorization': `Bearer ${token}` }
  }, newsBody);

  console.log("News status:", newsRes.status);
  const articles = newsRes.body.articles || [];
  console.log("Articles count:", articles.length);

  if (!articles.length) {
    console.log("No articles yet — bookmarking not possible without articles in DB.");
    return;
  }

  const firstArticle = articles[0];
  console.log("First article ID:", firstArticle.id, "| Title:", firstArticle.title?.slice(0, 60));

  // 3. Bookmark the first article
  console.log("\n=== Adding Bookmark ===");
  const bmBody = JSON.stringify({ article_id: firstArticle.id });
  const bmRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/bookmarks', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bmBody), 'Authorization': `Bearer ${token}` }
  }, bmBody);

  console.log("Bookmark POST status:", bmRes.status);
  console.log("Bookmark POST body:", bmRes.body);

  // 4. Fetch bookmarks
  console.log("\n=== Fetching Bookmarks ===");
  const getRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/bookmarks?page=1', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log("GET Bookmarks status:", getRes.status);
  console.log("Bookmarks count:", getRes.body.articles?.length);
}

main().catch(console.error);
