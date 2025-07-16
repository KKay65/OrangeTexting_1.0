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

// Serve static frontend files (chat.html, history.html) from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// REST endpoint for fetching chat history of a room
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
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

io.on('connection', socket => {
  let currentRoom = null;

  // Handle joining a chat room
  socket.on('join-room', async ({ roomId }) => {
    currentRoom = roomId;
    socket.join(roomId);

    try {
      // Load previous messages and send them to the client
      const snapshot = await db.collection('messages')
        .doc(roomId)
        .collection('chats')
        .orderBy('timestamp')
        .get();

      snapshot.forEach(doc => {
        socket.emit('receive-message', doc.data());
      });
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  });

  // Handle new messages
  socket.on('send-message', async (msgData) => {
    if (!currentRoom) return;

    try {
      // Save message with current timestamp (overwrite msgData.timestamp for consistency)
      const savedData = { ...msgData, timestamp: Date.now() };
      await db.collection('messages')
        .doc(currentRoom)
        .collection('chats')
        .add(savedData);

      // Broadcast saved message to room clients (use savedData with updated timestamp)
      io.to(currentRoom).emit('receive-message', savedData);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
