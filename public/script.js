console.log('=== SCRIPT.JS LOADED ===');
console.log('Script.js is now executing...');

// Global variables (these are now defined in the HTML file)
// socket, currentChatType, partnerId, localStream, peerConnection, isConnected

// WebRTC negotiation state
let isNegotiating = false;
// isInitiator is now managed by the HTML file and accessed via window.isInitiator

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
            console.log('My socket ID:', socket.id);
            console.log('Partner ID:', data.partnerId);
            console.log('Chat type:', data.chatType);
            console.log('Is initiator:', data.isInitiator);
            console.log('=== CHAT STARTED DEBUG ===');
            console.log('Data received:', JSON.stringify(data));
            console.log('==========================');
            
            partnerId = data.partnerId;
            currentChatType = data.chatType;
            isConnected = true;
            // isInitiator is now set in the HTML file's chat-started handler
            
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
            console.log('Received offer from:', data.from);
            console.log('Offer SDP:', data.offer.sdp.substring(0, 100) + '...');
            handleOffer(data.offer);
        });
        
        socket.on('answer', (data) => {
            console.log('Received answer from:', data.from);
            console.log('Answer SDP:', data.answer.sdp.substring(0, 100) + '...');
            handleAnswer(data.answer);
        });
        
        socket.on('ice-candidate', (data) => {
            console.log('Received ICE candidate from:', data.from);
            console.log('ICE candidate:', data.candidate.candidate.substring(0, 50) + '...');
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
    console.log('Starting video chat with partner:', partnerId, 'isInitiator:', window.isInitiator);
    elements.videoStatus.textContent = 'Connected!';
    elements.videoPlaceholder.style.display = 'none';
    
    // Initialize WebRTC after a short delay to ensure everything is ready
    setTimeout(() => {
        initializeWebRTC();
    }, 500);
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
    return new Date(timestamp).toLocaleTimeString();
}

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
    console.log('Initializing WebRTC, isInitiator:', window.isInitiator);
    
    if (!localStream) {
        console.error('Local stream not available');
        return;
    }
    
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    try {
        peerConnection = new RTCPeerConnection(configuration);
        console.log('PeerConnection created');
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind, track.id);
            const sender = peerConnection.addTrack(track, localStream);
            console.log('Track sender created:', sender);
        });
        
        console.log('Local stream tracks added. Total senders:', peerConnection.getSenders().length);
        
        // Handle incoming streams
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream:', event.streams[0]);
            console.log('Remote stream tracks:', event.streams[0].getTracks().map(t => t.kind));
            elements.remoteVideo.srcObject = event.streams[0];
            elements.remoteVideo.play().catch(e => console.error('Error playing remote video:', e));
            
            // Add event listeners to remote video
            elements.remoteVideo.onloadedmetadata = () => {
                console.log('Remote video metadata loaded');
            };
            elements.remoteVideo.oncanplay = () => {
                console.log('Remote video can play');
            };
            elements.remoteVideo.onplay = () => {
                console.log('Remote video started playing');
            };
            elements.remoteVideo.onerror = (e) => {
                console.error('Remote video error:', e);
            };
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                socket.emit('ice-candidate', { candidate: event.candidate });
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('WebRTC connection established successfully!');
            } else if (peerConnection.connectionState === 'failed') {
                console.error('WebRTC connection failed');
            }
        };
        
        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'connected') {
                console.log('ICE connection established!');
            } else if (peerConnection.iceConnectionState === 'failed') {
                console.error('ICE connection failed');
            }
        };
        
        // Handle signaling state changes
        peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state:', peerConnection.signalingState);
            if (peerConnection.signalingState === 'stable' && peerConnection.pendingCandidates) {
                // Process any pending ICE candidates
                while (peerConnection.pendingCandidates.length > 0) {
                    const candidate = peerConnection.pendingCandidates.shift();
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                        .then(() => console.log('Added pending ICE candidate'))
                        .catch(e => console.error('Error adding pending ICE candidate:', e));
                }
            }
        };
        
        // Only the initiator creates the offer
        console.log('=== INITIATOR CHECK ===');
        console.log('isInitiator value:', window.isInitiator);
        console.log('isInitiator type:', typeof window.isInitiator);
        console.log('======================');
        
        if (window.isInitiator) {
            console.log('Creating initial offer as initiator');
            console.log('About to call createOffer()...');
            createOffer();
        } else {
            console.log('Waiting for offer as receiver');
        }
        
        // Add a periodic check for connection status
        setTimeout(() => {
            checkConnectionStatus();
        }, 2000);
        
        // Add another check after 5 seconds to see if signaling is happening
        setTimeout(() => {
            console.log('=== 5 Second Check ===');
            console.log('Negotiating:', isNegotiating);
            console.log('Signaling state:', peerConnection ? peerConnection.signalingState : 'no peer connection');
            console.log('Connection state:', peerConnection ? peerConnection.connectionState : 'no peer connection');
            console.log('=====================');
        }, 5000);
        
    } catch (error) {
        console.error('Error initializing WebRTC:', error);
    }
}

async function createOffer() {
    try {
        if (isNegotiating) {
            console.log('Already negotiating, skipping offer creation');
            return;
        }
        
        console.log('Creating offer...');
        isNegotiating = true;
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('Sending offer to partner');
        socket.emit('offer', { offer });
    } catch (error) {
        console.error('Error creating offer:', error);
        isNegotiating = false;
    }
}

async function handleOffer(offer) {
    try {
        console.log('Handling offer...');
        
        if (!peerConnection) {
            console.error('PeerConnection not ready when receiving offer');
            return;
        }
        
        if (isNegotiating) {
            console.log('Already negotiating, ignoring offer');
            return;
        }
        
        isNegotiating = true;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Creating answer...');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('Sending answer to partner');
        socket.emit('answer', { answer });
        isNegotiating = false;
    } catch (error) {
        console.error('Error handling offer:', error);
        isNegotiating = false;
    }
}

async function handleAnswer(answer) {
    try {
        console.log('Handling answer...');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote description set successfully');
        isNegotiating = false;
    } catch (error) {
        console.error('Error handling answer:', error);
        isNegotiating = false;
    }
}

async function handleIceCandidate(candidate) {
    try {
        console.log('Handling ICE candidate...');
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('ICE candidate added successfully');
        } else {
            console.log('PeerConnection not ready for ICE candidate, storing for later');
            // Store candidate for later if peer connection isn't ready
            if (!peerConnection.pendingCandidates) {
                peerConnection.pendingCandidates = [];
            }
            peerConnection.pendingCandidates.push(candidate);
        }
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
    console.log('Cleaning up...');
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track:', track.kind);
        });
        localStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log('PeerConnection closed');
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
    
    // Reset WebRTC state
    isConnected = false;
    partnerId = null;
    currentChatType = null;
    isNegotiating = false;
            window.isInitiator = false;
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
}

function checkConnectionStatus() {
    if (!peerConnection) {
        console.log('No peer connection available');
        return;
    }
    
    console.log('=== Connection Status Check ===');
    console.log('Connection state:', peerConnection.connectionState);
    console.log('ICE connection state:', peerConnection.iceConnectionState);
    console.log('Signaling state:', peerConnection.signalingState);
    console.log('Local stream tracks:', localStream ? localStream.getTracks().length : 0);
    console.log('Remote stream:', elements.remoteVideo.srcObject ? 'Present' : 'Missing');
    console.log('Remote video ready state:', elements.remoteVideo.readyState);
    console.log('Remote video current time:', elements.remoteVideo.currentTime);
    console.log('Remote video paused:', elements.remoteVideo.paused);
    console.log('================================');
    
    // If we have a connection but no remote video, try to troubleshoot
    if (peerConnection.connectionState === 'connected' && !elements.remoteVideo.srcObject) {
        console.warn('Connection established but no remote video stream!');
        // Try to get the remote streams
        const receivers = peerConnection.getReceivers();
        console.log('Receivers:', receivers.length);
        receivers.forEach((receiver, index) => {
            console.log(`Receiver ${index}:`, receiver.track ? receiver.track.kind : 'no track');
        });
    }
}

// Make functions globally available for Socket.IO events
window.handleOffer = handleOffer;
window.handleAnswer = handleAnswer;
window.handleIceCandidate = handleIceCandidate;

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