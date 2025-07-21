const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'messages.json');
let messages = [];

// Load existing messages
if (fs.existsSync(DATA_FILE)) {
  messages = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Chat history API
app.get('/history', (req, res) => {
  res.json(messages);
});

// Socket.io
io.on('connection', socket => {
  socket.on('join-room', room => {
    socket.join(room);
  });

  socket.on('send-message', msg => {
    const message = {
      ...msg,
      timestamp: Date.now()
    };
    messages.push(message);
    io.to('main-room').emit('receive-message', message);
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages.slice(-100), null, 2)); // keep last 100
  });
});

// Fallback route for undefined paths
app.use((req, res) => {
  res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
