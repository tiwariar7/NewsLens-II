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

function streamRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`Stream status: ${res.statusCode}`);
      res.on('data', chunk => {
        process.stdout.write(chunk.toString());
      });
      res.on('end', () => {
        console.log('\nStream completed.');
        resolve();
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const credentials = JSON.stringify({ email: "tiwariar@rknec.edu", password: "test123" });

  console.log("=== 1. Logging In ===");
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(credentials) }
  }, credentials);

  if (loginRes.status !== 200) {
    console.error("Login failed:", loginRes.body);
    return;
  }
  const token = loginRes.body.token;
  console.log("Login success! Token acquired.\n");

  console.log("=== 2. Fetching Curated Feed ===");
  const feedBody = JSON.stringify({ category: null, page: 1 });
  const feedRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/news', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(feedBody), 'Authorization': `Bearer ${token}` }
  }, feedBody);

  const articles = feedRes.body.articles || [];
  console.log(`Feed status: ${feedRes.status}`);
  console.log(`Total Curated Articles (totalResults): ${feedRes.body.totalResults}`);
  console.log(`Articles returned on Page 1: ${articles.length}`);
  
  if (articles.length === 0) {
    console.log("No articles found in DB to test summarization/chat.");
    return;
  }

  const article = articles[2];
  console.log(`Target Article Title: "${article.title}"`);
  console.log(`Target Article URL: "${article.url}"\n`);

  console.log("=== 3. Testing Hugging Face Summarizer (/summarize) ===");
  const sumBody = JSON.stringify({ article_url: article.url });
  const sumRes = await httpRequest({
    hostname: 'localhost', port: 5000, path: '/summarize', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(sumBody), 'Authorization': `Bearer ${token}` }
  }, sumBody);

  console.log(`Summarize status: ${sumRes.status}`);
  console.log("Summary details:", JSON.stringify(sumRes.body, null, 2));
  console.log("\n");

  console.log("=== 4. Testing Ask AI Stream (/article-chat) ===");
  const chatBody = JSON.stringify({ article_url: article.url, query: "Summarize this article in 1 short sentence." });
  await streamRequest({
    hostname: 'localhost', port: 5000, path: '/article-chat', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(chatBody), 'Authorization': `Bearer ${token}` }
  }, chatBody);
}

main().catch(console.error);
