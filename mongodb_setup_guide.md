# CareTaker - MongoDB Setup & Integration Guide

This guide details the step-by-step process to transition the CareTaker application from local file storage (`db.json`) to a local **MongoDB** database.

---

## Step 1: Install MongoDB on Windows

1. **Download the Installer:**
   - Visit the official [MongoDB Community Server Download Page](https://www.mongodb.com/try/download/community).
   - Select **Windows**, package **MSI**, and click **Download**.

2. **Run the Installer:**
   - Double-click the downloaded `.msi` file.
   - Choose **Complete** installation.
   - Select **"Run service as Network Service user"** (this is checked by default and makes MongoDB start automatically when Windows boots).
   - Check the box to **"Install MongoDB Compass"** (this is MongoDB's official graphical interface to inspect and manage your data visually).

3. **Verify the Installation:**
   - Open Command Prompt or PowerShell as Administrator and check if the service is running:
     ```powershell
     net start MongoDB
     ```
   - Open **MongoDB Compass** from your Start menu and click **Connect** using the default connection string `mongodb://localhost:27017`.

---

## Step 2: Install MongoDB Node.js Driver

To let our backend server speak to MongoDB, you need to install the official MongoDB client driver in the CareTaker root directory.

1. Open PowerShell or Command Prompt in `c:\Users\NACL\Desktop\CareTaker`.
2. Run the following command:
   ```bash
   npm install mongodb
   ```
   *(This downloads and registers the `mongodb` package in your local `node_modules` folder).*

---

## Step 3: Replace `app.js` with MongoDB Version

Replace your existing **[`app.js`](file:///c:/Users/NACL/Desktop/CareTaker/app.js)** code with the following script. This script connects to your local MongoDB service at startup, initializes default admin/operator credentials if the database is empty, and syncs your collections directly to MongoDB.

```javascript
// app.js (MongoDB Integrated Version)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT_LOGIN = 5000;
const PORT_REG = 1029;
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'caretaker';

let dbClient = null;
let db = null;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

// Connect to MongoDB and initialize default credentials if empty
async function initDb() {
  try {
    dbClient = new MongoClient(MONGO_URI);
    await dbClient.connect();
    db = dbClient.db(DB_NAME);
    console.log('[MongoDB] Connected successfully to local database.');

    const usersColl = db.collection('users');
    const userCount = await usersColl.countDocuments();
    if (userCount === 0) {
      const defaultUsers = [
        { empId: 'ADM100', name: 'System Administrator', password: 'adminpassword', role: 'admin' },
        { empId: 'EMP101', name: 'Medical Operator', password: 'operatorpassword', role: 'operator' }
      ];
      await usersColl.insertMany(defaultUsers);
      console.log('[MongoDB] Initialized users collection with default credentials.');
    }
  } catch (err) {
    console.error('[MongoDB] Error connecting to database:', err);
    process.exit(1);
  }
}

// Helper to read all collections from MongoDB
async function readDb() {
  const users = await db.collection('users').find({}).toArray();
  const employees = await db.collection('employees').find({}).toArray();
  const records = await db.collection('records').find({}).toArray();
  return { users, employees, records };
}

// Helper to save/overwrite collections in MongoDB
async function saveCollection(collectionName, dataArray) {
  const collection = db.collection(collectionName);
  await collection.deleteMany({});
  if (dataArray.length > 0) {
    await collection.insertMany(dataArray);
  }
}

// Parse JSON request body
function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      callback(JSON.parse(body));
    } catch (e) {
      callback(null);
    }
  });
}

// Add CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// API Handler
async function handleApi(req, res) {
  const urlPath = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (urlPath === '/api/get-all' && req.method === 'GET') {
    setCorsHeaders(res);
    try {
      const data = await readDb();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  if (urlPath === '/api/save-users' && req.method === 'POST') {
    setCorsHeaders(res);
    parseJsonBody(req, async (body) => {
      if (Array.isArray(body)) {
        try {
          await saveCollection('users', body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Body must be a JSON array' }));
      }
    });
    return true;
  }

  if (urlPath === '/api/save-employees' && req.method === 'POST') {
    setCorsHeaders(res);
    parseJsonBody(req, async (body) => {
      if (Array.isArray(body)) {
        try {
          await saveCollection('employees', body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Body must be a JSON array' }));
      }
    });
    return true;
  }

  if (urlPath === '/api/save-records' && req.method === 'POST') {
    setCorsHeaders(res);
    parseJsonBody(req, async (body) => {
      if (Array.isArray(body)) {
        try {
          await saveCollection('records', body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Body must be a JSON array' }));
      }
    });
    return true;
  }

  return false;
}

// Static File Handler
function serveStatic(req, res, defaultFile) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') {
    urlPath = '/' + defaultFile;
  }

  const resolvedBase = path.resolve(__dirname, 'public');
  const safeSuffix = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(resolvedBase, safeSuffix);

  if (!filePath.startsWith(resolvedBase)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Start Port 5000: Login & App Server
const loginServer = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  serveStatic(req, res, 'login.html');
});

// Start Port 1029: Registration Server
const regServer = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  serveStatic(req, res, 'register.html');
});

// Initialize and Listen
initDb().then(() => {
  loginServer.listen(PORT_LOGIN, () => {
    console.log(`[CareTaker] Login Portal & Dashboard serving on http://localhost:${PORT_LOGIN}`);
  });

  regServer.listen(PORT_REG, () => {
    console.log(`[CareTaker] Registration Portal serving on http://localhost:${PORT_REG}`);
  });
});
```

---

## Step 4: Run the Server

1. Close the running backend node instance (if active).
2. Double click **`start.bat`** (or execute `node app.js`).
3. You will see:
   ```text
   [MongoDB] Connected successfully to local database.
   [CareTaker] Login Portal & Dashboard serving on http://localhost:5000
   [CareTaker] Registration Portal serving on http://localhost:1029
   ```
4. All data logged, updated, or registered is now stored inside the local MongoDB instance under database `caretaker`! You can verify this visually in MongoDB Compass.
