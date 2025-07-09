const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const Database = require('./models/database');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', express.static(path.join(__dirname, '../frontend')));

// Admin page route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Password protection middleware for moderation
const MODERATION_PASSWORD = 'clamoredwashere';
const authenticatedSessions = new Set();

function requireModAuth(req, res, next) {
    const sessionId = req.headers['x-session-id'] || req.query.session;
    
    if (authenticatedSessions.has(sessionId)) {
        next();
    } else {
        res.sendFile(path.join(__dirname, '../frontend/mod-login.html'));
    }
}

// Moderation login endpoint
app.post('/api/mod-login', (req, res) => {
    const { password } = req.body;
    
    if (password === MODERATION_PASSWORD) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        authenticatedSessions.add(sessionId);
        
        // Session expires after 24 hours
        setTimeout(() => {
            authenticatedSessions.delete(sessionId);
        }, 24 * 60 * 60 * 1000);
        
        res.json({ success: true, sessionId });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// Secure moderation panel route (password protected)
app.get('/mod-panel-x7k9m2n8p4q1', requireModAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/moderation.html'));
});

// Get all images for moderation (with more details) - password protected
app.get('/api/admin/images', requireModAuth, async (req, res) => {
    try {
        const images = await db.getAllImages(1000, 'recent'); // Get all images
        
        // Add more details for moderation
        const detailedImages = images.map(image => ({
            ...image,
            createdDate: new Date(image.createdAt).toLocaleString(),
            fileSizeKB: image.fileSize ? Math.round(image.fileSize / 1024) : 'Unknown'
        }));
        
        res.json({ success: true, images: detailedImages });
            } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete selected images - password protected
app.delete('/api/admin/images', requireModAuth, async (req, res) => {
    try {
        const { imageIds } = req.body;
        
        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No image IDs provided' });
        }
        

        
        let deletedCount = 0;
        let errors = [];
        
        for (const imageId of imageIds) {
            try {
                // Get image info before deletion
                const image = await db.getImageById(imageId);
                
                if (image) {
                    // Delete from database
                    await db.deleteImage(imageId);
                    
                    // Delete physical file if it exists
                    if (image.filename) {
                        const filePath = path.join(__dirname, 'uploads', image.filename);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                    
                    deletedCount++;
                } else {
                    errors.push(`Image ${imageId} not found`);
                }
                            } catch (error) {
                errors.push(`Failed to delete image ${imageId}: ${error.message}`);
            }
        }
        
        res.json({
            success: true,
            deletedCount,
            totalRequested: imageIds.length,
            errors: errors.length > 0 ? errors : null,
            message: `Successfully deleted ${deletedCount} of ${imageIds.length} images`
        });
        
            } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'wig-creation-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Telegram Bot Token (replace with your actual bot token for production)
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// Bot command handlers
const botCommands = {
    '/start': async (chatId, messageId, userInfo) => {
        const welcomeMessage = `
🦱 *Welcome to Base Wif Hair!*

Transform your photos with stylish wigs and compete on our community leaderboard!

*Available Commands:*
/help - Show this help message
/leaderboard - View top community creations
/stats - Community statistics
/start - Show welcome message

*Mini App:* Use the button below to start creating! 👇

Create your Base Wif Hair masterpiece now!
        `.trim();

        const keyboard = {
            inline_keyboard: [[
                {
                    text: "🎨 Open Mini App",
                    web_app: { url: process.env.WEB_APP_URL || 'https://base-wif-hair-telegram-app.onrender.com' }
                }
            ]]
        };

        await sendTelegramMessage(chatId, welcomeMessage, { reply_markup: keyboard, parse_mode: 'Markdown' });
    },

    '/help': async (chatId, messageId, userInfo) => {
        const helpMessage = `
🆘 *Base Wif Hair Help*

*What is Base Wif Hair?*
Transform your photos by adding stylish wigs! Upload a photo, customize the wig placement, and share your creation with the community.

*How to use:*
1️⃣ Use the Mini App to upload your photo
2️⃣ Adjust wig size, position, and rotation
3️⃣ Share to community leaderboard
4️⃣ Like other creations and compete for the top spot!

*Commands:*
/start - Welcome message & Mini App access
/leaderboard - View top community creations
/stats - Community statistics & insights
/help - This help message

*Mini App Features:*
• Photo upload & wig overlay
• Real-time preview with drag controls
• Community gallery with likes
• Send creations to your DM
• Sort by Most Liked or Most Recent

Ready to create? Use the Mini App! 🎨
        `.trim();

        const keyboard = {
            inline_keyboard: [[
                {
                    text: "🎨 Open Mini App",
                    web_app: { url: process.env.WEB_APP_URL || 'https://base-wif-hair-telegram-app.onrender.com' }
                }
            ]]
        };

        await sendTelegramMessage(chatId, helpMessage, { reply_markup: keyboard, parse_mode: 'Markdown' });
    },

    '/leaderboard': async (chatId, messageId, userInfo) => {
        try {
            // Get top 10 images
            const images = await db.getAllImages(10, 'likes');
            
            if (images.length === 0) {
                await sendTelegramMessage(chatId, "🦱 No creations yet! Be the first to share your Base Wif Hair creation!");
                return;
            }

            let leaderboardMessage = "🏆 *Base Wif Hair Leaderboard* 🏆\n\n";
            
            images.forEach((image, index) => {
                const position = index + 1;
                const emoji = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🔸";
                const timeAgo = getTimeAgo(new Date(image.createdAt));
                
                leaderboardMessage += `${emoji} *${position}.* ${image.userName || 'Anonymous'}\n`;
                leaderboardMessage += `    ❤️ ${image.likes || 0} likes • ${timeAgo}\n\n`;
            });

            leaderboardMessage += `🎨 *Want to join the leaderboard?*\nCreate your Base Wif Hair masterpiece!`;

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: "🎨 Create Now",
                            web_app: { url: process.env.WEB_APP_URL || 'https://base-wif-hair-telegram-app.onrender.com' }
                        }
                    ],
                    [
                        {
                            text: "📊 View Full Leaderboard",
                            web_app: { url: `${process.env.WEB_APP_URL || 'https://base-wif-hair-telegram-app.onrender.com'}/leaderboard` }
                        }
                    ]
                ]
            };

            await sendTelegramMessage(chatId, leaderboardMessage, { reply_markup: keyboard, parse_mode: 'Markdown' });
            
        } catch (error) {
            await sendTelegramMessage(chatId, "❌ Sorry, couldn't load the leaderboard right now. Please try again later!");
        }
    },

    '/stats': async (chatId, messageId, userInfo) => {
        try {
            // Get community stats
            const allImages = await db.getAllImages(1000, 'recent');
            const topImages = await db.getAllImages(10, 'likes');
            
            const totalCreations = allImages.length;
            const totalLikes = allImages.reduce((sum, img) => sum + (img.likes || 0), 0);
            const topCreator = topImages.length > 0 ? topImages[0] : null;
            
            // Calculate time periods
            const now = new Date();
            const last24h = allImages.filter(img => 
                (now - new Date(img.createdAt)) < 24 * 60 * 60 * 1000
            ).length;
            const last7d = allImages.filter(img => 
                (now - new Date(img.createdAt)) < 7 * 24 * 60 * 60 * 1000
            ).length;

            let statsMessage = `📊 *Base Wif Hair Community Stats*\n\n`;
            statsMessage += `🎨 **Total Creations:** ${totalCreations}\n`;
            statsMessage += `❤️ **Total Likes:** ${totalLikes}\n`;
            statsMessage += `📅 **Last 24h:** ${last24h} creations\n`;
            statsMessage += `📅 **Last 7d:** ${last7d} creations\n\n`;
            
            if (topCreator) {
                statsMessage += `👑 **Current Leader:**\n`;
                statsMessage += `    ${topCreator.userName || 'Anonymous'} (${topCreator.likes || 0} likes)\n\n`;
            }
            
            statsMessage += `🚀 **Join the community!** Create your Base Wif Hair masterpiece and compete for the top spot!`;

            const keyboard = {
                inline_keyboard: [[
                    {
                        text: "🎨 Create Now",
                        web_app: { url: process.env.WEB_APP_URL || 'https://base-wif-hair-telegram-app.onrender.com' }
                    }
                ]]
            };

            await sendTelegramMessage(chatId, statsMessage, { reply_markup: keyboard, parse_mode: 'Markdown' });
            
        } catch (error) {
            await sendTelegramMessage(chatId, "❌ Sorry, couldn't load the stats right now. Please try again later!");
        }
    }
};

// Helper function to send Telegram messages
async function sendTelegramMessage(chatId, text, options = {}) {
    try {
        if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
            return { success: false, error: 'Bot token not configured' };
        }

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: text,
            ...options
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (!result.ok) {
            throw new Error(result.description || 'Failed to send message');
        }

        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Helper function for time ago formatting
function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
}

// Function to send image to user via Telegram bot
async function sendImageToTelegramUser(userId, imageBuffer, caption = 'Your Base Wif Hair creation! 🦱') {
    try {
        if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
            console.log('Bot token not configured, simulating message send');
            return { success: true, message: 'Image sent to your DM! (demo mode)' };
        }

        // Create multipart form data manually
        const boundary = '----formdata-' + Math.random().toString(36);
        const CRLF = '\r\n';
        
        let formData = '';
        formData += '--' + boundary + CRLF;
        formData += 'Content-Disposition: form-data; name="chat_id"' + CRLF + CRLF;
        formData += userId + CRLF;
        
        formData += '--' + boundary + CRLF;
        formData += 'Content-Disposition: form-data; name="caption"' + CRLF + CRLF;
        formData += caption + CRLF;
        
        formData += '--' + boundary + CRLF;
        formData += 'Content-Disposition: form-data; name="photo"; filename="base-wif-hair.png"' + CRLF;
        formData += 'Content-Type: image/png' + CRLF + CRLF;
        
        const formDataBuffer = Buffer.concat([
            Buffer.from(formData, 'utf8'),
            imageBuffer,
            Buffer.from(CRLF + '--' + boundary + '--' + CRLF, 'utf8')
        ]);

        return new Promise((resolve) => {
            const url = new URL(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`);
            
            const options = {
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data; boundary=' + boundary,
                    'Content-Length': formDataBuffer.length
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        if (result.ok) {
                            resolve({ success: true, message: 'Image sent to your DM successfully!' });
                        } else {
                            resolve({ success: false, error: result.description || 'Failed to send message' });
                        }
                    } catch (error) {
                        resolve({ success: false, error: 'Invalid response from Telegram API' });
                    }
                });
            });

            req.on('error', (error) => {
                console.error('HTTPS request error:', error);
                resolve({ success: false, error: error.message });
            });

            req.write(formDataBuffer);
            req.end();
        });
    } catch (error) {
        console.error('Error sending image to Telegram:', error);
        return { success: false, error: error.message };
    }
}

// Telegram authentication validation
function validateTelegramAuth(initData) {
    if (!initData) {
        return { valid: false, error: 'No init data provided' };
    }

    // Handle demo/test mode
    if (initData === 'demo' || initData.startsWith('test_')) {
        console.log('Demo mode detected, creating mock user');
        return { 
            valid: true, 
            user: { 
                id: 'demo_user', // Always use consistent demo_user ID
                first_name: 'Demo User',
                username: 'demo'
            }
        };
    }

    try {
        // In production, you should validate the Telegram auth data
        // For now, we'll do basic validation
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        console.log('Auth validation - URL params:', Object.fromEntries(urlParams));
        console.log('Auth validation - Hash:', hash);
        
        // For development, we'll accept any valid-looking data
        // In production, validate with HMAC-SHA256 using bot token
        if (!hash) {
            return { valid: false, error: 'Invalid auth data - no hash' };
        }

        // Extract user data
        const userParam = urlParams.get('user');
        if (!userParam) {
            return { valid: false, error: 'No user data in initData' };
        }

        console.log('Auth validation - User param:', userParam);
        
        const user = JSON.parse(decodeURIComponent(userParam));
        console.log('Auth validation - Parsed user:', user);
        
        // Ensure user ID is present
        if (!user.id) {
            return { valid: false, error: 'No user ID in auth data' };
        }
        
        return { valid: true, user };
    } catch (error) {
        console.error('Auth validation error:', error);
        return { valid: false, error: 'Invalid auth format: ' + error.message };
    }
}

// Routes

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve leaderboard page
app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/leaderboard.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API status check
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'connected'
    });
});

// API Routes

// Get all gallery images with sorting options
app.get('/api/gallery/images', async (req, res) => {
    try {
        const { sortBy = 'likes', limit = 50 } = req.query;
        const images = await db.getAllImages(parseInt(limit), sortBy);
        res.json(images);
    } catch (error) {
        console.error('Error fetching gallery images:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

// Get specific image
app.get('/api/gallery/image/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const image = await db.getImageById(id);
        
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const imagePath = path.join(uploadsDir, image.filename);
        
        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({ error: 'Image file not found' });
        }

        res.sendFile(imagePath);
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).json({ error: 'Failed to serve image' });
    }
});

// Upload image to gallery
app.post('/api/gallery/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const { userId, userName, initData } = req.body;

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        if (!authResult.valid) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        // Verify user ID matches (convert both to strings for comparison)
        const authUserId = String(authResult.user.id);
        const requestUserId = String(userId);
        console.log('Upload - Comparing user IDs:', authUserId, 'vs', requestUserId);
        
        if (authUserId !== requestUserId) {
            console.log('Upload - User ID mismatch detected!');
            console.log('Upload - Auth user ID:', authUserId);
            console.log('Upload - Request user ID:', requestUserId);
            console.log('Upload - Will proceed anyway for debugging...');
            
            // TEMPORARY: Allow mismatched user IDs for debugging
            // fs.unlinkSync(req.file.path);
            // return res.status(401).json({ 
            //     error: 'User ID mismatch',
            //     debug: {
            //         authUserId: authUserId,
            //         requestUserId: requestUserId
            //     }
            // });
        }

        // Save to database
        const imageId = await db.createImage({
            userId: userId,
            userName: userName || authResult.user.first_name,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype
        });

        res.json({ 
            success: true, 
            imageId: imageId,
            message: 'Image uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Like/unlike image
app.post('/api/gallery/like/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, initData } = req.body;

        console.log('Like request:', { id, userId, initData });

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        console.log('Auth result:', authResult);
        
        if (!authResult.valid) {
            console.log('Auth failed:', authResult.error);
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        // Verify user ID matches (convert both to strings for comparison)
        const authUserId = String(authResult.user.id);
        const requestUserId = String(userId);
        console.log('Comparing user IDs:', authUserId, 'vs', requestUserId);
        
        if (authUserId !== requestUserId) {
            console.log('User ID mismatch detected!');
            console.log('Auth user object:', authResult.user);
            console.log('Request userId:', userId);
            console.log('Will proceed anyway for debugging...');
            
            // TEMPORARY: Allow mismatched user IDs for debugging
            // In production, you should enable this check:
            // return res.status(401).json({ 
            //     error: 'User ID mismatch',
            //     debug: {
            //         authUserId: authUserId,
            //         requestUserId: requestUserId,
            //         authUser: authResult.user
            //     }
            // });
        }

        // Check if image exists
        const image = await db.getImageById(id);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Toggle like
        const result = await db.toggleLike(id, userId);
        
        console.log('Like toggle successful for user:', userId, 'on image:', id);
        
        res.json({
            success: true,
            liked: result.liked,
            totalLikes: result.totalLikes,
            message: result.liked ? 'Image liked!' : 'Like removed!'
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Get user's liked images
app.get('/api/user/:userId/likes', async (req, res) => {
    try {
        const { userId } = req.params;
        const { initData } = req.query;

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        if (!authResult.valid) {
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        if (authResult.user.id.toString() !== userId) {
            return res.status(401).json({ error: 'User ID mismatch' });
        }

        const likedImages = await db.getUserLikes(userId);
        res.json(likedImages);
    } catch (error) {
        console.error('Error fetching user likes:', error);
        res.status(500).json({ error: 'Failed to fetch user likes' });
    }
});

// Get user's uploaded images
app.get('/api/user/:userId/images', async (req, res) => {
    try {
        const { userId } = req.params;
        const { initData } = req.query;

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        if (!authResult.valid) {
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        if (authResult.user.id.toString() !== userId) {
            return res.status(401).json({ error: 'User ID mismatch' });
        }

        const userImages = await db.getUserImages(userId);
        res.json(userImages);
    } catch (error) {
        console.error('Error fetching user images:', error);
        res.status(500).json({ error: 'Failed to fetch user images' });
    }
});

// Delete image (only by owner)
app.delete('/api/gallery/image/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, initData } = req.body;

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        if (!authResult.valid) {
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        if (authResult.user.id.toString() !== userId) {
            return res.status(401).json({ error: 'User ID mismatch' });
        }

        // Check if image exists and user owns it
        const image = await db.getImageById(id);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        if (image.userId !== userId) {
            return res.status(403).json({ error: 'You can only delete your own images' });
        }

        // Delete file
        const imagePath = path.join(uploadsDir, image.filename);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        // Delete from database
        await db.deleteImage(id);

        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Send image to user's Telegram DM
app.post('/api/send-to-dm', async (req, res) => {
    try {
        const { userId, imageData, initData } = req.body;

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        if (!authResult.valid) {
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        // Verify user ID matches
        const authUserId = String(authResult.user.id);
        const requestUserId = String(userId);
        
        if (authUserId !== requestUserId) {
            return res.status(401).json({ error: 'User ID mismatch' });
        }

        // Convert base64 data URL to buffer
        if (!imageData || !imageData.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image data' });
        }

        const base64Data = imageData.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Send to Telegram
        const result = await sendImageToTelegramUser(userId, imageBuffer, 'Your Base Wif Hair creation! 🦱');

        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error sending image to DM:', error);
        res.status(500).json({ error: 'Failed to send image to DM' });
    }
});

// Telegram Bot Webhook Endpoint
app.post('/webhook/telegram', async (req, res) => {
    try {
        const update = req.body;

        // Handle different types of updates
        if (update.message) {
            await handleBotMessage(update.message);
        } else if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
        }

        res.status(200).json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Handle incoming bot messages
async function handleBotMessage(message) {
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const text = message.text;
    const userInfo = message.from;



    // Check if message is a command
    if (text && text.startsWith('/')) {
        const command = text.split(' ')[0].toLowerCase();
        
        if (botCommands[command]) {
            try {
                await botCommands[command](chatId, messageId, userInfo);
            } catch (error) {
                await sendTelegramMessage(chatId, "❌ Sorry, something went wrong processing your command. Please try again!");
            }
        } else {
            // Unknown command
            await sendTelegramMessage(chatId, `❓ Unknown command: ${command}\n\nUse /help to see available commands!`);
        }
    } else {
        // Not a command, send generic response
        const helpMessage = `
Hi ${userInfo.first_name}! 👋

I'm the Base Wif Hair bot! Use these commands:
• /start - Welcome & Mini App access
• /help - Detailed help
• /leaderboard - View top creations
• /stats - Community statistics

Or click the button below to start creating! 🎨
        `.trim();

        const keyboard = {
            inline_keyboard: [[
                {
                    text: "🎨 Open Mini App",
                    web_app: { url: process.env.WEB_APP_URL || 'https://base-wif-hair-telegram-app.onrender.com' }
                }
            ]]
        };

        await sendTelegramMessage(chatId, helpMessage, { reply_markup: keyboard });
    }
}

// Handle callback queries (button presses)
async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const queryId = callbackQuery.id;
    const data = callbackQuery.data;

    // Answer the callback query to remove loading state
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: queryId })
    });

    // Handle different callback data
    if (data === 'refresh_leaderboard') {
        await botCommands['/leaderboard'](chatId, null, callbackQuery.from);
    }
}

// Webhook setup endpoint
app.post('/setup-webhook', async (req, res) => {
    try {
        if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
            return res.json({ success: false, error: 'Bot token not configured' });
        }

        // Use webhook_url from request body, or fall back to environment variable
        const baseUrl = req.body.webhook_url || process.env.WEB_APP_URL || 'https://your-domain.com';
        const webhookUrl = `${baseUrl}/webhook/telegram`;
        

        
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query']
            })
        });

        const result = await response.json();
        
        if (result.ok) {
            res.json({ success: true, webhook_url: webhookUrl, result });
        } else {
            throw new Error(result.description);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get webhook info endpoint
app.get('/webhook-info', async (req, res) => {
    try {
        if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
            return res.json({ success: false, error: 'Bot token not configured' });
        }

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const result = await response.json();
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Base Wif Hair Telegram Mini App running on port ${PORT}`);
    console.log(`📱 Access the app at: http://localhost:${PORT}`);
    console.log(`🎨 Upload directory: ${uploadsDir}`);
});

module.exports = app; 