const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const historyFile = path.join(__dirname, '../frontend/history.json');

// Ensure history file exists
if (!fs.existsSync(historyFile)) {
  fs.writeFileSync(historyFile, '[]');
}

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve chat page by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

// Serve history page
app.get('/history', (req, res) => {
  fs.readFile(historyFile, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error reading history.');
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('send-message', (msg) => {
    if (!msg || !msg.user || (!msg.text && !msg.imageData)) return;

    msg.timestamp = msg.timestamp || Date.now();

    // Load existing history, append new msg, save last 100
    fs.readFile(historyFile, 'utf8', (err, data) => {
      const arr = err ? [] : JSON.parse(data || '[]');
      arr.push(msg);
      while (arr.length > 100) arr.shift(); // keep max 100 messages
      fs.writeFile(historyFile, JSON.stringify(arr, null, 2), () => {});
    });

    // Broadcast message to all clients
    io.emit('receive-message', msg);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
