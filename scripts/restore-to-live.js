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

// Restore database records to live server
async function restoreRecords(token, records) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ records });
        
        const options = {
            hostname: 'base-wif-hair-telegram-app.onrender.com',
            port: 443,
            path: '/restore/database-records',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
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

        req.write(postData);
        req.end();
    });
}

async function restoreToLive() {
    console.log('🔄 Starting database restoration to live server...');
    
    try {
        // Step 1: Load backup data
        const backupDataPath = path.join(__dirname, '../backup-data.json');
        if (!fs.existsSync(backupDataPath)) {
            console.error('❌ backup-data.json not found!');
            console.log('📝 Please make sure backup-data.json exists in the project root');
            return;
        }
        
        const backupData = JSON.parse(fs.readFileSync(backupDataPath, 'utf8'));
        console.log(`📋 Loaded ${backupData.length} records from backup`);
        
        // Step 2: Login to live server
        console.log('🔐 Logging in to live server...');
        const token = await getAdminToken();
        console.log('✅ Successfully logged in');
        
        // Step 3: Restore records to live database
        console.log('📤 Sending records to live server...');
        const result = await restoreRecords(token, backupData);
        
        if (result.success) {
            console.log('\n🎉 Database restoration completed!');
            console.log(`📊 Summary:`);
            console.log(`   ✅ Restored: ${result.restoredCount} records`);
            console.log(`   ⏭️ Skipped: ${result.skippedCount} records (already existed)`);
            console.log(`   📁 Total: ${result.totalRequested} records processed`);
            
            if (result.errors && result.errors.length > 0) {
                console.log(`   ⚠️ Errors: ${result.errors.length}`);
                result.errors.forEach(error => console.log(`     - ${error}`));
            }
            
            console.log('\n🔗 Check your gallery: https://base-wif-hair-telegram-app.onrender.com/leaderboard');
            console.log('📝 Note: Images may take a moment to appear if they need to be served from persistent storage');
            
        } else {
            console.error('❌ Restoration failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Restoration failed:', error.message);
    }
}

if (require.main === module) {
    restoreToLive();
}

module.exports = restoreToLive; 