# ChatRandom - Omegle-like Web App

A modern, responsive web application similar to Omegle that allows users to chat anonymously with strangers via text or video chat.

## Features

### 🏠 Homepage
- Clean, modern UI with gradient background
- Feature highlights (Anonymous, Global, Instant)
- Safety guidelines
- Options for Text Chat or Video Chat

### 💬 Text Chat
- Real-time messaging with Socket.IO
- Message bubbles with timestamps
- System messages for status updates
- Responsive design for mobile devices

### 📹 Video Chat
- WebRTC peer-to-peer video streaming
- Camera and microphone permissions
- Two video elements: "You" and "Stranger"
- Automatic connection handling

### 🛡️ Safety Features
- Report button for inappropriate behavior
- Disconnect functionality
- Anonymous interactions (no user accounts)
- Safety guidelines displayed

### 📱 Responsive Design
- Mobile-friendly interface
- Adaptive layout for different screen sizes
- Touch-friendly buttons and controls

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **Video Streaming**: WebRTC
- **Styling**: Custom CSS with gradients and animations

## Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)
- Modern web browser with WebRTC support

## Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Usage

### Starting a Chat

1. **Visit the homepage** - You'll see the main interface with chat options
2. **Choose chat type**:
   - **Text Chat**: Click the "Text Chat" button for anonymous messaging
   - **Video Chat**: Click the "Video Chat" button for video conversations
3. **Wait for connection** - The app will automatically match you with another user
4. **Start chatting** - Once connected, you can begin your conversation

### During Chat

- **Text Chat**: Type messages in the input field and press Enter or click Send
- **Video Chat**: Your camera and microphone will be used for the conversation
- **Disconnect**: Click the "Disconnect" button to end the chat and return to homepage
- **Report**: Click "Report" if you encounter inappropriate behavior

### Safety Guidelines

- Be respectful and kind to others
- Don't share personal information
- Report inappropriate behavior
- You can disconnect anytime

## Project Structure

```
omegle-clone/
├── package.json          # Dependencies and scripts
├── server.js            # Node.js server with Socket.IO
├── public/              # Frontend files
│   ├── index.html       # Main HTML file
│   ├── styles.css       # CSS styling
│   └── script.js        # Client-side JavaScript
└── README.md           # This file
```

## API Endpoints

- `GET /` - Serves the main application page
- WebSocket events handled via Socket.IO

### Socket.IO Events

**Client to Server:**
- `join-queue` - Join text or video chat queue
- `send-message` - Send text message
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - WebRTC ICE candidate
- `disconnect-chat` - Manually disconnect
- `report-user` - Report inappropriate behavior

**Server to Client:**
- `chat-started` - Chat connection established
- `receive-message` - Receive text message
- `partner-disconnected` - Partner left the chat
- `offer` - WebRTC offer from partner
- `answer` - WebRTC answer from partner
- `ice-candidate` - WebRTC ICE candidate from partner

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

**Note**: Video chat requires HTTPS in production for WebRTC to work properly.

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon to automatically restart the server when files change.

### Customization

- **Styling**: Modify `public/styles.css` to change the appearance
- **Functionality**: Edit `public/script.js` for client-side features
- **Server Logic**: Update `server.js` for backend changes

### Adding Features

Some potential enhancements:
- User interests/topics for better matching
- Language selection
- Age verification
- Chat history (temporary)
- File sharing
- Screen sharing
- Multiple participants

## Security Considerations

- No user authentication (anonymous by design)
- No persistent data storage
- WebRTC connections are peer-to-peer
- Report system logs incidents (in production, store in database)
- HTTPS required for production deployment

## Deployment

### Local Network
```bash
# Allow connections from other devices on your network
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
```

### Production
1. Use a process manager like PM2
2. Set up HTTPS (required for WebRTC)
3. Configure environment variables
4. Use a reverse proxy (nginx)
5. Set up monitoring and logging

Example with PM2:
```bash
npm install -g pm2
pm2 start server.js --name "chatrandom"
pm2 startup
pm2 save
```

## Troubleshooting

### Common Issues

1. **Video not working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Verify camera/microphone access

2. **Connection issues**
   - Check firewall settings
   - Verify Socket.IO connection
   - Check browser console for errors

3. **Styling problems**
   - Clear browser cache
   - Check CSS file loading
   - Verify file paths

### Debug Mode

Enable debug logging by adding to `server.js`:
```javascript
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  debug: true
});
```

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the application.

---

**Disclaimer**: This application is for educational purposes. Users are responsible for their own behavior and should follow appropriate guidelines when interacting with others online. 