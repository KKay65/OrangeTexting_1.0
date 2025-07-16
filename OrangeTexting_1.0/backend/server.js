const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Firebase admin init
const serviceAccountJson = Buffer.from(process.env.FIREBASE_KEY_B64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

// === STATIC FILES (point to frontend from backend) ===
app.use(express.static(path.join(__dirname, '../frontend')));

// === ROOT HOMEPAGE ===
app.get('/', (req, res) => {
  res.send(`
    <h1>OrangeTexting</h1>
    <p><a href="/chat.html?room=test-room">Go to Chat</a></p>
    <p><a href="/history.html">View History</a></p>
  `);
});

// === SOCKET.IO ===
io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', async ({ roomId }) => {
    socket.join(roomId);
    currentRoom = roomId;

    try {
      const snapshot = await db.collection('messages')
        .doc(roomId)
        .collection('chats')
        .orderBy('timestamp')
        .get();

      snapshot.forEach(doc => {
        socket.emit('receive-message', doc.data());
      });
    } catch (err) {
      console.error('Error loading room history:', err);
    }
  });

  socket.on('send-message', async (data) => {
    if (!currentRoom) return;

    try {
      await db.collection('messages')
        .doc(currentRoom)
        .collection('chats')
        .add({ ...data, timestamp: Date.now() });

      io.to(currentRoom).emit('receive-message', data);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('typing', (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

// === HISTORY API ===
app.get('/history/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    const snapshot = await db.collection('messages')
      .doc(roomId)
      .collection('chats')
      .orderBy('timestamp')
      .get();

    const messages = [];
    snapshot.forEach(doc => messages.push(doc.data()));
    res.json(messages);
  } catch (err) {
    console.error('Error loading history:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// === START SERVER ===
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
