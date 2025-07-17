const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const MESSAGE_FILE = path.join(__dirname, 'messages.json');

// Ensure messages file exists
if (!fs.existsSync(MESSAGE_FILE)) fs.writeFileSync(MESSAGE_FILE, '[]');

// Static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

app.get('/history', (req, res) => {
  const data = fs.readFileSync(MESSAGE_FILE);
  res.json(JSON.parse(data));
});

io.on('connection', socket => {
  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on('send-message', msg => {
    // Save to file
    const data = JSON.parse(fs.readFileSync(MESSAGE_FILE));
    data.push(msg);
    fs.writeFileSync(MESSAGE_FILE, JSON.stringify(data, null, 2));
    
    io.emit('receive-message', msg);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
