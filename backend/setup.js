const Database = require('./models/database');
const fs = require('fs');
const path = require('path');

async function setup() {
    try {
        // Initialize database
        const db = new Database();
        
        // Wait a moment for database initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if uploads directory exists
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Check if data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Get database stats for final verification
        const stats = await db.getStats();
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setup();
}

module.exports = setup; 