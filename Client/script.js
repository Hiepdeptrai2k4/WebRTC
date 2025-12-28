const socket = io();
let myName = "", peerName = "", pc = null, localStream = null;
let statsInterval = null;

// 1. THỐNG KÊ DATA STREAMING (Lấy số liệu Jitter, Bitrate, Codec cho báo cáo)
async function getStreamingStats() {
    if (!pc) return;
    const stats = await pc.getStats();
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.kind === 'audio')) {
            // Sửa lỗi Codec undefined bằng cách tra cứu trong stats
            const codec = stats.get(report.codecId);
            console.warn(`--- THÔNG KÊ DATA STREAMING (${report.kind.toUpperCase()}) ---`);
            console.log(`+ Codec: ${codec ? codec.mimeType : 'Đang xác định...'}`); 
            console.log(`+ Jitter: ${report.jitter ? report.jitter.toFixed(4) : 0}s`);
            console.log(`+ Bitrate: ${Math.round(report.bytesReceived * 8 / 1024)} kbps`);
        }
    });
}

// 2. KHỞI TẠO PEER CONNECTION (Tính hệ thống & NAT Traversal)
function createPC() {
    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:35.232.138.176:3478" }, // STUN Server của bạn
            { urls: "turn:35.232.138.176:3478", username: "user1", credential: "password123" }
        ]
    });

    pc.onicecandidate = e => {
        if (e.candidate) {
            console.log(`[ICE] Candidate: ${e.candidate.type}`);
            socket.emit("ice", { to: peerName, ice: e.candidate });
        }
    };

    pc.ontrack = e => {
        document.getElementById("remoteVideo").srcObject = e.streams[0];
        
        // --- QUAN TRỌNG: HIỆN NÚT HANGUP KHI KẾT NỐI THÀNH CÔNG ---
        const btn = document.getElementById("btnHangup");
        if (btn) btn.style.display = "inline-block"; 
        
        if (!statsInterval) statsInterval = setInterval(getStreamingStats, 2000);
    };

    if (localStream) {
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }
}

// 3. HÀM TẮT MÁY (Sửa lỗi nút không ẩn và giải phóng tài nguyên)
function hangup(isRemote = false) {
    console.log("=== KẾT THÚC PHIÊN TRUYỀN THÔNG ===");
    
    if (pc) {
        pc.close();
        pc = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    // Xóa video và ẩn nút Hangup ngay lập tức
    document.getElementById("localVideo").srcObject = null;
    document.getElementById("remoteVideo").srcObject = null;
    
    const btn = document.getElementById("btnHangup");
    if (btn) btn.style.display = "none";

    clearInterval(statsInterval);
    statsInterval = null;

    if (!isRemote && peerName) {
        socket.emit("hangup", peerName);
    }
    peerName = "";
}

// 4. LUỒNG BÁO HIỆU (Signaling) & KHUNG GIAO THỨC (SDP)
async function callUser(to) {
    peerName = to;
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    document.getElementById("localVideo").srcObject = localStream;
    createPC();
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    console.warn("=== KHUNG GIAO THỨC (SDP OFFER) ===");
    console.log(offer.sdp);

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

    console.warn("=== KHUNG GIAO THỨC (SDP ANSWER) ===");
    console.log(answer.sdp);

    socket.emit("answer", { to: from, answer });
} );

// Lắng nghe lệnh tắt máy từ người kia
socket.on("hangup", () => hangup(true));

// Các hàm đăng ký và nhận diện user
socket.on("answer", async ({ answer }) => { if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer)); });
socket.on("ice", async ({ ice }) => { if (pc) await pc.addIceCandidate(new RTCIceCandidate(ice)); });
function login() { myName = document.getElementById("username").value; socket.emit("register", myName); }
socket.on("users", users => {
    const div = document.getElementById("users"); div.innerHTML = "";
    users.forEach(u => {
        if (u === myName) return;
        const btn = document.createElement("button");
        btn.innerText = `Gọi ${u}`;
        btn.onclick = () => callUser(u);
        div.appendChild(btn);
    });
});