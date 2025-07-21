const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- STATIC SETUP ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// --- IMAGE UPLOAD HANDLING ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = Date.now() + ext;
    cb(null, filename);
  }
});

const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// --- SOCKET HANDLING ---
let messageHistory = [];

io.on('connection', (socket) => {
  console.log('User connected');

  // Send history on connect
  socket.emit('load history', messageHistory);

  socket.on('chat message', (msg) => {
    messageHistory.push(msg);
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// --- ROOT TEST ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

// --- START SERVER ---
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
