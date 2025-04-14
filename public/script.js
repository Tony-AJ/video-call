const socket = io();

let localStream;
let peerConnection;
let micEnabled = true;
let camEnabled = true;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

function joinRoom() {
  const roomID = document.getElementById('roomInput').value;
  if (!roomID) return alert("Enter room ID");

  socket.emit('join', roomID);

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localVideo.srcObject = stream;
      localStream = stream;

      createPeerConnection();

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    });
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  console.log(`[AUDIO] Mic ${micEnabled ? 'unmuted' : 'muted'}`);
}

function toggleCam() {
  if (!localStream) return;
  camEnabled = !camEnabled;
  localStream.getVideoTracks().forEach(track => {
    track.enabled = camEnabled;
  });
  console.log(`[VIDEO] Camera ${camEnabled ? 'on' : 'off'}`);
}

socket.on('user-joined', async () => {
  console.log('[CLIENT] User joined, creating offer...');
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
});

socket.on('offer', async offer => {
  console.log('[CLIENT] Received offer, sending answer...');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async answer => {
  console.log('[CLIENT] Received answer');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async candidate => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('[ICE] Error adding ICE candidate:', e);
  }
});
