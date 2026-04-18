const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.argv[2] || '8765');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relativePath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  let targetPath = path.join(root, relativePath);

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    if (!path.extname(targetPath)) {
      targetPath = path.join(root, 'index.html');
    }
  }

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(targetPath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(targetPath);

  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
});

server.listen(port, '127.0.0.1');
