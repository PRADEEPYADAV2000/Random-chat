const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store waiting users and active connections
const waitingUsers = {
  text: [],
  video: []
};

const activeConnections = new Map();

// Track active users
let activeUsers = 0;
let totalConnections = 0;

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve test page
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  activeUsers++;
  totalConnections++;
  
  // Emit updated user count to all clients
  io.emit('user-count-update', {
    activeUsers,
    waitingText: waitingUsers.text.length,
    waitingVideo: waitingUsers.video.length,
    totalConnections
  });

  // Handle user joining chat queue
  socket.on('join-queue', (chatType) => {
    console.log(`User ${socket.id} joining ${chatType} queue`);
    
    // Remove user from any existing queues
    waitingUsers.text = waitingUsers.text.filter(id => id !== socket.id);
    waitingUsers.video = waitingUsers.video.filter(id => id !== socket.id);
    
    // Add to appropriate queue
    waitingUsers[chatType].push(socket.id);
    
    // Check if we can match users
    if (waitingUsers[chatType].length >= 2) {
      const user1 = waitingUsers[chatType].shift();
      const user2 = waitingUsers[chatType].shift();
      
      // Create connection
      activeConnections.set(user1, user2);
      activeConnections.set(user2, user1);
      
      // Notify both users
      io.to(user1).emit('chat-started', { partnerId: user2, chatType });
      io.to(user2).emit('chat-started', { partnerId: user1, chatType });
      
      console.log(`Matched users: ${user1} and ${user2} for ${chatType} chat`);
      
      // Emit updated user count to all clients
      io.emit('user-count-update', {
        activeUsers,
        waitingText: waitingUsers.text.length,
        waitingVideo: waitingUsers.video.length,
        totalConnections
      });
    }
  });

  // Handle text messages
  socket.on('send-message', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('receive-message', {
        message: data.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeUsers = Math.max(0, activeUsers - 1);
    
    // Remove from waiting queues
    waitingUsers.text = waitingUsers.text.filter(id => id !== socket.id);
    waitingUsers.video = waitingUsers.video.filter(id => id !== socket.id);
    
    // Notify partner and clean up connection
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected');
      activeConnections.delete(partnerId);
    }
    activeConnections.delete(socket.id);
    
    // Emit updated user count to all clients
    io.emit('user-count-update', {
      activeUsers,
      waitingText: waitingUsers.text.length,
      waitingVideo: waitingUsers.video.length,
      totalConnections
    });
  });

  // Handle manual disconnect
  socket.on('disconnect-chat', () => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected');
      activeConnections.delete(partnerId);
    }
    activeConnections.delete(socket.id);
    
    // Remove from waiting queues
    waitingUsers.text = waitingUsers.text.filter(id => id !== socket.id);
    waitingUsers.video = waitingUsers.video.filter(id => id !== socket.id);
  });

  // Handle report
  socket.on('report-user', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      console.log(`User ${socket.id} reported user ${partnerId} for: ${data.reason}`);
      // In a real app, you'd store this in a database
      io.to(partnerId).emit('partner-disconnected');
      activeConnections.delete(partnerId);
      activeConnections.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 