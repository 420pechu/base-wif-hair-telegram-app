#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

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

// Fetch data from API
async function fetchJSON(url, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'base-wif-hair-telegram-app.onrender.com',
            port: 443,
            path: url,
            method: 'GET',
            headers: {}
        };

        if (token) {
            options.headers['X-Admin-Token'] = token;
        }

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: 'Invalid JSON', raw: data });
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Test image access
async function testImageAccess(imageId) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'base-wif-hair-telegram-app.onrender.com',
            port: 443,
            path: `/api/gallery/image/${imageId}`,
            method: 'HEAD' // Just check if exists
        };

        const req = https.request(options, (res) => {
            resolve({
                status: res.statusCode,
                headers: res.headers
            });
        });

        req.on('error', () => {
            resolve({ status: 'ERROR' });
        });

        req.end();
    });
}

async function debugSystem() {
    console.log('🔍 Starting system debug...\n');
    
    try {
        // 1. Test basic API
        console.log('1️⃣ Testing basic API...');
        const status = await fetchJSON('/api/status');
        console.log('   API Status:', status);
        
        // 2. Test gallery API (public)
        console.log('\n2️⃣ Testing gallery API...');
        const galleryImages = await fetchJSON('/api/gallery/images?limit=50');
        console.log(`   Gallery API returned: ${Array.isArray(galleryImages) ? galleryImages.length : 'ERROR'} images`);
        
        if (Array.isArray(galleryImages) && galleryImages.length > 0) {
            console.log('   Sample images:');
            galleryImages.slice(0, 3).forEach((img, i) => {
                console.log(`     ${i+1}. ${img.filename} - ${img.userName} - ${img.likes} likes`);
            });
        }
        
        // 3. Test admin access
        console.log('\n3️⃣ Testing admin access...');
        try {
            const token = await getAdminToken();
            console.log('   ✅ Admin login successful');
            
            // 4. Test admin images API
            console.log('\n4️⃣ Testing admin images API...');
            const adminImages = await fetchJSON('/api/admin/images', token);
            console.log(`   Admin API returned:`, adminImages.success ? `${adminImages.images.length} images` : adminImages.error);
            
            if (adminImages.success && adminImages.images.length > 0) {
                console.log('   Sample admin images:');
                adminImages.images.slice(0, 3).forEach((img, i) => {
                    console.log(`     ${i+1}. ${img.filename} - ${img.userName} - ${img.likes} likes`);
                });
            }
            
        } catch (error) {
            console.log('   ❌ Admin login failed:', error.message);
        }
        
        // 5. Test individual image access
        if (Array.isArray(galleryImages) && galleryImages.length > 0) {
            console.log('\n5️⃣ Testing image file access...');
            
            for (let i = 0; i < Math.min(3, galleryImages.length); i++) {
                const img = galleryImages[i];
                const result = await testImageAccess(img.id);
                console.log(`   Image ${img.filename}: HTTP ${result.status}`);
                
                if (result.status === 200) {
                    console.log(`     ✅ File accessible`);
                } else if (result.status === 404) {
                    console.log(`     ❌ File not found`);
                } else {
                    console.log(`     ⚠️ Unexpected status: ${result.status}`);
                }
            }
        }
        
        // 6. Summary
        console.log('\n📊 SUMMARY:');
        console.log('   Database records:', Array.isArray(galleryImages) ? galleryImages.length : 'UNKNOWN');
        console.log('   Expected files: 32');
        
        if (Array.isArray(galleryImages)) {
            if (galleryImages.length === 0) {
                console.log('   🔍 ISSUE: No database records found - database restoration may have failed');
            } else if (galleryImages.length < 32) {
                console.log(`   ⚠️ ISSUE: Only ${galleryImages.length}/32 records found - partial restoration`);
            } else {
                console.log('   ✅ Database records look good');
            }
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

if (require.main === module) {
    debugSystem();
}

module.exports = debugSystem; 