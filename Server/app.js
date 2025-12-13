const express = require("express");
const http = require("http");
const path = require("path");
const socketIO = require("socket.io");

const registerSocket = require("./socket");

const app = express();
const server = http.createServer(app);
// Cấu hình CORS chặt chẽ hơn, thay * bằng domain của bạn (hoặc giữ * nếu cần)
const io = socketIO(server, { 
    cors: { 
        origin: "https://35.232.138.176" 
        
    } 
});

// serve client
const clientPath = path.join(__dirname, "..", "Client");
app.use(express.static(clientPath));
app.get("/", (req, res) =>
  res.sendFile(path.join(clientPath, "index.html"))
);

// socket logic
registerSocket(io);

// Lắng nghe trên cổng 8181 (Hoặc dùng process.env.PORT)
const PORT = process.env.PORT || 8181;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}. Cần Reverse Proxy để dùng HTTPS/WSS.`)
);