const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

io.on('connection', socket => {
  console.log('[SERVER] New user:', socket.id);

  socket.on('join', roomID => {
    const room = io.sockets.adapter.rooms.get(roomID) || new Set();
    const numberOfUsers = room.size;

    console.log(`[SERVER] ${socket.id} joining room ${roomID} (${numberOfUsers} already inside)`);

    socket.join(roomID);
    if (numberOfUsers > 0) {
      socket.to(roomID).emit('user-joined', socket.id);
    }

    socket.on('offer', (data) => {
      socket.to(roomID).emit('offer', data);
    });

    socket.on('answer', (data) => {
      socket.to(roomID).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
      socket.to(roomID).emit('ice-candidate', data);
    });

    socket.on('disconnect', () => {
      console.log(`[SERVER] ${socket.id} disconnected`);
      socket.to(roomID).emit('user-disconnected');
    });
  });
});

server.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
