const setup = require('./backend/setup');
const { spawn } = require('child_process');
const path = require('path');

async function start() {
    
    
    try {
        // Run setup first
        await setup();
        
        
        
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
        
            process.exit(code);
        });
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            serverProcess.kill('SIGINT');
        });
        
        process.on('SIGTERM', () => {
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