const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const historyFile = path.join(__dirname, 'history.json');

// Load message history
let history = [];
if (fs.existsSync(historyFile)) {
  try {
    const data = fs.readFileSync(historyFile, 'utf-8');
    history = JSON.parse(data);
  } catch (e) {
    console.error("Error reading history file:", e);
  }
}

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve chat.html by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

// Serve history.html
app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/history.html'));
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join-room', ({ roomId }) => {
    if (roomId) {
      socket.join(roomId);
      console.log(`Client joined room: ${roomId}`);
      // Send existing history
      history.forEach(msg => {
        socket.to(roomId).emit('receive-message', msg);
      });
    }
  });

  socket.on('send-message', (msg) => {
    if (!msg || !msg.user || (!msg.text && !msg.imageData)) {
      return console.warn("Invalid message received:", msg);
    }

    // Add timestamp server-side if not present
    msg.timestamp = msg.timestamp || Date.now();

    // Prevent duplicate message IDs by hash (optional)
    history.push(msg);

    // Save updated history
    try {
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    } catch (err) {
      console.error("Error saving history:", err);
    }

    // Broadcast to all clients
    io.emit('receive-message', msg);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
