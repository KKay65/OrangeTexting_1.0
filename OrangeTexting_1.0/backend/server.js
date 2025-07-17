const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const historyFile = path.join(__dirname, 'chat_history.json');
let chatHistory = [];

// Load history from file
if (fs.existsSync(historyFile)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch (err) {
    console.error("Failed to load chat history:", err);
  }
}

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json({ limit: '10mb' })); // for image data

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

app.get('/history', (req, res) => {
  res.json(chatHistory);
});

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on('send-message', (msg) => {
    if (msg && (msg.text || msg.imageData)) {
      chatHistory.push(msg);
      io.emit('receive-message', msg);
      fs.writeFile(historyFile, JSON.stringify(chatHistory.slice(-500)), err => {
        if (err) console.error("Failed to save chat history:", err);
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
