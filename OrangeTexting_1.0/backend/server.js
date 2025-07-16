const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const admin = require('firebase-admin');

const PORT = process.env.PORT || 3000;

// 🔐 Decode and initialize Firebase
const decoded = Buffer.from(process.env.FIREBASE_KEY_B64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Serve frontend
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

io.on('connection', socket => {
  let currentRoom = null;

  socket.on('join-room', async ({ roomId }) => {
    socket.join(roomId);
    currentRoom = roomId;

    // Load history from Firestore
    try {
      const snapshot = await db.collection('messages').doc(roomId).collection('chats').orderBy('timestamp').get();
      snapshot.forEach(doc => {
        const msg = doc.data();
        socket.emit('receive-message', msg.encrypted);
      });
    } catch (e) {
      console.error('Error loading history:', e);
    }
  });

  socket.on('send-message', async encrypted => {
    if (!currentRoom) return;

    try {
      await db.collection('messages')
              .doc(currentRoom)
              .collection('chats')
              .add({ encrypted, timestamp: Date.now() });
    } catch (e) {
      console.error('Error saving message:', e);
    }

    socket.to(currentRoom).emit('receive-message', encrypted);
    socket.emit('receive-message', encrypted);
  });

  socket.on('typing', data => {
    if (currentRoom) {
      socket.to(currentRoom).emit('typing', data);
    }
  });
});

// Endpoint to view history manually
app.get('/history/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  try {
    const snapshot = await db.collection('messages').doc(roomId).collection('chats').orderBy('timestamp').get();
    const messages = [];
    snapshot.forEach(doc => {
      messages.push(doc.data());
    });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
