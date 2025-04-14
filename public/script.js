const socket = io();

let localStream;
const peerConnections = {};
let micEnabled = true;
let camEnabled = true;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteContainer = document.getElementById('remoteVideos');

function joinRoom() {
  const roomID = document.getElementById('roomInput').value.trim();
  if (!roomID) return alert("Enter a Room ID!");

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;

      // ✅ Join room only after media is ready
      socket.emit('join', roomID);
    })
    .catch(error => {
      console.error('[ERROR] Accessing media devices failed:', error);
      alert('Please allow camera and microphone access.');
    });
}

socket.on('all-users', users => {
  users.forEach(userId => {
    const pc = createPeerConnection(userId);
    peerConnections[userId] = pc;

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('offer', { offer, to: userId });
    });
  });
});

socket.on('offer', async ({ from, offer }) => {
  const pc = createPeerConnection(from);
  peerConnections[from] = pc;

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { answer, to: from });
});

socket.on('answer', async ({ from, answer }) => {
  await peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', ({ from, candidate }) => {
  if (peerConnections[from]) {
    peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on('user-disconnected', socketId => {
  const video = document.getElementById(socketId);
  if (video) video.remove();
  if (peerConnections[socketId]) peerConnections[socketId].close();
  delete peerConnections[socketId];
});

function createPeerConnection(socketId) {
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: socketId, candidate: event.candidate });
    }
  };

  pc.ontrack = event => {
    let remoteVideo = document.getElementById(socketId);
    if (!remoteVideo) {
      remoteVideo = document.createElement('video');
      remoteVideo.id = socketId;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.classList.add('remote-video');
      remoteContainer.appendChild(remoteVideo);
    }
    remoteVideo.srcObject = event.streams[0];
  };

  return pc;
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
}

function toggleCam() {
  if (!localStream) return;
  camEnabled = !camEnabled;
  localStream.getVideoTracks().forEach(track => {
    track.enabled = camEnabled;
  });
}
