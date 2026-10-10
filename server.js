const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

// MongoDB Atlas Connection (Password already added)
const MONGO_URI = "mongodb+srv://vikasnetad_db_user:sc4beq2BognWPmzE@cluster0.nnjescm.mongodb.net/chatapp?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Connected to MongoDB Atlas successfully!");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  status: { type: String, default: 'sent' },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Real-time Storage calculation API
app.get('/api/storage', async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const storageUsedBytes = stats.dataSize || 0;
    const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
    const maxStorageMB = 512; // Free Tier Limit
    res.json({ usedMB: storageUsedMB, maxMB: maxStorageMB });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

// Clear All Chats API
app.delete('/api/chats', async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ success: true, message: 'All chats cleared successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chats' });
  }
});

io.on('connection', async (socket) => {
  console.log('A user connected:', socket.id);

  // Load previous messages from MongoDB
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    socket.emit('load_history', messages);
  } catch (err) {
    console.error("Error loading history:", err);
  }

  // Handle incoming message
  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        sender: data.sender,
        receiver: data.receiver || 'Everyone',
        message: data.message,
        status: 'delivered'
      });
      await newMessage.save();
      io.emit('receive_message', newMessage);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
