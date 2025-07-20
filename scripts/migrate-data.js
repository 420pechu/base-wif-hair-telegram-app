#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Migration script for moving data to persistent storage
async function migrateData() {
    console.log('🔄 Starting data migration...');
    
    const persistentDir = process.env.PERSISTENT_DIR || path.join(__dirname, '../backend/persistent');
    const uploadsDir = path.join(persistentDir, 'uploads');
    const dataDir = path.join(persistentDir, 'data');
    
    // Create directories
    if (!fs.existsSync(persistentDir)) {
        fs.mkdirSync(persistentDir, { recursive: true });
        console.log('✅ Created persistent directory');
    }
    
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('✅ Created uploads directory');
    }
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('✅ Created data directory');
    }
    
    // Copy existing data if it exists
    const oldDataPath = path.join(__dirname, '../backend/data/gallery.db');
    const newDataPath = path.join(dataDir, 'gallery.db');
    
    if (fs.existsSync(oldDataPath) && !fs.existsSync(newDataPath)) {
        fs.copyFileSync(oldDataPath, newDataPath);
        console.log('✅ Migrated database to persistent storage');
    }
    
    // Copy existing uploads if they exist
    const oldUploadsPath = path.join(__dirname, '../backend/uploads');
    if (fs.existsSync(oldUploadsPath)) {
        const files = fs.readdirSync(oldUploadsPath);
        for (const file of files) {
            const oldFile = path.join(oldUploadsPath, file);
            const newFile = path.join(uploadsDir, file);
            if (!fs.existsSync(newFile)) {
                fs.copyFileSync(oldFile, newFile);
                console.log(`✅ Migrated image: ${file}`);
            }
        }
    }
    
    console.log('🎉 Migration completed!');
}

if (require.main === module) {
    migrateData().catch(console.error);
}

module.exports = migrateData; 