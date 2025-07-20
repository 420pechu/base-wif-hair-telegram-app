#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://base-wif-hair-telegram-app.onrender.com';
const ADMIN_PASSWORD = 'clamoredwashere';

// Login and get admin token
async function getAdminToken() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ password: ADMIN_PASSWORD });
        
        const options = {
            hostname: 'base-wif-hair-telegram-app.onrender.com',
            port: 443,
            path: '/admin/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.success) {
                        resolve(result.token);
                    } else {
                        reject(new Error(result.error || 'Login failed'));
                    }
                } catch (e) {
                    reject(new Error('Invalid response from server'));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

// Upload single image
async function uploadImage(token, imagePath, filename) {
    return new Promise((resolve, reject) => {
        const boundary = '----formdata-' + Math.random().toString(36);
        const CRLF = '\r\n';
        
        const imageBuffer = fs.readFileSync(imagePath);
        
        let formData = '';
        formData += '--' + boundary + CRLF;
        formData += 'Content-Disposition: form-data; name="image"; filename="' + filename + '"' + CRLF;
        formData += 'Content-Type: image/png' + CRLF + CRLF;
        
        const formDataBuffer = Buffer.concat([
            Buffer.from(formData, 'utf8'),
            imageBuffer,
            Buffer.from(CRLF + '--' + boundary + '--' + CRLF, 'utf8')
        ]);

        const options = {
            hostname: 'base-wif-hair-telegram-app.onrender.com',
            port: 443,
            path: `/restore/image/${filename}`,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'Content-Length': formDataBuffer.length,
                'X-Admin-Token': token
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    reject(new Error('Invalid response: ' + data));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(formDataBuffer);
        req.end();
    });
}

async function uploadAllImages() {
    console.log('🔄 Starting image upload process...');
    
    try {
        // Step 1: Login and get token
        console.log('🔐 Logging in...');
        const token = await getAdminToken();
        console.log('✅ Successfully logged in');
        
        // Step 2: Get list of images to upload
        const imagesDir = path.join(__dirname, '../downloaded-images');
        if (!fs.existsSync(imagesDir)) {
            console.error('❌ downloaded-images directory not found!');
            return;
        }
        
        const imageFiles = fs.readdirSync(imagesDir).filter(file => 
            file.toLowerCase().endsWith('.png') || 
            file.toLowerCase().endsWith('.jpg') || 
            file.toLowerCase().endsWith('.jpeg')
        );
        
        console.log(`📁 Found ${imageFiles.length} images to upload`);
        
        // Step 3: Upload each image
        let uploadedCount = 0;
        let failedCount = 0;
        
        for (const filename of imageFiles) {
            try {
                const imagePath = path.join(imagesDir, filename);
                console.log(`⬆️ Uploading: ${filename}...`);
                
                const result = await uploadImage(token, imagePath, filename);
                
                if (result.success) {
                    uploadedCount++;
                    console.log(`✅ Uploaded: ${filename} (${uploadedCount}/${imageFiles.length})`);
                } else {
                    failedCount++;
                    console.error(`❌ Failed: ${filename} - ${result.error || 'Unknown error'}`);
                }
                
                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                failedCount++;
                console.error(`❌ Failed: ${filename} - ${error.message}`);
            }
        }
        
        console.log('\n🎉 Upload process completed!');
        console.log(`📊 Summary:`);
        console.log(`   ✅ Uploaded: ${uploadedCount} images`);
        console.log(`   ❌ Failed: ${failedCount} images`);
        console.log(`   📁 Total: ${imageFiles.length} images processed`);
        
        if (uploadedCount > 0) {
            console.log('\n🔗 Check your gallery: https://base-wif-hair-telegram-app.onrender.com/leaderboard');
        }
        
    } catch (error) {
        console.error('❌ Upload process failed:', error.message);
    }
}

if (require.main === module) {
    uploadAllImages();
}

module.exports = uploadAllImages; 