#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://base-wif-hair-telegram-app.onrender.com';

function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            } else {
                file.close();
                fs.unlink(filename, () => {}); // Delete the file async
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
        }).on('error', (err) => {
            file.close();
            fs.unlink(filename, () => {}); // Delete the file async
            reject(err);
        });
    });
}

async function downloadImages() {
    console.log('🔄 Starting image download...');
    
    try {
        // Check if backup data exists
        const backupDataPath = path.join(__dirname, '../backup-data.json');
        if (!fs.existsSync(backupDataPath)) {
            console.error('❌ backup-data.json not found!');
            console.log('📝 Please create backup-data.json with your image metadata first');
            return;
        }
        
        // Load backup data
        const backupData = JSON.parse(fs.readFileSync(backupDataPath, 'utf8'));
        console.log(`📋 Found ${backupData.length} images to download`);
        
        // Create images directory
        const imagesDir = path.join(__dirname, '../downloaded-images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        let downloadCount = 0;
        let failedCount = 0;
        
        for (const image of backupData) {
            try {
                const imageUrl = `${BASE_URL}/api/gallery/image/${image.id}`;
                const imagePath = path.join(imagesDir, image.filename);
                
                // Skip if already downloaded
                if (fs.existsSync(imagePath)) {
                    console.log(`⏭️ Skipping ${image.filename} (already exists)`);
                    continue;
                }
                
                await downloadFile(imageUrl, imagePath);
                downloadCount++;
                console.log(`✅ Downloaded: ${image.filename} (${downloadCount}/${backupData.length})`);
                
                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                failedCount++;
                console.error(`❌ Failed to download ${image.filename}:`, error.message);
            }
        }
        
        console.log('\n🎉 Image download completed!');
        console.log(`📊 Summary:`);
        console.log(`   ✅ Downloaded: ${downloadCount} images`);
        console.log(`   ❌ Failed: ${failedCount} images`);
        console.log(`   📁 Saved to: ${imagesDir}`);
        
    } catch (error) {
        console.error('❌ Download failed:', error);
    }
}

if (require.main === module) {
    downloadImages();
}

module.exports = downloadImages; 