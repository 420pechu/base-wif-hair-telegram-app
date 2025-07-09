const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        const dbDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        this.dbPath = path.join(dbDir, 'gallery.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.init();
    }

    init() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create images table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS images (
                        id TEXT PRIMARY KEY,
                        userId TEXT NOT NULL,
                        userName TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        originalName TEXT,
                        size INTEGER,
                        mimeType TEXT,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        likes INTEGER DEFAULT 0
                    )
                `, (err) => {
                    if (err) console.error('Error creating images table:', err);
                });

                // Create likes table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS likes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        imageId TEXT NOT NULL,
                        userId TEXT NOT NULL,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (imageId) REFERENCES images (id) ON DELETE CASCADE,
                        UNIQUE(imageId, userId)
                    )
                `, (err) => {
                    if (err) console.error('Error creating likes table:', err);
                });

                // Create users table for storing user information
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        firstName TEXT,
                        lastName TEXT,
                        username TEXT,
                        languageCode TEXT,
                        lastActive DATETIME DEFAULT CURRENT_TIMESTAMP,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) console.error('Error creating users table:', err);
                });

                // Create indexes for better performance
                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_images_userId ON images(userId)
                `, (err) => {
                    if (err) console.error('Error creating userId index:', err);
                });

                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_images_likes ON images(likes DESC)
                `, (err) => {
                    if (err) console.error('Error creating likes index:', err);
                });

                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_likes_imageId ON likes(imageId)
                `, (err) => {
                    if (err) console.error('Error creating likes imageId index:', err);
                });

                this.db.run(`
                    CREATE INDEX IF NOT EXISTS idx_likes_userId ON likes(userId)
                `, (err) => {
                    if (err) console.error('Error creating likes userId index:', err);
                    resolve();
                });
            });
        });
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Image operations
    async createImage(imageData) {
        return new Promise((resolve, reject) => {
            const id = this.generateId();
            const { userId, userName, filename, originalName, size, mimeType } = imageData;
            
            this.db.run(`
                INSERT INTO images (id, userId, userName, filename, originalName, size, mimeType)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id, userId, userName, filename, originalName, size, mimeType], function(err) {
                if (err) {
                    console.error('Error creating image:', err);
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    async getAllImages(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, userId, userName, filename, originalName, createdAt, likes
                FROM images
                ORDER BY likes DESC, createdAt DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    console.error('Error fetching all images:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getImageById(imageId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT *
                FROM images
                WHERE id = ?
            `, [imageId], (err, row) => {
                if (err) {
                    console.error('Error fetching image by ID:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getUserImages(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, userId, userName, filename, originalName, createdAt, likes
                FROM images
                WHERE userId = ?
                ORDER BY createdAt DESC
            `, [userId], (err, rows) => {
                if (err) {
                    console.error('Error fetching user images:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async deleteImage(imageId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                DELETE FROM images WHERE id = ?
            `, [imageId], function(err) {
                if (err) {
                    console.error('Error deleting image:', err);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Like operations
    async toggleLike(imageId, userId) {
        return new Promise((resolve, reject) => {
            // First check if like exists
            this.db.get(`
                SELECT id FROM likes WHERE imageId = ? AND userId = ?
            `, [imageId, userId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row) {
                    // Unlike - remove like
                    this.db.run(`
                        DELETE FROM likes WHERE imageId = ? AND userId = ?
                    `, [imageId, userId], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Decrease like count
                        this.db.run(`
                            UPDATE images SET likes = likes - 1 WHERE id = ?
                        `, [imageId], (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            // Get updated count
                            this.db.get(`
                                SELECT likes FROM images WHERE id = ?
                            `, [imageId], (err, row) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ liked: false, totalLikes: row.likes });
                                }
                            });
                        });
                    });
                } else {
                    // Like - add like
                    this.db.run(`
                        INSERT INTO likes (imageId, userId) VALUES (?, ?)
                    `, [imageId, userId], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Increase like count
                        this.db.run(`
                            UPDATE images SET likes = likes + 1 WHERE id = ?
                        `, [imageId], (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            // Get updated count
                            this.db.get(`
                                SELECT likes FROM images WHERE id = ?
                            `, [imageId], (err, row) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ liked: true, totalLikes: row.likes });
                                }
                            });
                        });
                    });
                }
            });
        });
    }

    async getUserLikes(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT i.id, i.userId, i.userName, i.filename, i.originalName, i.createdAt, i.likes, l.createdAt as likedAt
                FROM images i
                INNER JOIN likes l ON i.id = l.imageId
                WHERE l.userId = ?
                ORDER BY l.createdAt DESC
            `, [userId], (err, rows) => {
                if (err) {
                    console.error('Error fetching user likes:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async isImageLikedByUser(imageId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT id FROM likes WHERE imageId = ? AND userId = ?
            `, [imageId, userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    // User operations
    async upsertUser(userData) {
        return new Promise((resolve, reject) => {
            const { id, firstName, lastName, username, languageCode } = userData;
            
            this.db.run(`
                INSERT OR REPLACE INTO users 
                (id, firstName, lastName, username, languageCode, lastActive)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [id, firstName, lastName, username, languageCode], function(err) {
                if (err) {
                    console.error('Error upserting user:', err);
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    async getUserById(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM users WHERE id = ?
            `, [userId], (err, row) => {
                if (err) {
                    console.error('Error fetching user by ID:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Statistics
    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    (SELECT COUNT(*) FROM images) as totalImages,
                    (SELECT COUNT(*) FROM likes) as totalLikes,
                    (SELECT COUNT(DISTINCT userId) FROM images) as totalCreators,
                    (SELECT COUNT(DISTINCT userId) FROM likes) as totalLikers
            `, [], (err, rows) => {
                if (err) {
                    console.error('Error fetching stats:', err);
                    reject(err);
                } else {
                    resolve(rows[0]);
                }
            });
        });
    }

    async getTopImages(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, userId, userName, filename, originalName, createdAt, likes
                FROM images
                WHERE likes > 0
                ORDER BY likes DESC, createdAt DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    console.error('Error fetching top images:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed.');
                }
                resolve();
            });
        });
    }
}

module.exports = Database; 