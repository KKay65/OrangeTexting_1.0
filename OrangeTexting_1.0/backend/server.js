const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const admin = require('firebase-admin');

const PORT = process.env.PORT || 3000;

// === FIREBASE INITIALIZATION ===
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messagesRef = db.collection('messages');

// === STATIC FRONTEND ===
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// === SOCKET.IO HANDLING ===
io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', async ({ roomId }) => {
    socket.join(roomId);
    currentRoom = roomId;

    // Load message history from Firestore
    const snapshot = await messagesRef.where('room', '==', roomId).orderBy('timestamp').get();
    snapshot.forEach(doc => {
      socket.emit('receive-message', doc.data().encrypted);
    });
  });

  socket.on('send-message', async encrypted => {
    if (!currentRoom) return;

    // Save message to Firestore
    await messagesRef.add({
      room: currentRoom,
      encrypted,
      timestamp: Date.now()
    });

    // Broadcast to others
    socket.to(currentRoom).emit('receive-message', encrypted);
    socket.emit('receive-message', encrypted); // echo to self
  });

  socket.on('typing', data => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

// === REST API: HISTORY ===
app.get('/history/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  const snapshot = await messagesRef.where('room', '==', roomId).orderBy('timestamp').get();

  const result = [];
  snapshot.forEach(doc => result.push(doc.data()));
  res.json(result);
});

// === START SERVER ===
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
