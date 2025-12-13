const users = require("./users");

module.exports = function handleCall(io, socket) {

  // A gọi B
  socket.on("call", ({ to, offer }) => {
    const from = users.getUserBySocket(socket.id);

    console.log("📞 CALL:", from, "→", to);

    if (!users.getSocket(to)) {
      console.log("❌ User not found:", to);
      return;
    }

    // báo cho B có cuộc gọi đến
    io.to(users.getSocket(to)).emit("incoming-call", { from });

    // gửi offer cho B
    io.to(users.getSocket(to)).emit("offer", {
      from,
      offer
    });
  });

  // B trả lời A
  socket.on("answer", ({ to, answer }) => {
    const from = users.getUserBySocket(socket.id);
    console.log("✅ ANSWER:", from, "→", to);

    io.to(users.getSocket(to)).emit("answer", answer);
  });

  // ICE 2 chiều
  socket.on("ice", ({ to, candidate }) => {
    io.to(users.getSocket(to)).emit("ice", candidate);
  });

};
