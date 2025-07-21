const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

let history = [];

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('chat message', (msg) => {
    history.push(msg);
    io.emit('chat message', msg);
    fs.writeFileSync('chat_history.json', JSON.stringify(history, null, 2));
  });
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.get('/history', (req, res) => {
  try {
    const data = fs.readFileSync('chat_history.json', 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.json([]);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
