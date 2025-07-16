const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Decode Firebase service account key
const serviceAccountJson = Buffer.from(process.env.FIREBASE_KEY_B64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Serve static frontend files (chat.html, history.html)
app.use(express.static(path.join(__dirname, '../frontend')));

// REST endpoint for fetching chat history
app.get('/history/:roomId', async (req, res) => {
  try {
    const snapshot = await db.collection('messages')
      .doc(req.params.roomId)
      .collection('chats')
      .orderBy('timestamp')
      .get();

    const messages = [];
    snapshot.forEach(doc => messages.push(doc.data()));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', async ({ roomId }) => {
    socket.join(roomId);
    currentRoom = roomId;

    // Send previous messages
    const snapshot = await db.collection('messages')
      .doc(roomId)
      .collection('chats')
      .orderBy('timestamp')
      .get();

    snapshot.forEach(doc => {
      socket.emit('receive-message', doc.data());
    });
  });

  socket.on('send-message', async (msgData) => {
    if (!currentRoom) return;

    try {
      await db.collection('messages')
        .doc(currentRoom)
        .collection('chats')
        .add({ ...msgData, timestamp: Date.now() });

      io.to(currentRoom).emit('receive-message', msgData);
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

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
