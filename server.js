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

io.on('connection', (socket) => {
  console.log('Ek user jud gaya hai:', socket.id);

  // Jab koi message bheje
  socket.on('send_message', (data) => {
    // Baaki sabhi dosto ko message bhej do
    io.emit('receive_message', data);
  });

  // Typing indicator ke liye
  socket.on('typing', (data) => {
    socket.broadcast.emit('display_typing', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnect ho gaya:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
      
