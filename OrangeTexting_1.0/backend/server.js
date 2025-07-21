const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: path.join(__dirname, 'uploads/') });
const chatLogs = {};

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

io.on('connection', (socket) => {
  const { room = 'default', username = 'Anonymous' } = socket.handshake.query;

  socket.join(room);
  if (!chatLogs[room]) chatLogs[room] = [];

  socket.emit('init', chatLogs[room]);

  socket.on('chat message', text => {
    const msg = { type: 'text', user: username, text, timestamp: Date.now() };
    chatLogs[room].push(msg);
    io.to(room).emit('chat message', msg);
  });

  socket.on('image message', imageUrl => {
    const msg = { type: 'image', user: username, image: imageUrl, timestamp: Date.now() };
    chatLogs[room].push(msg);
    io.to(room).emit('image message', msg);
  });
});

app.post('/upload', upload.single('image'), (req, res) => {
  const ext = path.extname(req.file.originalname);
  const newPath = path.join(__dirname, 'uploads', req.file.filename + ext);
  fs.renameSync(req.file.path, newPath);
  const imageUrl = `/uploads/${req.file.filename}${ext}`;
  res.json({ imageUrl });
});

app.get('/history/:room', (req, res) => {
  const room = req.params.room;
  res.json(chatLogs[room] || []);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
