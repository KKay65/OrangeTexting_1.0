const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

// Store messages per room in memory for demo (replace with DB in production)
const rooms = {};

io.on('connection', socket => {
  socket.on('join-room', room => {
    socket.join(room);
    rooms[room] = rooms[room] || [];
    rooms[room].forEach(msg => socket.emit('receive-message', msg));
  });

  socket.on('send-message', msg => {
    if (!msg.user || (!msg.text && !msg.imageData)) return;
    msg.timestamp = Date.now();
    const room = Array.from(socket.rooms)[1];
    if (!room) return;
    rooms[room].push(msg);
    io.to(room).emit('receive-message', msg);
  });
});

server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
