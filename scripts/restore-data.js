#!/usr/bin/env node

const Database = require('../backend/models/database');
const fs = require('fs');
const path = require('path');

// Restore script to recreate all data from backup
async function restoreData() {
    console.log('🔄 Starting data restoration...');
    
    try {
        // Initialize database connection
        const db = new Database();
        console.log('✅ Database connection established');
        
        // Check if backup data exists
        const backupDataPath = path.join(__dirname, '../backup-data.json');
        if (!fs.existsSync(backupDataPath)) {
            console.error('❌ backup-data.json not found!');
            console.log('📝 Please create backup-data.json with your image metadata');
            return;
        }
        
        // Load backup data
        const backupData = JSON.parse(fs.readFileSync(backupDataPath, 'utf8'));
        console.log(`📋 Loaded ${backupData.length} images from backup`);
        
        // Restore each image record
        let restoredCount = 0;
        let skippedCount = 0;
        
        for (const imageData of backupData) {
            try {
                // Check if image already exists
                const existingImage = await db.getImageById(imageData.id);
                if (existingImage) {
                    console.log(`⏭️ Skipping ${imageData.filename} (already exists)`);
                    skippedCount++;
                    continue;
                }
                
                // Create image record with original ID and timestamp
                await db.createImageWithId({
                    id: imageData.id,
                    userId: imageData.userId,
                    userName: imageData.userName,
                    filename: imageData.filename,
                    originalName: imageData.originalName,
                    size: imageData.size || 0,
                    mimeType: 'image/png',
                    createdAt: imageData.createdAt,
                    likes: imageData.likes || 0
                });
                
                restoredCount++;
                console.log(`✅ Restored: ${imageData.fileName || imageData.filename} (${imageData.likes} likes)`);
                
            } catch (error) {
                console.error(`❌ Failed to restore ${imageData.filename}:`, error.message);
            }
        }
        
        console.log('\n🎉 Data restoration completed!');
        console.log(`📊 Summary:`);
        console.log(`   ✅ Restored: ${restoredCount} images`);
        console.log(`   ⏭️ Skipped: ${skippedCount} images (already existed)`);
        console.log(`   📁 Total: ${backupData.length} images processed`);
        
        // Close database connection
        await db.close();
        
    } catch (error) {
        console.error('❌ Restoration failed:', error);
    }
}

if (require.main === module) {
    restoreData();
}

module.exports = restoreData; 