const express = require("express");
const http = require("http");
const path = require("path");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

// Cấu hình đường dẫn từ /Server trỏ ngược ra /Client
const clientPath = path.join(__dirname, "../Client");
app.use(express.static(clientPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
});

// Nạp logic xử lý báo hiệu
require("./socket")(io);

const PORT = 8181;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`=== HỆ THỐNG VOIP ĐANG CHẠY ===`);
    console.log(`Cổng: ${PORT}`);
    console.log(`Thư mục Client: ${clientPath}`);
});