const socket = io();
let myName = "", peerName = "", pc = null, localStream = null;
let statsInterval = null;

// 1. KỸ THUẬT DATA STREAMING: Hàm phân tích chất lượng (QoS)
async function getStreamingStats() {
    if (!pc) return;
    const stats = await pc.getStats();
    stats.forEach(report => {
        // Lọc lấy luồng dữ liệu nhận về (Inbound)
        if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.kind === 'audio')) {
            
            // Xử lý lỗi Codec undefined bằng cách tra cứu trong bảng stats
            const codec = stats.get(report.codecId);
            const codecMime = codec ? codec.mimeType : 'Đang xác định...';

            console.warn(`--- THÔNG KÊ DATA STREAMING (${report.kind.toUpperCase()}) ---`);
            console.log(`+ Codec sử dụng: ${codecMime}`); 
            console.log(`+ Jitter (Độ trễ biến thiên): ${report.jitter ? report.jitter.toFixed(4) : 0}s`);
            console.log(`+ Bitrate thực tế: ${Math.round(report.bytesReceived * 8 / 1024)} kbps`);
            if (report.kind === 'video') {
                console.log(`+ Khung hình (FPS): ${report.framesPerSecond || 0}`);
            }
        }
    });
}

// 2. TÍNH HỆ THỐNG: Khởi tạo kết nối Peer-to-Peer
function createPC() {
    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:35.232.138.176:3478" }, // STUN Server của bạn
            { 
                urls: "turn:35.232.138.176:3478", 
                username: "user1", 
                credential: "password123" 
            }
        ]
    });

    // NAT TRAVERSAL: Bằng chứng vượt NAT
    pc.onicecandidate = e => {
        if (e.candidate) {
            console.log(`[ICE] Tìm thấy ứng viên loại: ${e.candidate.type} | IP: ${e.candidate.address}`);
            socket.emit("ice", { to: peerName, ice: e.candidate });
        }
    };

    pc.ontrack = e => {
        document.getElementById("remoteVideo").srcObject = e.streams[0];
        // Bắt đầu đo đạc chất lượng Data Streaming sau khi có luồng Media
        if (!statsInterval) statsInterval = setInterval(getStreamingStats, 2000);
    };

    if (localStream) {
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }
}

// 3. SƠ ĐỒ TIẾN DIỄN PHIÊN: Các hàm điều khiển cuộc gọi
async function callUser(to) {
    peerName = to;
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    document.getElementById("localVideo").srcObject = localStream;
    createPC();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // MINH CHỨNG KHUNG GIAO THỨC SDP
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
});

socket.on("answer", async ({ answer }) => {
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice", async ({ ice }) => {
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(ice));
});

// 4. KẾT THÚC PHIÊN (Hangup)
function hangup(isRemote = false) {
    console.log("Kết thúc phiên truyền thông.");
    if (pc) { pc.close(); pc = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    
    document.getElementById("remoteVideo").srcObject = null;
    document.getElementById("localVideo").srcObject = null;
    clearInterval(statsInterval);
    statsInterval = null;

    if (!isRemote) socket.emit("hangup", peerName);
    peerName = "";
}

socket.on("hangup", () => hangup(true));

// Logic Login và quản lý User
function login() {
    myName = document.getElementById("username").value;
    if (myName) socket.emit("register", myName);
}

socket.on("users", users => {
    const div = document.getElementById("users");
    div.innerHTML = "";
    users.forEach(u => {
        if (u === myName) return;
        const btn = document.createElement("button");
        btn.innerText = `Call ${u}`;
        btn.style.margin = "5px";
        btn.onclick = () => callUser(u);
        div.appendChild(btn);
    });
});