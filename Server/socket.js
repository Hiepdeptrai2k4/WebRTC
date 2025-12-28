const users = {};
const state = {}; // IDLE | CALLING | RINGING | IN_CALL

module.exports = io => {
  io.on("connection", socket => {
    socket.on("register", username => {
      if (users[username]) return socket.emit("register-fail");
      users[username] = socket.id;
      state[username] = "IDLE";
      socket.username = username;
      io.emit("users", Object.keys(users));
      console.log(`[HỆ THỐNG] Người dùng ${username} đã trực tuyến.`);
    });

    socket.on("call", ({ to, offer }) => {
      const from = socket.username;
      if (!users[to] || state[to] !== "IDLE") return socket.emit("busy");
      state[from] = "CALLING"; state[to] = "RINGING";
      console.log(`[SIGNALING] Offer từ ${from} tới ${to}`);
      // In SDP ra Terminal để lấy dữ liệu làm báo cáo "Khung giao thức"
      console.log("--- SDP OFFER DATA ---\n", offer.sdp.substring(0, 100) + "...");
      io.to(users[to]).emit("incoming-call", { from, offer });
    });

    socket.on("answer", ({ to, answer }) => {
      state[socket.username] = "IN_CALL"; state[to] = "IN_CALL";
      console.log(`[SIGNALING] Answer từ ${socket.username} tới ${to}`);
      io.to(users[to]).emit("answer", { answer });
    });

    socket.on("ice", ({ to, ice }) => {
      if (users[to]) {
        console.log(`[ICE] Trao đổi ứng viên kết nối tới ${to}`);
        io.to(users[to]).emit("ice", { ice });
      }
    });

    socket.on("hangup", to => {
      state[socket.username] = "IDLE";
      if (to) state[to] = "IDLE";
      if (users[to]) io.to(users[to]).emit("hangup");
    });

    socket.on("disconnect", () => {
      if (socket.username) {
        delete users[socket.username];
        delete state[socket.username];
        io.emit("users", Object.keys(users));
      }
    });
  });
};