const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});

// Connected users ki list: { socketId: username }
let users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User login/join
  socket.on('join_system', (username) => {
    if (!username) return;
    users[socket.id] = username;
    // Sabhi ko updated users ki list bhejo
    io.emit('update_users', users);
  });

  // 1-to-1 Private Message bhejna
  socket.on('send_private_message', (data) => {
    const { recipientSocketId, messageText, messageId } = data;
    const senderUsername = users[socket.id];

    if (recipientSocketId && users[recipientSocketId]) {
      // Samne wale user ko message bhejo
      io.to(recipientSocketId).emit('receive_private_message', {
        senderSocketId: socket.id,
        senderUsername: senderUsername,
        messageText: messageText,
        messageId: messageId,
        status: 'Delivered' // jaise hi deliver hua
      });

      // Sender ko update do ki message deliver ho gaya hai
      socket.emit('message_status_update', {
        messageId: messageId,
        status: 'Delivered'
      });
    } else {
      // Agar user offline hai ya internet band hai
      socket.emit('message_status_update', {
        messageId: messageId,
        status: 'Not Delivered'
      });
    }
  });

  // Jab user chat khol kar dekh le (Seen)
  socket.on('mark_as_seen', (data) => {
    const { senderSocketId, messageId } = data;
    if (senderSocketId && users[senderSocketId]) {
      io.to(senderSocketId).emit('message_status_update', {
        messageId: messageId,
        status: 'Seen'
      });
    }
  });

  // Disconnect hone par
  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update_users', users);
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
      
