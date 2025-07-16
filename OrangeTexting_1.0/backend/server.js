const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Serve frontend
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// Ensure messages.json exists
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '{}');

function loadMessages() {
  return JSON.parse(fs.readFileSync(MESSAGES_FILE));
}

function saveMessages(data) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
}

io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId }) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size >= 100) {
      socket.emit('room-full');
      return;
    }
    socket.join(roomId);
    currentRoom = roomId;

    const messages = loadMessages();
    if (messages[roomId]) {
      messages[roomId].forEach(msg => {
        socket.emit('receive-message', msg.encrypted);
      });
    }
  });

  socket.on('send-message', encrypted => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length === 0) return;
    const roomId = rooms[0];

    const messages = loadMessages();
    if (!messages[roomId]) messages[roomId] = [];
    messages[roomId].push({
      encrypted,
      timestamp: Date.now()
    });
    saveMessages(messages);

    socket.to(roomId).emit('receive-message', encrypted);
    socket.emit('receive-message', encrypted);
  });

  socket.on('typing', data => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

app.get('/history/:roomId', (req, res) => {
  const messages = loadMessages();
  const roomId = req.params.roomId;
  res.json(messages[roomId] || []);
});

http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
