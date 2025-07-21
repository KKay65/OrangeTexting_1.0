// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const messages = [];

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadDir));

let userMap = {}; // socket.id -> username

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('init', messages);

  socket.on('setUsername', (username) => {
    userMap[socket.id] = username || 'Anonymous';
  });

  socket.on('chat message', (text) => {
    const msg = {
      user: userMap[socket.id] || 'Anonymous',
      text,
      type: 'text',
      timestamp: Date.now()
    };
    messages.push(msg);
    io.emit('chat message', msg);
  });

  socket.on('image message', (imageUrl) => {
    const msg = {
      user: userMap[socket.id] || 'Anonymous',
      image: imageUrl,
      type: 'image',
      timestamp: Date.now()
    };
    messages.push(msg);
    io.emit('image message', msg);
  });

  socket.on('disconnect', () => {
    delete userMap[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = '/uploads/' + req.file.filename;
  res.json({ imageUrl });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
