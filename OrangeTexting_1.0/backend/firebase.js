
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, orderBy } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_KEY,
  authDomain: process.env.FIREBASE_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function saveMessage(roomId, encryptedText) {
  await addDoc(collection(db, roomId), {
    text: encryptedText,
    timestamp: Date.now(),
  });
}

async function getMessages(roomId) {
  const q = query(collection(db, roomId), orderBy('timestamp'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().text);
}

module.exports = { saveMessage, getMessages };
