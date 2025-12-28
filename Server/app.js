const express = require("express");
const http = require("http");
const path = require("path");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

require("./socket")(io);

const PORT = process.env.PORT || 8181;
server.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT);
});
