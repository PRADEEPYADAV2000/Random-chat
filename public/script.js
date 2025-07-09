// Global variables (these are now defined in the HTML file)
// socket, currentChatType, partnerId, localStream, peerConnection, isConnected

// DOM elements
const pages = {
    homepage: document.getElementById('homepage'),
    textChat: document.getElementById('text-chat'),
    videoChat: document.getElementById('video-chat')
};

const elements = {
    textStatus: document.getElementById('text-status'),
    videoStatus: document.getElementById('video-status'),
    textMessages: document.getElementById('text-messages'),
    textInput: document.getElementById('text-input'),
    sendBtn: document.getElementById('send-btn'),
    localVideo: document.getElementById('local-video'),
    remoteVideo: document.getElementById('remote-video'),
    videoPlaceholder: document.getElementById('video-placeholder'),
    videoPermissions: document.getElementById('video-permissions'),
    reportModal: document.getElementById('report-modal'),
    reportReason: document.getElementById('report-reason'),
    reportDescription: document.getElementById('report-description')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Wait a bit for Socket.IO to load, then initialize
    setTimeout(() => {
        initializeSocket();
    }, 100);
});

// Initialize Socket.IO connection
function initializeSocket() {
    try {
        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.log('Socket.IO not ready, retrying in 500ms...');
            setTimeout(initializeSocket, 500);
            return;
        }
        
        // Use the global socket variable
        window.socket = io();
        socket = window.socket;
        
        socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            alert('Failed to connect to server. Please refresh the page.');
        });
        
        socket.on('chat-started', (data) => {
            console.log('Chat started:', data);
            partnerId = data.partnerId;
            currentChatType = data.chatType;
            isConnected = true;
            
            if (data.chatType === 'text') {
                startTextChat();
            } else {
                startVideoChat();
            }
        });
        
        socket.on('receive-message', (data) => {
            addMessage(data.message, 'received', data.timestamp);
        });
        
        socket.on('partner-disconnected', () => {
            handlePartnerDisconnect();
        });
        
        // WebRTC signaling events
        socket.on('offer', (data) => {
            handleOffer(data.offer);
        });
        
        socket.on('answer', (data) => {
            handleAnswer(data.answer);
        });
        
        socket.on('ice-candidate', (data) => {
            handleIceCandidate(data.candidate);
        });
    } catch (error) {
        console.error('Failed to initialize Socket.IO:', error);
        alert('Failed to initialize connection. Please refresh the page.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Text input events
    elements.textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Modal close events
    document.addEventListener('click', (e) => {
        if (e.target === elements.reportModal) {
            closeReportModal();
        }
    });
    
    // Close modal with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeReportModal();
        }
    });
}

// Start chat functions
function startChat(chatType) {
    if (!socket) {
        console.log('Socket not ready, retrying...');
        setTimeout(() => startChat(chatType), 1000);
        return;
    }
    
    currentChatType = chatType;
    
    if (chatType === 'text') {
        showPage('textChat');
        elements.textStatus.textContent = 'Looking for someone...';
        socket.emit('join-queue', 'text');
    } else {
        showPage('videoChat');
        elements.videoStatus.textContent = 'Looking for someone...';
        requestPermissions();
    }
}

function startTextChat() {
    elements.textStatus.textContent = 'Connected!';
    elements.textInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.textInput.focus();
    
    addSystemMessage('You are now connected with a stranger!');
}

function startVideoChat() {
    elements.videoStatus.textContent = 'Connected!';
    elements.videoPlaceholder.style.display = 'none';
    initializeWebRTC();
}

// Text chat functions
function sendMessage() {
    const message = elements.textInput.value.trim();
    if (!message || !isConnected) return;
    
    addMessage(message, 'sent');
    socket.emit('send-message', { message });
    elements.textInput.value = '';
}

function addMessage(message, type, timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;
    
    messageDiv.appendChild(contentDiv);
    
    if (timestamp) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(timestamp);
        messageDiv.appendChild(timeDiv);
    }
    
    elements.textMessages.appendChild(messageDiv);
    elements.textMessages.scrollTop = elements.textMessages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    
    messageDiv.appendChild(contentDiv);
    elements.textMessages.appendChild(messageDiv);
    elements.textMessages.scrollTop = elements.textMessages.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Video chat functions
async function requestPermissions() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        elements.localVideo.srcObject = localStream;
        elements.videoPermissions.style.display = 'none';
        
        // Join video queue after getting permissions
        socket.emit('join-queue', 'video');
        
    } catch (error) {
        console.error('Error accessing media devices:', error);
        elements.videoPermissions.querySelector('p').textContent = 
            'Unable to access camera and microphone. Please check your permissions and try again.';
    }
}

function initializeWebRTC() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // Handle incoming streams
    peerConnection.ontrack = (event) => {
        elements.remoteVideo.srcObject = event.streams[0];
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate });
        }
    };
    
    // Create and send offer
    createOffer();
}

async function createOffer() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { offer });
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

async function handleOffer(offer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

async function handleAnswer(answer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleIceCandidate(candidate) {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

// Disconnect functions
function disconnectChat() {
    if (isConnected) {
        socket.emit('disconnect-chat');
    }
    
    cleanup();
    showPage('homepage');
}

function handlePartnerDisconnect() {
    if (currentChatType === 'text') {
        addSystemMessage('Stranger has disconnected.');
        elements.textStatus.textContent = 'Disconnected';
        elements.textInput.disabled = true;
        elements.sendBtn.disabled = true;
    } else {
        elements.videoStatus.textContent = 'Disconnected';
        elements.videoPlaceholder.style.display = 'block';
        elements.videoPlaceholder.innerHTML = '<i class="fas fa-user"></i><p>Stranger has disconnected</p>';
    }
    
    isConnected = false;
    partnerId = null;
    
    // Auto-return to homepage after 3 seconds
    setTimeout(() => {
        if (!isConnected) {
            cleanup();
            showPage('homepage');
        }
    }, 3000);
}

function cleanup() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Reset video elements
    elements.localVideo.srcObject = null;
    elements.remoteVideo.srcObject = null;
    elements.videoPlaceholder.style.display = 'block';
    elements.videoPlaceholder.innerHTML = '<i class="fas fa-user"></i><p>Waiting for stranger...</p>';
    
    // Reset text chat
    elements.textMessages.innerHTML = '';
    elements.textInput.value = '';
    elements.textInput.disabled = true;
    elements.sendBtn.disabled = true;
    
    // Reset status
    elements.textStatus.textContent = 'Looking for someone...';
    elements.videoStatus.textContent = 'Looking for someone...';
    
    // Show permissions screen for video
    elements.videoPermissions.style.display = 'flex';
    
    isConnected = false;
    partnerId = null;
    currentChatType = null;
}

// Report functions
function reportUser() {
    if (!isConnected) return;
    
    elements.reportModal.classList.add('active');
    elements.reportReason.focus();
}

function closeReportModal() {
    elements.reportModal.classList.remove('active');
    elements.reportReason.value = 'inappropriate';
    elements.reportDescription.value = '';
}

function submitReport() {
    const reason = elements.reportReason.value;
    const description = elements.reportDescription.value;
    
    socket.emit('report-user', { reason, description });
    
    closeReportModal();
    disconnectChat();
    
    // Show confirmation
    addSystemMessage('User has been reported. You have been disconnected.');
}

// Utility functions
function showPage(pageName) {
    // Hide all pages
    Object.values(pages).forEach(page => {
        page.classList.remove('active');
    });
    
    // Show requested page
    pages[pageName].classList.add('active');
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isConnected) {
        // User switched tabs or minimized browser
        // Optionally disconnect or show warning
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    if (isConnected) {
        socket.emit('disconnect-chat');
    }
});

// Add some fun features
function addTypingIndicator() {
    // Could be implemented to show when partner is typing
}

function addConnectionAnimation() {
    // Add loading animation to status
    const statusElement = currentChatType === 'text' ? elements.textStatus : elements.videoStatus;
    statusElement.innerHTML = '<span class="loading"></span> Connecting...';
}

// Error handling
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (isConnected) {
        addSystemMessage('An error occurred. Please try reconnecting.');
    }
});

// Network status handling
window.addEventListener('online', () => {
    if (!isConnected) {
        addSystemMessage('You are back online!');
    }
});

window.addEventListener('offline', () => {
    if (isConnected) {
        addSystemMessage('You are offline. Please check your connection.');
    }
}); 