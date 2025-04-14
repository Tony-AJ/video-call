const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

io.on('connection', socket => {
  socket.on('join', roomID => {
    socket.join(roomID);
    const users = Array.from(io.sockets.adapter.rooms.get(roomID) || []);
    const otherUsers = users.filter(id => id !== socket.id);
    socket.emit('all-users', otherUsers);

    socket.on('offer', ({ offer, to }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ answer, to }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ candidate, to }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on('disconnect', () => {
      socket.to(roomID).emit('user-disconnected', socket.id);
    });
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
