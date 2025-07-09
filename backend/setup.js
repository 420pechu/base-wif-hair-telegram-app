const Database = require('./models/database');
const fs = require('fs');
const path = require('path');

async function setup() {
    console.log('🚀 Setting up Base Wif Hair Telegram Mini App...');
    
    try {
        // Initialize database
        console.log('📊 Initializing database...');
        const db = new Database();
        
        // Wait a moment for database initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify database tables
        console.log('✅ Database initialized successfully');
        
        // Check if uploads directory exists
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('📁 Created uploads directory');
        } else {
            console.log('📁 Uploads directory already exists');
        }
        
        // Check if data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('📁 Created data directory');
        } else {
            console.log('📁 Data directory already exists');
        }
        
        // Verify assets
        const assetsDir = path.join(__dirname, '../assets');
        const requiredAssets = ['wig.png', 'wiflogo.png', 'TG.png'];
        
        console.log('🎨 Checking assets...');
        for (const asset of requiredAssets) {
            const assetPath = path.join(assetsDir, asset);
            if (fs.existsSync(assetPath)) {
                console.log(`✅ Found ${asset}`);
            } else {
                console.log(`❌ Missing ${asset}`);
            }
        }
        
        // Get database stats
        const stats = await db.getStats();
        console.log('\n📈 Database Statistics:');
        console.log(`   Images: ${stats.totalImages}`);
        console.log(`   Likes: ${stats.totalLikes}`);
        console.log(`   Creators: ${stats.totalCreators}`);
        console.log(`   Likers: ${stats.totalLikers}`);
        
        await db.close();
        
        console.log('\n🎉 Setup completed successfully!');
        console.log('\n📱 To start the Mini App:');
        console.log('   npm start');
        console.log('\n🌐 Access the app at:');
        console.log('   http://localhost:3000');
        
        console.log('\n🔧 For development mode:');
        console.log('   npm run dev');
        
        console.log('\n📋 Next steps:');
        console.log('   1. Set up your Telegram Bot');
        console.log('   2. Configure BOT_TOKEN environment variable');
        console.log('   3. Add your Mini App to your Telegram Bot');
        console.log('   4. Test the Mini App in Telegram');
        
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