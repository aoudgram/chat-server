const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

// MongoDB Atlas Connection
const MONGO_URI = "mongodb+srv://vikasnetad_db_user:sc4beq2BognWPmzE@cluster0.nnjescm.mongodb.net/chatapp?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Connected to MongoDB Atlas successfully!");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});

// User Schema
const userSchema = new mongoose.Schema({
  contactInfo: String, // Email or Mobile
  username: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String, // Encrypted text
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Reserved Usernames list
const RESERVED_USERNAMES = ["VIKAS", "VANVAAR", "KEEBUL", "AOUDGRAM", "AOUD", "KNOCKJOCK"];

// Register User API
app.post('/api/register', async (req, res) => {
  try {
    let { contactInfo, username } = req.body;
    username = username.trim();

    // Check 4 letters minimum restriction
    if (username.length < 4) {
      return res.status(400).json({ success: false, error: 'Please enter at least 4 letters username' });
    }

    const upperUsername = username.toUpperCase();

    // Check reserved usernames (except if it's the first vikas registration)
    if (RESERVED_USERNAMES.includes(upperUsername) && upperUsername !== "VIKAS") {
      return res.status(400).json({ success: false, error: 'This username is reserved and not available' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already taken! Please choose another.' });
    }

    const newUser = new User({ contactInfo, username });
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
});

// Get all users for contact list
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Storage Stats API
app.get('/api/storage', async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const storageUsedBytes = stats.dataSize || 0;
    const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
    const maxStorageMB = 512;
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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Load chat history between two users
  socket.on('get_history', async ({ user1, user2 }) => {
    try {
      const messages = await Message.find({
        $or: [
          { sender: user1, receiver: user2 },
          { sender: user2, receiver: user1 }
        ]
      }).sort({ timestamp: 1 });
      socket.emit('load_history', messages);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  });

  // Handle incoming message
  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        sender: data.sender,
        receiver: data.receiver,
        message: data.message
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
  
