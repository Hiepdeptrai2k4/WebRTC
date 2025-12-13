const socket = io(); // Kết nối tự động đến origin hiện tại (Giả sử là HTTPS: 35.232.138.176)

let myName = "";
let peerName = "";
let pc = null;
let localStream = null;

/* ===== UI (Không đổi) ===== */
const usersDiv = document.getElementById("users");
const loginBox = document.getElementById("loginBox");
const callBox = document.getElementById("callBox");
const peerLabel = document.getElementById("peerName");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

function log(title, data) {
  console.log("====", title, "====");
  console.log(data);
}

/* ===== LOGIN (Không đổi) ===== */
function login() {
  myName = document.getElementById("username").value.trim();
  if (!myName) return alert("Nhập tên");

  socket.emit("register", myName);
  loginBox.style.display = "none";
  callBox.style.display = "block";
}

/* ===== USER LIST (Không đổi) ===== */
socket.on("users", users => {
  usersDiv.innerHTML = "";
  users.forEach(u => {
    if (u === myName) return;
    const div = document.createElement("div");
    div.innerText = "📞 " + u;
    div.onclick = () => callUser(u);
    usersDiv.appendChild(div);
  });
});

/* ===== CALL (Không đổi logic) ===== */
async function callUser(name) {
  peerName = name;
  peerLabel.innerText = name;

  await startMedia();
  createPC(); // Gọi hàm tạo PC mới với cấu hình TURN/STUN

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  log("SEND OFFER SDP", offer.sdp);

  socket.emit("call", { to: name, offer });
}

/* ===== RECEIVE CALL (Không đổi logic) ===== */
socket.on("incoming-call", async data => {
  if (!data || !data.offer) return;

  const { from, offer } = data;

  // Xử lý khi có người gọi đến mà đang bận, nên thêm logic này vào
  if (pc && pc.connectionState !== 'closed') {
    socket.emit("busy", from);
    return;
  }
  
  if (!confirm(`📞 ${from} đang gọi. Nhận?`)) {
    // Sửa: Bạn chưa định nghĩa sự kiện 'reject' trên server
    // socket.emit("reject", from); 
    return;
  }

  peerName = from;
  peerLabel.innerText = from;

  await startMedia();
  createPC(); // Gọi hàm tạo PC mới với cấu hình TURN/STUN

  log("RECEIVE OFFER SDP", offer.sdp);

  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  log("SEND ANSWER SDP", answer.sdp);

  socket.emit("answer", { to: from, answer });
});

/* ===== RECEIVE ANSWER, ICE, HANGUP (Không đổi logic) ===== */
socket.on("answer", async data => {
  if (!data || !data.answer) return;
  log("RECEIVE ANSWER SDP", data.answer.sdp);
  pc && pc.remoteDescription === null && await pc.setRemoteDescription(data.answer); 
});

socket.on("ice", data => {
  if (!data || !data.ice) return;

  log("RECEIVE ICE", data.ice);
  pc && pc.addIceCandidate(data.ice);
});

socket.on("hangup", () => {
  alert("📴 Đối phương đã tắt cuộc gọi");
  hangup();
});

/* ===== MEDIA (Không đổi) ===== */
async function startMedia() {
  if (localStream) return;

  // WebRTC API yêu cầu HTTPS
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localVideo.srcObject = localStream;
}

/* ===== PEER (ĐÃ SỬA: Thêm cấu hình TURN/STUN) ===== */
function createPC() {
  // Cấu hình STUN/TURN với địa chỉ IP công cộng (35.232.138.176)
  // và tài khoản đã cấu hình (user1:password123)
  pc = new RTCPeerConnection({
    iceServers: [
      // STUN Server của Google (dự phòng)
      { urls: "stun:stun.l.google.com:19302" }, 
      // STUN Server của bạn
      { urls: "stun:35.232.138.176:3478" }, 
      // TURN Server của bạn
      { 
        urls: "turn:35.232.138.176:3478", 
        username: "user1", 
        credential: "password123" 
      }
    ],
  });

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      log("SEND ICE", e.candidate);
      socket.emit("ice", { to: peerName, ice: e.candidate });
    }
  };
}

/* ===== HANGUP (Không đổi) ===== */
function hangup() {
  if (pc) {
    pc.close();
    pc = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  socket.emit("hangup", peerName);

  peerName = "";
  peerLabel.innerText = "---";
}