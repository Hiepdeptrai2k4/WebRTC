const users = {}; // username -> socketId

module.exports = io => {
  io.on("connection", socket => {
    console.log("Client connected:", socket.id);

    socket.on("register", username => {
      users[username] = socket.id;
      socket.username = username;

      io.emit("users", Object.keys(users));
      console.log("REGISTER:", users);
    });

    socket.on("call", ({ to, offer }) => {
      if (users[to]) {
        io.to(users[to]).emit("incoming-call", {
          from: socket.username,
          offer,
        });
      }
    });

    socket.on("answer", ({ to, answer }) => {
      if (users[to]) {
        io.to(users[to]).emit("answer", { answer });
      }
    });

    socket.on("ice", ({ to, ice }) => {
      if (users[to]) {
        io.to(users[to]).emit("ice", { ice });
      }
    });

    socket.on("hangup", to => {
      if (users[to]) {
        io.to(users[to]).emit("hangup");
      }
    });

    socket.on("disconnect", () => {
      if (socket.username) {
        delete users[socket.username];
        io.emit("users", Object.keys(users));
      }
    });
  });
};
