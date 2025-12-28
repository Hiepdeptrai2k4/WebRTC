const socket = io();
let myName = "", peerName = "", pc = null, localStream = null;
let statsInterval = null;

// PHÂN TÍCH CHẤT LƯỢNG (Khắc phục lỗi Codec undefined)
async function getStreamingStats() {
    if (!pc) return;
    const stats = await pc.getStats();
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.kind === 'audio')) {
            const codec = stats.get(report.codecId);
            console.warn(`--- THÔNG KÊ DATA STREAMING (${report.kind.toUpperCase()}) ---`);
            console.log(`+ Codec: ${codec ? codec.mimeType : 'Đang lấy dữ liệu...'}`); 
            console.log(`+ Jitter: ${report.jitter ? report.jitter.toFixed(4) : 0}s`);
            console.log(`+ Bitrate: ${Math.round(report.bytesReceived * 8 / 1024)} kbps`);
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
        if (e.candidate) socket.emit("ice", { to: peerName, ice: e.candidate });
    };

    pc.ontrack = e => {
        document.getElementById("remoteVideo").srcObject = e.streams[0];
        document.getElementById("btnHangup").style.display = "inline-block";
        statsInterval = setInterval(getStreamingStats, 2000);
    };

    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
}

// HÀM TẮT CUỘC GÓI (Hangup)
function hangup(isRemote = false) {
    console.log("KẾT THÚC PHIÊN TRUYỀN THÔNG");
    
    if (pc) {
        pc.close();
        pc = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    document.getElementById("localVideo").srcObject = null;
    document.getElementById("remoteVideo").srcObject = null;
    document.getElementById("btnHangup").style.display = "none";
    clearInterval(statsInterval);

    if (!isRemote) {
        socket.emit("hangup", peerName);
    }
    peerName = "";
}

// Tín hiệu kết thúc từ phía bên kia
socket.on("hangup", () => hangup(true));

async function callUser(to) {
    peerName = to;
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    document.getElementById("localVideo").srcObject = localStream;
    createPC();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
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
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice", async ({ ice }) => {
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(ice));
});

function login() {
    myName = document.getElementById("username").value;
    if(myName) socket.emit("register", myName);
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