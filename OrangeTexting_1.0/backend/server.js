const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Decode Firebase service account key from base64 env variable
const serviceAccountJson = Buffer.from(process.env.FIREBASE_KEY_B64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

// Initialize Firebase admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Serve frontend files statically from ../frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// REST API to get chat history for a room
app.get('/history/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const snapshot = await db.collection('messages')
      .doc(roomId)
      .collection('chats')
      .orderBy('timestamp')
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      messages.push(doc.data());
    });

    res.json(messages);
  } catch (error) {
    console.error('Failed to fetch chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', async ({ roomId }) => {
    currentRoom = roomId;
    socket.join(roomId);

    try {
      const snapshot = await db.collection('messages')
        .doc(roomId)
        .collection('chats')
        .orderBy('timestamp')
        .get();

      snapshot.forEach(doc => {
        socket.emit('receive-message', doc.data());
      });
    } catch (error) {
      console.error(`Failed to load chat history for room ${roomId}:`, error);
    }
  });

  socket.on('send-message', async (msgData) => {
    if (!currentRoom) return;

    try {
      // Overwrite timestamp to ensure consistency server-side
      const savedData = { ...msgData, timestamp: Date.now() };

      await db.collection('messages')
        .doc(currentRoom)
        .collection('chats')
        .add(savedData);

      // Broadcast saved message with timestamp to all clients in the room
      io.to(currentRoom).emit('receive-message', savedData);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('typing', data => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });

  socket.on('disconnect', () => {
    currentRoom = null;
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
