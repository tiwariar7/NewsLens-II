const http = require('http');
http.get('http://localhost:3000/dashboard', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("STATUS:", res.statusCode);
    console.log("Includes 'Bookmarks'?", data.includes('Bookmarks'));
    console.log("Includes 'bookmarks'?", data.includes('/bookmarks'));
    // print first 500 chars of the body
    console.log("BODY SNIPPET:", data.slice(0, 800));
  });
}).on('error', err => console.log("ERR:", err.message));
