const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Firebase service key setup
const serviceAccountJson = Buffer.from(process.env.FIREBASE_KEY_B64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

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
        const { encrypted } = doc.data();
        socket.emit('receive-message', encrypted);
      });
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  });

  socket.on('send-message', async (encrypted) => {
    if (!currentRoom) return;

    try {
      await db.collection('messages')
        .doc(currentRoom)
        .collection('chats')
        .add({ encrypted, timestamp: Date.now() });
    } catch (err) {
      console.error('Failed to save message:', err);
    }

    io.to(currentRoom).emit('receive-message', encrypted);
  });

  socket.on('typing', (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

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
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
