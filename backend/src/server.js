const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const app = require('./app');
const { initDatabase } = require('./config/db');
const { runMigrationsAndSeed } = require('./migrations/seed');

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        console.log('----------------------------------------------------');
        console.log(' Initializing Duolink Finance Application Backend...');
        console.log('----------------------------------------------------');

        // 1. Initialize PostgreSQL Connection / Engine
        await initDatabase();

        // 2. Run migrations & seed verification
        await runMigrationsAndSeed();

        // 3. Start HTTP server
        const server = http.createServer(app);
        server.listen(PORT, () => {
            console.log('====================================================');
            console.log(` Duolink Finance Backend running on http://localhost:${PORT}`);
            console.log(` Live Portal Interface: http://localhost:${PORT}/`);
            console.log(` API Endpoint:          http://localhost:${PORT}/api`);
            console.log('----------------------------------------------------');
            console.log(' Default Login Credentials:');
            console.log(' Admin: admin@duolink.com / Admin@123');
            console.log(' User:  user@duolink.com  / User@123');
            console.log('====================================================');
        });
    } catch (err) {
        console.error('Fatal Server Initialization Error:', err);
        process.exit(1);
    }
}

startServer();
