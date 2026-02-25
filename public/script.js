const socket = io();

let localStream;
const peerConnections = {};
let micEnabled = true;
let camEnabled = true;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const joinContainer = document.getElementById('join-container');
const callContainer = document.getElementById('call-container');
const videoGrid = document.getElementById('video-grid');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');

async function joinRoom() {
  const roomID = document.getElementById('roomInput').value.trim();
  if (!roomID) return alert("Please enter a Room ID");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    localVideo.srcObject = stream;

    // UI Transition
    joinContainer.style.display = 'none';
    callContainer.style.display = 'flex';
    
    updateGridClass();

    socket.emit('join', roomID);
  } catch (error) {
    console.error('[ERROR] Accessing media devices failed:', error);
    alert('Could not access camera or microphone. Please check permissions.');
  }
}

function leaveRoom() {
    window.location.reload(); // Simple way to reset state and disconnect
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
  const wrapper = document.getElementById(`wrapper-${socketId}`);
  if (wrapper) wrapper.remove();
  if (peerConnections[socketId]) peerConnections[socketId].close();
  delete peerConnections[socketId];
  updateGridClass();
});

function createPeerConnection(socketId) {
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: socketId, candidate: event.candidate });
    }
  };

  pc.ontrack = event => {
    let remoteWrapper = document.getElementById(`wrapper-${socketId}`);
    if (!remoteWrapper) {
      remoteWrapper = document.createElement('div');
      remoteWrapper.id = `wrapper-${socketId}`;
      remoteWrapper.className = 'video-wrapper';
      
      const video = document.createElement('video');
      video.id = socketId;
      video.autoplay = true;
      video.playsInline = true;
      
      const label = document.createElement('div');
      label.className = 'participant-label';
      label.innerText = `Guest (${socketId.substring(0, 4)})`;
      
      remoteWrapper.appendChild(video);
      remoteWrapper.appendChild(label);
      videoGrid.appendChild(remoteWrapper);
      
      video.srcObject = event.streams[0];
      updateGridClass();
    }
  };

  return pc;
}

function updateGridClass() {
    const participantCount = videoGrid.children.length;
    if (participantCount <= 2) {
        videoGrid.classList.add('few-participants');
    } else {
        videoGrid.classList.remove('few-participants');
    }
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  micBtn.classList.toggle('off', !micEnabled);
  micBtn.innerText = micEnabled ? '🎤' : '🔇';
}

function toggleCam() {
  if (!localStream) return;
  camEnabled = !camEnabled;
  localStream.getVideoTracks().forEach(track => {
    track.enabled = camEnabled;
  });
  camBtn.classList.toggle('off', !camEnabled);
  camBtn.innerText = camEnabled ? '📷' : '🚫';
}
