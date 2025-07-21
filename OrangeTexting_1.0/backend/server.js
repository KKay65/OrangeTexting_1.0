const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory history per room (persisted to disk optionally)
let histories = {};

// Load from disk if desired
const historyDir = path.join(__dirname, 'history');
if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir);

function loadRoom(roomId) {
  const file = path.join(historyDir, `${roomId}.json`);
  if (fs.existsSync(file)) {
    try {
      histories[roomId] = JSON.parse(fs.readFileSync(file));
    } catch { histories[roomId] = []; }
  } else histories[roomId] = [];
}

function saveRoom(roomId) {
  const file = path.join(historyDir, `${roomId}.json`);
  fs.writeFileSync(file, JSON.stringify(histories[roomId], null, 2));
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId }) => {
    currentRoom = roomId;
    socket.join(roomId);
    if (!histories[roomId]) loadRoom(roomId);
    histories[roomId].forEach(msg => {
      socket.emit('receive-message', msg);
    });
  });

  socket.on('send-message', (msg) => {
    if (!currentRoom) return;
    const message = {
      user: msg.user,
      text: msg.text || '',
      imageData: msg.imageData || null,
      timestamp: Date.now()
    };
    histories[currentRoom].push(message);
    saveRoom(currentRoom);
    io.to(currentRoom).emit('receive-message', message);
  });

  socket.on('disconnect', () => {
    currentRoom = null;
  });
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
