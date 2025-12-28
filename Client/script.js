const socket = io();
let myName = "", peerName = "", pc = null, localStream = null;

// HÀM PHÂN TÍCH CHẤT LƯỢNG (Dành cho Yêu cầu 4 của cô giáo)
async function getStats() {
    if (!pc) return;
    const stats = await pc.getStats();
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
            console.warn("--- THỐNG KÊ DATA STREAMING ---");
            console.log(`+ Codec: ${report.mimeType}`); 
            console.log(`+ Jitter: ${report.jitter.toFixed(3)}s`);
            console.log(`+ Bitrate: ${Math.round(report.bytesReceived * 8 / 1024)} kbps`);
            console.log(`+ Khung hình (FPS): ${report.framesPerSecond || 0}`);
        }
    });
}

function createPC() {
    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:35.232.138.176:3478" },
            { urls: "turn:35.232.138.176:3478", username: "user1", credential: "password123" }
        ]
    });

    pc.onicecandidate = e => {
        if (e.candidate) {
            console.log(`[NAT Traversal] Candidate tìm thấy: ${e.candidate.type}`);
            socket.emit("ice", { to: peerName, ice: e.candidate });
        }
    };

    pc.ontrack = e => {
        document.getElementById("remoteVideo").srcObject = e.streams[0];
        setInterval(getStats, 2000); // Tự động đo chất lượng mỗi 2 giây
    };

    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
}

async function callUser(to) {
    peerName = to;
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    document.getElementById("localVideo").srcObject = localStream;
    createPC();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("--- KHUNG GIAO THỨC (SDP OFFER) ---\n", offer.sdp);
    socket.emit("call", { to, offer });
}

socket.on("incoming-call", async ({ from, offer }) => {
    peerName = from;
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    document.getElementById("localVideo").srcObject = localStream;
    createPC();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { to: from, answer });
});

socket.on("answer", async ({ answer }) => {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice", async ({ ice }) => {
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(ice));
});

function login() {
    myName = document.getElementById("username").value;
    socket.emit("register", myName);
}

socket.on("users", users => {
    const div = document.getElementById("users");
    div.innerHTML = "";
    users.forEach(u => {
        if (u === myName) return;
        const btn = document.createElement("button");
        btn.innerText = `Gọi ${u}`;
        btn.onclick = () => callUser(u);
        div.appendChild(btn);
    });
});