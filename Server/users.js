const users = {}; // username → socketId
const busy = {};  // username → true/false

function addUser(username, socketId) {
  users[username] = socketId;
  busy[username] = false;
}

function removeUser(socketId) {
  const user = getUserBySocket(socketId);
  if (user) {
    delete users[user];
    delete busy[user];
  }
}

function getUserBySocket(socketId) {
  return Object.keys(users).find(u => users[u] === socketId);
}

function isBusy(username) {
  return busy[username];
}

function setBusy(username, value) {
  busy[username] = value;
}

function getAllUsers() {
  return Object.keys(users);
}

function getSocket(username) {
  return users[username];
}

module.exports = {
  addUser,
  removeUser,
  getUserBySocket,
  isBusy,
  setBusy,
  getAllUsers,
  getSocket
};
