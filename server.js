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

// User Schema with Password support
const userSchema = new mongoose.Schema({
  contactInfo: { type: String, required: true }, // Email or Mobile (Owner is 9950972498)
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
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

const RESERVED_USERNAMES = ["VIKAS", "VANVAAR", "KEEBUL", "AOUDGRAM", "AOUD", "KNOCKJOCK"];

// Register API
app.post('/api/register', async (req, res) => {
  try {
    let { contactInfo, username, password } = req.body;
    if (!username || !password || !contactInfo) {
      return res.status(400).json({ success: false, error: 'All fields are required!' });
    }
    username = username.trim();

    if (username.length < 4) {
      return res.status(400).json({ success: false, error: 'Please enter at least 4 letters username' });
    }

    const upperUsername = username.toUpperCase();
    
    // Enforce strict ownership for @VIKAS and mobile 9950972498
    if (upperUsername === "VIKAS" && contactInfo !== "9950972498") {
      return res.status(400).json({ success: false, error: '@VIKAS username is reserved for the owner (9950972498).' });
    }

    if (RESERVED_USERNAMES.includes(upperUsername) && upperUsername !== "VIKAS") {
      return res.status(400).json({ success: false, error: 'This username is reserved and not available.' });
    }

    const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already taken! Please choose another or Login.' });
    }

    const newUser = new User({ contactInfo, username, password });
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
});

// Login API
app.post('/api/login', async (req, res) => {
  try {
    let { identifier, password } = req.body; // identifier can be username or mobile/email
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Please fill all login fields!' });
    }

    identifier = identifier.trim();

    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${identifier}$`, 'i') } },
        { contactInfo: identifier }
      ]
    });

    if (!user || user.password !== password) {
      return res.status(400).json({ success: false, error: 'Invalid username/contact or password!' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

// Get all users for contact list
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username contactInfo createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Storage Stats API (500MB limit calculation)
app.get('/api/storage', async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const storageUsedBytes = stats.dataSize || 0;
    const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
    res.json({ usedMB: storageUsedMB, maxMB: 500 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

// Clear All Chats API (Owner only check can be added or general)
app.delete('/api/chats', async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ success: true, message: 'All chats cleared successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chats' });
  }
});

// Socket.io Real-time connection & Online tracking
const onlineUsers = new Map(); // username -> socket.id

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('user_online', (username) => {
    onlineUsers.set(username, socket.id);
    io.emit('update_online_users', Array.from(onlineUsers.keys()));
  });

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

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        sender: data.sender,
        receiver: data.receiver,
        message: data.message
      });
      await newMessage.save();

      // Emit to receiver and sender if online
      io.emit('receive_message', newMessage);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on('disconnect', () => {
    for (let [username, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(username);
        break;
      }
    }
    io.emit('update_online_users', Array.from(onlineUsers.keys()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
  
