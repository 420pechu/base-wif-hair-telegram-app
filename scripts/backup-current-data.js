#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://base-wif-hair-telegram-app.onrender.com';

// Create backup directory
const backupDir = path.join(__dirname, '../backup');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filename, () => {}); // Delete the file async
            reject(err);
        });
    });
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function backupData() {
    console.log('🔄 Starting backup of current live data...');
    
    try {
        // Step 1: Get all image metadata
        console.log('📋 Fetching image metadata...');
        const imagesData = await fetchJSON(`${BASE_URL}/api/gallery/images?limit=1000&sortBy=recent`);
        
        // Save metadata as JSON
        const metadataFile = path.join(backupDir, 'images-metadata.json');
        fs.writeFileSync(metadataFile, JSON.stringify(imagesData, null, 2));
        console.log(`✅ Saved metadata for ${imagesData.length} images to ${metadataFile}`);
        
        // Step 2: Download all images
        console.log('🖼️ Downloading image files...');
        const imagesDir = path.join(backupDir, 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        let downloadCount = 0;
        for (const image of imagesData) {
            try {
                const imageUrl = `${BASE_URL}/api/gallery/image/${image.id}`;
                const imagePath = path.join(imagesDir, image.filename);
                
                await downloadFile(imageUrl, imagePath);
                downloadCount++;
                console.log(`✅ Downloaded: ${image.filename} (${downloadCount}/${imagesData.length})`);
            } catch (error) {
                console.error(`❌ Failed to download ${image.filename}:`, error.message);
            }
        }
        
        console.log('🎉 Backup completed!');
        console.log(`📁 Backup saved to: ${backupDir}`);
        console.log(`📊 Images metadata: ${metadataFile}`);
        console.log(`🖼️ Images: ${imagesDir}`);
        console.log(`📈 Downloaded: ${downloadCount}/${imagesData.length} images`);
        
    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
}

if (require.main === module) {
    backupData();
}

module.exports = backupData; 