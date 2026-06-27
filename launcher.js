const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('===================================================');
console.log('             CareTaker System Launcher');
console.log('===================================================');

// MongoDB setup
const DB_PATH = path.join(process.cwd(), 'mongodb_data');
const MONGOD_EXE = path.join(process.cwd(), 'mongodb-win32-x86_64-windows-8.3.4', 'bin', 'mongod.exe');

if (!fs.existsSync(DB_PATH)) {
    console.log('[INFO] Creating local database directory at ' + DB_PATH + '...');
    fs.mkdirSync(DB_PATH, { recursive: true });
}

(async () => {
    // Check if Mongo is already running
    const isMongoRunning = await new Promise(resolve => {
        exec('netstat -an | find "27017"', (err, stdout) => {
            resolve(stdout && stdout.includes('LISTENING'));
        });
    });

    if (!isMongoRunning) {
        if (!fs.existsSync(MONGOD_EXE)) {
            console.error('[ERROR] Cannot find MongoDB at ' + MONGOD_EXE);
            console.error('Please ensure the mongodb folder is in the same directory as CareTaker.exe');
            process.exit(1);
        }

        console.log('[INFO] Starting MongoDB Server...');
        const mongoProcess = spawn(MONGOD_EXE, ['--dbpath', DB_PATH], {
            stdio: 'ignore', 
            detached: true   
        });
        mongoProcess.unref();

        // Wait a few seconds for Mongo to boot
        console.log('[INFO] Waiting for Database to initialize...');
        await new Promise(r => setTimeout(r, 4000));
    } else {
        console.log('[INFO] MongoDB is already running.');
    }

    console.log('[INFO] Starting CareTaker Web Server...');
    
    // Start Express App
    require('./app.js');

    // Open Browser
    setTimeout(() => {
        const url = 'http://localhost:9012';
        console.log(`[INFO] Application ready! Opening browser at ${url}`);
        exec(`start ${url}`);
    }, 1500);

})();
