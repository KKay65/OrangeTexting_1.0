const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const messages = [];

const upload = multer({ dest: path.join(__dirname, "uploads/") });

let userMap = {};

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/history", (req, res) => res.json(messages));

app.post("/upload", upload.single("image"), (req, res) => {
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, "uploads", req.file.filename + path.extname(req.file.originalname));
  fs.rename(tempPath, targetPath, () => {
    const imageUrl = "/uploads/" + path.basename(targetPath);
    res.json({ imageUrl });
  });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

io.on("connection", (socket) => {
  let username = "Anonymous";

  socket.on("setUsername", (name) => {
    username = name;
    userMap[socket.id] = name;
    socket.emit("init", messages);
  });

  socket.on("chat message", (msg) => {
    const message = { type: "text", user: username, text: msg, timestamp: Date.now() };
    messages.push(message);
    io.emit("chat message", message);
  });

  socket.on("image message", (imgUrl) => {
    const message = { type: "image", user: username, image: imgUrl, timestamp: Date.now() };
    messages.push(message);
    io.emit("image message", message);
  });

  socket.on("disconnect", () => delete userMap[socket.id]);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
