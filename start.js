const setup = require('./backend/setup');
const { spawn } = require('child_process');
const path = require('path');

async function start() {
    console.log('🚀 Starting Base Wif Hair Telegram Mini App...\n');
    
    try {
        // Run setup first
        await setup();
        
        console.log('\n🎯 Starting server...\n');
        
        // Start the server
        const serverProcess = spawn('node', [path.join(__dirname, 'backend', 'server.js')], {
            stdio: 'inherit',
            cwd: __dirname
        });
        
        serverProcess.on('error', (error) => {
            console.error('Failed to start server:', error);
            process.exit(1);
        });
        
        serverProcess.on('close', (code) => {
            console.log(`Server process exited with code ${code}`);
            process.exit(code);
        });
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n📴 Shutting down server...');
            serverProcess.kill('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\n📴 Shutting down server...');
            serverProcess.kill('SIGTERM');
        });
        
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    start();
}

module.exports = start; 