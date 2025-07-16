const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const admin = require('firebase-admin');
const PORT = process.env.PORT || 3000;

// Initialize Firebase
const serviceAccount = require('./firebaseKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messagesRef = db.collection('rooms');

// Serve frontend
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// WebSocket logic
io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', async ({ roomId }) => {
    socket.join(roomId);
    currentRoom = roomId;

    // Load history from Firestore
    const roomDoc = await messagesRef.doc(roomId).get();
    const data = roomDoc.data();
    const history = data?.messages || [];

    history.forEach(entry => {
      socket.emit('receive-message', entry.encrypted);
    });
  });

  socket.on('send-message', async encrypted => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length === 0) return;
    const roomId = rooms[0];

    // Save to Firestore
    const roomDoc = messagesRef.doc(roomId);
    const existing = (await roomDoc.get()).data()?.messages || [];
    existing.push({ encrypted, timestamp: Date.now() });
    await roomDoc.set({ messages: existing });

    socket.to(roomId).emit('receive-message', encrypted);
    socket.emit('receive-message', encrypted);
  });

  socket.on('typing', data => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

// History endpoint
app.get('/history/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  const doc = await messagesRef.doc(roomId).get();
  const data = doc.data();
  res.json(data?.messages || []);
});

http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
