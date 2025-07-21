const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const logPath = path.join(__dirname, "messages.json");

// Ensure log file exists
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, "[]");
}

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/history", (req, res) => {
  fs.readFile(logPath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading history.");
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });
});

io.on("connection", (socket) => {
  socket.on("join-room", (room) => {
    socket.join(room);
  });

  socket.on("send-message", (msg) => {
    io.to("main-room").emit("receive-message", msg);
    fs.readFile(logPath, "utf8", (err, data) => {
      const arr = err ? [] : JSON.parse(data || "[]");
      arr.push(msg);
      fs.writeFile(logPath, JSON.stringify(arr.slice(-100)), () => {});
    });
  });
});

server.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
