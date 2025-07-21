const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

let messages = [];

io.on('connection', (socket) => {
  console.log('A user connected.');

  socket.on('setUsername', (username) => {
    socket.username = username;
    socket.emit('init', messages);
  });

  socket.on('chat message', (msg) => {
    const data = {
      user: socket.username || 'Anonymous',
      text: msg,
      type: 'text',
      timestamp: Date.now(),
    };
    messages.push(data);
    io.emit('chat message', data);
  });

  socket.on('image message', (imageUrl) => {
    const data = {
      user: socket.username || 'Anonymous',
      image: imageUrl,
      type: 'image',
      timestamp: Date.now(),
    };
    messages.push(data);
    io.emit('image message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.get('/history', (req, res) => {
  res.json(messages);
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
