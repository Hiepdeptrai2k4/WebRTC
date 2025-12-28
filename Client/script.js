const socket = io();

let myName = "";
let peerName = "";
let pc = null;
let localStream = null;
let callState = "IDLE";
let pendingICE = [];

const usersDiv = document.getElementById("users");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const peerLabel = document.getElementById("peer");

function login() {
  myName = document.getElementById("username").value.trim();
  socket.emit("register", myName);
}

socket.on("register-fail", () => alert("USERNAME EXISTS"));

socket.on("users", users => {
  usersDiv.innerHTML = "";
  users.forEach(u => {
    if (u === myName) return;
    const d = document.createElement("div");
    d.innerText = "CALL " + u;
    d.onclick = () => callUser(u);
    usersDiv.appendChild(d);
  });
});

async function startMedia() {
  if (localStream) return;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createPC() {
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:35.232.138.176:3478" },
      {
        urls: "turn:35.232.138.176:3478",
        username: "user1",
        credential: "password123"
      }
    ]
  });

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];

  pc.onicecandidate = e => {
    if (e.candidate) {
      console.log("ICE OUT", e.candidate);
      socket.emit("ice", { to: peerName, ice: e.candidate });
    }
  };

  pc.onconnectionstatechange = () =>
    console.log("PC STATE", pc.connectionState);
}

async function callUser(name) {
  if (callState !== "IDLE") return;
  peerName = name;
  peerLabel.innerText = name;
  callState = "CALLING";

  await startMedia();
  createPC();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  console.log("OFFER SDP\n", offer.sdp);
  socket.emit("call", { to: name, offer });
}

socket.on("incoming-call", async ({ from, offer }) => {
  if (callState === "IN_CALL") {
    socket.emit("reject", from);
    return;
  }

  peerName = from;
  peerLabel.innerText = from;
  callState = "RINGING";

  await startMedia();
  createPC();

  console.log("OFFER IN\n", offer.sdp);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  console.log("ANSWER SDP\n", answer.sdp);
  socket.emit("answer", { to: from, answer });

  pendingICE.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
  pendingICE = [];
  callState = "IN_CALL";
});

socket.on("answer", async ({ answer }) => {
  console.log("ANSWER IN\n", answer.sdp);
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  pendingICE.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
  pendingICE = [];
  callState = "IN_CALL";
});

socket.on("ice", async ({ ice }) => {
  console.log("ICE IN", ice);
  if (!pc || !pc.remoteDescription) {
    pendingICE.push(ice);
    return;
  }
  await pc.addIceCandidate(new RTCIceCandidate(ice));
});

socket.on("busy", () => hangup());
socket.on("rejected", () => hangup());
socket.on("hangup", () => hangup());

function hangup() {
  if (pc) pc.close();
  pc = null;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  socket.emit("hangup", peerName);
  peerName = "";
  peerLabel.innerText = "---";
  callState = "IDLE";
}
