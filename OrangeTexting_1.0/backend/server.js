const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

const serviceAccountJson = Buffer.from(process.env.FIREBASE_KEY_B64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(express.static(path.join(__dirname, '..'))); // serve from root of project
app.use(bodyParser.json({ limit: '10mb' })); // support large image messages

// Home route
app.get('/', (req, res) => {
  res.send(`
    <h1>OrangeTexting</h1>
    <p><a href="/chat.html?room=test">Open Chat</a></p>
    <p><a href="/history.html">View Chat History</a></p>
  `);
});

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
      console.error('Failed to load history:', err);
    }
  });

  socket.on('send-message', async (messageData) => {
    if (!currentRoom) return;

    try {
      await db.collection('messages')
        .doc(currentRoom)
        .collection('chats')
        .add({ ...messageData, timestamp: Date.now() });

      io.to(currentRoom).emit('receive-message', messageData);
    } catch (err) {
      console.error('Failed to save message:', err);
    }
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
  console.log(`Server listening on port ${PORT}`);
});
