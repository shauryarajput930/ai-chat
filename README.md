# NeuralChat

A modern, responsive AI chat interface powered by Google's Gemini AI. Built with vanilla JavaScript, HTML, and CSS for a clean, fast, and privacy-focused experience.

## Features

- **AI-Powered Conversations**: Chat with Google's Gemini AI for intelligent responses
- **Local Data Storage**: All conversations, bookmarks, and preferences stored locally in your browser
- **Dark/Light Theme**: Toggle between dark and light themes
- **Message Management**:
  - Bookmark important messages
  - Star favorite responses
  - Search through chat history
  - Reply to specific messages
- **File Attachments**: Support for file uploads (images, documents)
- **Voice Input/Output**: Voice-to-text input and text-to-speech responses
- **Offline Support**: Local fallback responses when offline
- **Keyboard Shortcuts**: Efficient navigation with keyboard shortcuts
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **Session Management**: Multiple conversation sessions with folders
- **Export Functionality**: Export conversations and data

## Screenshots

*(Add screenshots here when available)*

## Setup & Installation

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for AI responses
- Google Gemini API key (get one from [Google AI Studio](https://aistudio.google.com/))

### Quick Start

1. **Clone or download** the project files:
   ```bash
   git clone <repository-url>
   cd ai-chat
   ```

2. **Get API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key
   - Copy the API key

3. **Configure API Key**:
   - Open `app.js`
   - Replace `YOUR_API_KEY_HERE` with your actual API key:
   ```javascript
   const API_KEY = 'your-api-key-here';
   ```

4. **Run the Application**:
   ```bash
   # Using Python (recommended)
   python -m http.server 8000

   # Or using Node.js
   npx http-server -p 8000

   # Or using PHP
   php -S localhost:8000
   ```

5. **Open in Browser**:
   - Navigate to `http://localhost:8000`
   - Start chatting!

## Usage

### Basic Chat
- Type your message in the input field at the bottom
- Press Enter or click the send button
- AI responses appear in real-time

### Keyboard Shortcuts
- `Ctrl + /`: Show/hide shortcuts panel
- `Ctrl + Enter`: Send message
- `Escape`: Clear input
- `Ctrl + K`: Focus search
- `Ctrl + N`: New conversation
- `Ctrl + B`: Toggle sidebar

### Managing Conversations
- **New Chat**: Click the "+" button or use `Ctrl + N`
- **Search**: Use the search bar to find messages
- **Bookmark**: Click the bookmark icon on any message
- **Star**: Click the star icon to favorite responses
- **Reply**: Click the reply button to respond to specific messages

### Themes
- Click the sun/moon icon in the sidebar to toggle between light and dark themes

### Voice Features
- Click the microphone icon for voice input
- Click the speaker icon on AI responses for text-to-speech

## File Structure

```
ai-chat/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling
├── app.js             # Main application logic
└── README.md          # This file
```

## API Configuration

The app uses Google's Gemini API. To change the model:

```javascript
// In app.js
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/YOUR_MODEL:generateContent?key=${API_KEY}`;
```

Available models:
- `gemini-flash-latest` (current)
- `gemini-1.5-flash`
- `gemini-1.5-pro`

## Privacy & Data

- **Local Storage**: All data is stored locally in your browser
- **No Tracking**: No analytics or tracking scripts
- **API Calls**: Only AI responses are sent to Google's servers
- **Offline Mode**: App works with local responses when offline

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### "Unable to get a response" Error
- Check your internet connection
- Verify your API key is correct and active
- Check browser console for errors
- Try refreshing the page

### API Quota Exceeded
- Check your Google AI Studio dashboard
- Upgrade your API plan if needed
- Wait for quota reset

### App Not Loading
- Ensure you're serving the files from a local server (not opening HTML directly)
- Check browser console for JavaScript errors
- Clear browser cache and localStorage

## License

This project is open source. Feel free to use, modify, and distribute.

## Acknowledgments

- Built with Google's Gemini AI
- Icons from various open source projects
- Inspired by modern chat interfaces

---

**Enjoy chatting with NeuralChat! 🤖✨**</content>
<parameter name="filePath">README.md