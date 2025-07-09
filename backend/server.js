const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const Database = require('./models/database');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', express.static(path.join(__dirname, '../frontend')));

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

// Telegram authentication validation
function validateTelegramAuth(initData) {
    if (!initData) {
        return { valid: false, error: 'No init data provided' };
    }

    try {
        // In production, you should validate the Telegram auth data
        // For now, we'll do basic validation
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        // For development, we'll accept any valid-looking data
        // In production, validate with HMAC-SHA256 using bot token
        if (!hash) {
            return { valid: false, error: 'Invalid auth data' };
        }

        // Extract user data
        const userParam = urlParams.get('user');
        if (!userParam) {
            return { valid: false, error: 'No user data' };
        }

        const user = JSON.parse(decodeURIComponent(userParam));
        return { valid: true, user };
    } catch (error) {
        console.error('Auth validation error:', error);
        return { valid: false, error: 'Invalid auth format' };
    }
}

// Routes

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
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

// Get all gallery images (sorted by likes)
app.get('/api/gallery/images', async (req, res) => {
    try {
        const images = await db.getAllImages();
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

        // Verify user ID matches
        if (authResult.user.id.toString() !== userId) {
            fs.unlinkSync(req.file.path);
            return res.status(401).json({ error: 'User ID mismatch' });
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

        // Validate Telegram auth
        const authResult = validateTelegramAuth(initData);
        if (!authResult.valid) {
            return res.status(401).json({ error: 'Unauthorized: ' + authResult.error });
        }

        // Verify user ID matches
        if (authResult.user.id.toString() !== userId) {
            return res.status(401).json({ error: 'User ID mismatch' });
        }

        // Check if image exists
        const image = await db.getImageById(id);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Toggle like
        const result = await db.toggleLike(id, userId);
        
        res.json({
            success: true,
            liked: result.liked,
            totalLikes: result.totalLikes
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