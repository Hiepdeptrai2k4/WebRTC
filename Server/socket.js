const users = {};
const state = {}; 
// IDLE | CALLING | RINGING | IN_CALL

module.exports = io => {
  io.on("connection", socket => {
    console.log("CONNECT", socket.id);

    socket.on("register", username => {
      if (users[username]) {
        socket.emit("register-fail", "USERNAME_EXISTS");
        return;
      }
      users[username] = socket.id;
      state[username] = "IDLE";
      socket.username = username;
      io.emit("users", Object.keys(users));
      console.log("REGISTER", username);
    });

    socket.on("call", ({ to, offer }) => {
      const from = socket.username;
      console.log(`CALL ${from} -> ${to}`);
      console.log("OFFER SDP\n", offer.sdp);

      if (!users[to]) return;
      if (state[to] !== "IDLE") {
        io.to(users[from]).emit("busy", to);
        return;
      }

      state[from] = "CALLING";
      state[to] = "RINGING";

      io.to(users[to]).emit("incoming-call", { from, offer });
    });

    socket.on("answer", ({ to, answer }) => {
      const from = socket.username;
      console.log(`ANSWER ${from} -> ${to}`);
      console.log("ANSWER SDP\n", answer.sdp);

      state[from] = "IN_CALL";
      state[to] = "IN_CALL";

      io.to(users[to]).emit("answer", { answer });
    });

    socket.on("ice", ({ to, ice }) => {
      console.log(`ICE ${socket.username} -> ${to}`);
      console.log(ice);
      if (users[to]) io.to(users[to]).emit("ice", { ice });
    });

    socket.on("reject", to => {
      console.log(`REJECT ${socket.username} -> ${to}`);
      state[socket.username] = "IDLE";
      state[to] = "IDLE";
      if (users[to]) io.to(users[to]).emit("rejected");
    });

    socket.on("hangup", to => {
      console.log(`HANGUP ${socket.username} -> ${to}`);
      state[socket.username] = "IDLE";
      if (to) state[to] = "IDLE";
      if (users[to]) io.to(users[to]).emit("hangup");
    });

    socket.on("disconnect", () => {
      const u = socket.username;
      if (!u) return;
      console.log("DISCONNECT", u);
      delete users[u];
      delete state[u];
      io.emit("users", Object.keys(users));
    });
  });
};
