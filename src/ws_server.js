const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const WebSocket = require('ws');

const port = 8080;
const wsPort = 8081;
const rootDir = process.argv[2] || '.';

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = path.join(rootDir, parsedUrl.pathname);

  fs.stat(pathname, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.end(`File ${pathname} not found!`);
      return;
    }

    if (stats.isDirectory()) {
      pathname = path.join(pathname, 'index.html');
    }

    fs.readFile(pathname, (err, data) => {
      if (err) {
        res.statusCode = 500;
        res.end(`Error getting the file: ${err}.`);
      } else {
        res.end(data);
      }
    });
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const wss = new WebSocket.Server({ port: wsPort });

wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('message', message => {
    console.log(`Received message: ${message}`);
    // Senden Sie die Nachricht als Text
    const text = message.toString(); // Konvertieren Sie das Nachricht-Blob in einen Textstring
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ content: text }));
        console.log('Message sent back to client');
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`WebSocket server running on ws://localhost:${wsPort}`);
