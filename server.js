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
    
    // Check if user is already in the queue
    if (waitingUsers[chatType].includes(socket.id)) {
      console.log(`User ${socket.id} already in ${chatType} queue, ignoring duplicate request`);
      return;
    }
    
    // Add to appropriate queue
    waitingUsers[chatType].push(socket.id);
    
    // Check if we can match users
    if (waitingUsers[chatType].length >= 2) {
      const user1 = waitingUsers[chatType].shift();
      const user2 = waitingUsers[chatType].shift();
      
      // Create connection
      activeConnections.set(user1, user2);
      activeConnections.set(user2, user1);
      
      // Determine which user should create the offer (user with smaller socket ID)
      const initiator = user1 < user2 ? user1 : user2;
      
      console.log(`Initiator: ${initiator}, User1: ${user1}, User2: ${user2}`);
      console.log(`user1 < user2: ${user1 < user2}`);
      console.log(`user1 === initiator: ${user1 === initiator}`);
      console.log(`user2 === initiator: ${user2 === initiator}`);
      
      // Notify both users using their actual socket connections
      const socket1 = io.sockets.sockets.get(user1);
      const socket2 = io.sockets.sockets.get(user2);
      
      console.log(`Looking for socket1: ${user1}, found: ${socket1 ? 'YES' : 'NO'}`);
      console.log(`Looking for socket2: ${user2}, found: ${socket2 ? 'YES' : 'NO'}`);
      console.log(`Available sockets: ${Array.from(io.sockets.sockets.keys()).join(', ')}`);
      
      if (socket1) {
        const isInitiator1 = user1 === initiator;
        socket1.emit('chat-started', { 
          partnerId: user2, 
          chatType,
          isInitiator: isInitiator1
        });
        console.log(`User ${user1} isInitiator: ${isInitiator1}`);
      } else {
        console.log(`Socket ${user1} not found`);
      }
      
      if (socket2) {
        const isInitiator2 = user2 === initiator;
        socket2.emit('chat-started', { 
          partnerId: user1, 
          chatType,
          isInitiator: isInitiator2
        });
        console.log(`User ${user2} isInitiator: ${isInitiator2}`);
      } else {
        console.log(`Socket ${user2} not found`);
      }
      
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
      console.log(`Forwarding offer from ${socket.id} to ${partnerId}`);
      io.to(partnerId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    } else {
      console.log(`No partner found for ${socket.id} when sending offer`);
    }
  });

  socket.on('answer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      console.log(`Forwarding answer from ${socket.id} to ${partnerId}`);
      io.to(partnerId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    } else {
      console.log(`No partner found for ${socket.id} when sending answer`);
    }
  });

  socket.on('ice-candidate', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      console.log(`Forwarding ICE candidate from ${socket.id} to ${partnerId}`);
      io.to(partnerId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    } else {
      console.log(`No partner found for ${socket.id} when sending ICE candidate`);
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