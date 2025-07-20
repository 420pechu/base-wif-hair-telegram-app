# Base Wif Hair - Telegram Mini App 🦱⛓️

A Telegram Mini App that lets users add stylish wigs to their photos and compete on a community leaderboard. Built for the Base Wif Hair memecoin community.

## Features ✨

### 🎨 Image Processing
- Upload photos from camera or gallery
- Add customizable wig overlays with:
  - Size adjustment
  - Position control (X/Y)
  - Rotation
  - Opacity settings
  - Touch drag and drop positioning
- High-definition image download
- Real-time preview

### 🌟 Community Features
- Public gallery with leaderboard
- Like/unlike system for images
- User authentication via Telegram
- Personal image gallery
- Most liked images ranking

### 🔐 Security
- Telegram Web App authentication
- User verification for all actions
- Secure file upload handling
- Input validation and sanitization

## Project Structure 📁

```
Telegram Mini App/
├── frontend/                 # HTML/CSS/JS frontend
│   └── index.html           # Main Mini App interface
├── backend/                 # Node.js/Express backend
│   ├── server.js           # Main server file
│   ├── models/
│   │   └── database.js     # SQLite database operations
│   ├── setup.js            # Database setup script
│   ├── data/               # SQLite database files
│   └── uploads/            # User uploaded images
├── assets/                  # Static assets
│   ├── wig.png             # Wig overlay image
│   ├── wiflogo.png         # App logo
│   └── TG.png              # Telegram icon
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## Installation & Setup 🚀

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- A Telegram Bot (for Mini App integration)

### 1. Install Dependencies
```bash
cd "Telegram Mini App"
npm install
```

### 2. Run Setup
```bash
npm run setup
```

This will:
- Initialize the SQLite database
- Create necessary directories
- Verify all assets are present
- Display setup completion status

### 3. Start the Application

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The app will be available at `http://localhost:3000`

## Telegram Bot Integration 🤖

### 1. Create a Telegram Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot`
3. Save your bot token

### 2. Configure Mini App
1. Use `/newapp` with BotFather
2. Select your bot
3. Provide app details:
   - **Name:** Base Wif Hair
   - **Description:** Add hair, get famous! Upload photos and add stylish wigs.
   - **Photo:** Upload the app icon
   - **Demo GIF:** Optional demo of the app
   - **Web App URL:** Your deployed app URL

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
BOT_TOKEN=your_telegram_bot_token_here
PORT=3000
NODE_ENV=production
```

## API Endpoints 🔌

### Gallery Endpoints
- `GET /api/gallery/images` - Get all images sorted by likes
- `GET /api/gallery/image/:id` - Get specific image file
- `POST /api/gallery/upload` - Upload new image to gallery
- `POST /api/gallery/like/:id` - Like/unlike an image
- `DELETE /api/gallery/image/:id` - Delete image (owner only)

### User Endpoints
- `GET /api/user/:userId/images` - Get user's uploaded images
- `GET /api/user/:userId/likes` - Get user's liked images

### Health Check
- `GET /health` - Server health status

## Database Schema 💾

### Images Table
```sql
CREATE TABLE images (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    filename TEXT NOT NULL,
    originalName TEXT,
    size INTEGER,
    mimeType TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0
);
```

### Likes Table
```sql
CREATE TABLE likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imageId TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (imageId) REFERENCES images (id) ON DELETE CASCADE,
    UNIQUE(imageId, userId)
);
```

### Users Table
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    username TEXT,
    languageCode TEXT,
    lastActive DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Frontend Features 🎨

### User Interface
- **Clean Design:** Matches the main Base Wif Hair website aesthetic
- **Mobile Optimized:** Perfect for Telegram mobile experience
- **Touch Controls:** Drag and drop wig positioning
- **Real-time Sliders:** Instant visual feedback for adjustments

### Image Processing
- **Canvas-based:** HTML5 Canvas for smooth rendering
- **High Quality:** 2x scaling for downloads
- **Multiple Formats:** Support for all common image types
- **File Size Limits:** 10MB maximum for uploads

### Gallery System
- **Grid Layout:** Responsive image grid
- **Modal Viewer:** Full-size image viewing
- **Like Counter:** Real-time like counts
- **User Attribution:** Creator names and timestamps

## Deployment 🌐

### Local Development
```bash
npm run dev
```

### Production Deployment

**Using PM2:**
```bash
npm install -g pm2
pm2 start backend/server.js --name "base-wif-hair-mini-app"
```

**Using Docker:**
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**Environment Variables for Production:**
- `BOT_TOKEN` - Your Telegram bot token
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to "production"

## Security Considerations 🔒

### Telegram Authentication
- Validates `initData` from Telegram WebApp
- Verifies user ID consistency
- HMAC-SHA256 validation (implement in production)

### File Upload Security
- File type validation
- Size limitations
- Virus scanning (recommended for production)
- Secure filename generation

### API Security
- Input validation and sanitization
- Rate limiting (implement for production)
- CORS configuration
- Helmet.js security headers

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting 🔧

### Common Issues

**Database errors:**
- Ensure SQLite3 is properly installed
- Check directory permissions for `backend/data/`

**Asset loading issues:**
- Verify all assets are in `assets/` directory
- Check file permissions

**Telegram integration:**
- Ensure bot token is correctly set
- Verify Mini App URL is accessible
- Check Telegram WebApp SDK loading

**Upload failures:**
- Check `backend/uploads/` directory permissions
- Verify file size limits
- Ensure proper mime type handling

### Debug Mode
Set environment variable for detailed logging:
```bash
DEBUG=* npm run dev
```

## License 📄

MIT License - feel free to use this code for your own projects!

## Support 💬

For support and questions:
- Join our Telegram community
- Check GitHub issues
- Contact the Base Wif Hair team

---

**Built with ❤️ for the Base Wif Hair community**

*Bringing hair onchain, one wig at a time! 🦱⛓️* 

## Data Persistence on Render

### Problem
When deploying on Render, the container's filesystem is ephemeral, meaning all uploaded images and database data get deleted on each deployment.

### Solution: Persistent Disk Migration

#### Step 1: Before Next Deployment - Backup Current Data
1. Login to your admin panel: `https://your-app.onrender.com/admin/login`
2. Download your current database: `https://your-app.onrender.com/backup/database`
3. Download your current images: `https://your-app.onrender.com/backup/images`

#### Step 2: Set up Persistent Disk on Render
1. Go to your Render service dashboard
2. Navigate to "Settings" → "Disks"
3. Add a new disk:
   - **Mount Path**: `/app/backend/persistent`
   - **Size**: 1GB (or more if needed)

#### Step 3: Update Environment Variables
In your Render service settings, add:
```
PERSISTENT_DIR=/app/backend/persistent
```

#### Step 4: Deploy Updated Code
Deploy this updated code that supports persistent storage.

#### Step 5: Restore Your Data
1. Access your admin panel: `https://your-app.onrender.com/admin/login`
2. Use the restore endpoints to upload your backed-up data
3. Extract images to the persistent uploads directory

### Future Deployments
After setting up persistent storage, your data will be preserved across deployments! 