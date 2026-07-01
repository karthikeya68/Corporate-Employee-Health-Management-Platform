const express = require('express');
const crypto = require('crypto');
global.crypto = crypto;
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto;
}
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { Operator, Employee, TestReport, Medicine, UploadedFile, AuditLog, HospitalSuggestion } = require('./models');

const PORT_REG = 1290;
const PORT_APP = 9012;
const MONGO_URI = 'mongodb://127.0.0.1:27017/caretaker';
const JWT_SECRET = 'ohc-management-secret-key-2026';

// ==========================================
// FREE PORT FINDER
// ==========================================
function findFreePort(preferredPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(preferredPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      const s2 = net.createServer();
      s2.listen(0, '127.0.0.1', () => {
        const port = s2.address().port;
        s2.close(() => resolve(port));
      });
    });
  });
}

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, UPLOADS_DIR); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('[MongoDB] Connected successfully via Mongoose.');
    // Seed default operator if none exist
    const count = await Operator.countDocuments();
    if (count === 0) {
      const hash = await bcrypt.hash('password123', 10);
      await new Operator({ fullName: 'Admin Operator', employeeId: 'EMP100', email: 'admin@ohc.com', mobile: '9999999999', passwordHash: hash }).save();
      console.log('[OHC] Default operator seeded: EMP100 / password123');
    }
  })
  .catch(err => console.error('[MongoDB] Error connecting:', err.message));

// ==========================================
// JWT Middleware
// ==========================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.operator = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ==========================================
// REGISTRATION SERVER (PORT 1290)
// ==========================================
const regApp = express();
regApp.use(express.json());
regApp.use(express.static(path.join(__dirname, 'public')));

regApp.post('/api/register', async (req, res) => {
  try {
    const { fullName, employeeId, email, mobile, password, confirmPassword } = req.body;
    if (!fullName || !employeeId || !email || !mobile || !password || !confirmPassword)
      return res.status(400).json({ error: 'All fields are required.' });
    if (password !== confirmPassword)
      return res.status(400).json({ error: 'Passwords do not match.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });

    if (await Operator.findOne({ employeeId }))
      return res.status(400).json({ error: 'Employee ID is already registered.' });
    if (await Operator.findOne({ email }))
      return res.status(400).json({ error: 'Email is already registered.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const operator = new Operator({ fullName, employeeId, email, mobile, passwordHash });
    await operator.save();
    await new AuditLog({ action: `Operator ${fullName} (${employeeId}) registered.` }).save();
    res.status(201).json({ success: true, message: 'Operator registered successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

regApp.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// ==========================================
// LOGIN & APPLICATION SERVER (PORT 9012)
// ==========================================
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Login ---
app.post('/api/login', async (req, res) => {
  try {
    const { employeeIdOrEmail, password } = req.body;
    if (!employeeIdOrEmail || !password)
      return res.status(400).json({ error: 'Please provide credentials and password.' });

    const operator = await Operator.findOne({
      $or: [{ employeeId: employeeIdOrEmail }, { email: employeeIdOrEmail }]
    });
    if (!operator) return res.status(400).json({ error: 'Invalid Employee ID/Email or Password.' });

    const isMatch = await bcrypt.compare(password, operator.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid Employee ID/Email or Password.' });

    const token = jwt.sign(
      { operatorId: operator._id, employeeId: operator.employeeId, fullName: operator.fullName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    await new AuditLog({ operatorId: operator._id, action: 'Operator logged in.' }).save();
    res.json({ success: true, token, operator: { fullName: operator.fullName, employeeId: operator.employeeId, email: operator.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Status ---
app.get('/api/status', (req, res) => {
  res.json({ connected: mongoose.connection.readyState === 1 });
});

// --- Dashboard Stats ---
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    
    // Parse from/to dates or default to today
    const now = new Date();
    const fromDate = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toDate = req.query.to ? new Date(req.query.to) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Set hours to cover the full day range
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // Count patient visits (Medicine records) within the range
    const todayCheckups = await Medicine.countDocuments({ issuedDate: { $gte: fromDate, $lte: toDate } });
    
    // Count ALL-TIME patient visits
    const totalCheckups = await Medicine.countDocuments();
    
    // Fetch the actual patient visits for the range
    const todayPatients = await Medicine.find({ issuedDate: { $gte: fromDate, $lte: toDate } })
      .populate('employeeId', 'name employeeNumber designation workLocation')
      .sort({ issuedDate: -1 })
      .limit(50); // increased limit to 50 since it could be a date range

    const recentEmployees = await Employee.find().sort({ createdAt: -1 }).limit(5);
    
    res.json({ totalEmployees, todayCheckups, totalCheckups, todayPatients, recentEmployees });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Dashboard Analytics ---
app.get('/api/dashboard/analytics', authMiddleware, async (req, res) => {
  try {
    const checkupData = [], labels = [];
    const now = new Date();
    const fromQuery = req.query.from;
    const toQuery = req.query.to;

    let complaintsMatch = { issue: { $ne: '' } };

    if (fromQuery && toQuery) {
      const fromDate = new Date(fromQuery);
      const toDate = new Date(toQuery);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      complaintsMatch.issuedDate = { $gte: fromDate, $lte: toDate };

      // Prevent huge loops if the date range is accidentally too large (limit to 60 days)
      const diffTime = Math.abs(toDate - fromDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const maxDays = Math.min(diffDays + 1, 60);

      let currentDate = new Date(fromDate);
      for (let i = 0; i < maxDays; i++) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);

        const count = await Medicine.countDocuments({ issuedDate: { $gte: start, $lte: end } });
        labels.push(currentDate.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
        checkupData.push(count);

        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const count = await Medicine.countDocuments({ issuedDate: { $gte: start, $lte: end } });
        labels.push(d.toLocaleString('default', { month: 'short' }));
        checkupData.push(count);
      }
    }

    const complaints = await Medicine.aggregate([
      { $match: complaintsMatch },
      { $group: { _id: '$issue', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      checkups: { labels, data: checkupData },
      complaints: { labels: complaints.map(c => c._id), data: complaints.map(c => c.count) }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Issue History ---
app.get('/api/issues/history', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = {};
    if (from || to) {
      query.issuedDate = {};
      if (from) query.issuedDate.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.issuedDate.$lte = toDate;
      }
    }
    const medicines = await Medicine.find(query)
      .populate('employeeId', 'employeeNumber name designation workLocation')
      .sort({ issuedDate: -1 })
      .lean();
      
    // Fetch corresponding operator names
    const operatorIds = [...new Set(medicines.map(m => m.operatorId).filter(Boolean))];
    const operators = await Operator.find({ operatorId: { $in: operatorIds } }).select('operatorId name').lean();
    const operatorMap = {};
    operators.forEach(op => { operatorMap[op.operatorId] = op.name; });
    
    medicines.forEach(m => {
      m.operatorName = operatorMap[m.operatorId] || m.operatorId;
    });

    res.json(medicines);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Save / Update Employee ---
app.get('/api/employees/all', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    res.json(employees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', authMiddleware, async (req, res) => {
  try {
    const {
      name, employeeNumber, designation, department, employmentType, category, dob, workLocation,
      age, height, weight, pulse, bp, sugar, issue, tabletsGiven, quantity,
      temperature, firstAid, visitCategory,
      remark, attendedBy,
      addReport, reportDate, ...reportData
    } = req.body;

    if (!name || !employeeNumber || !designation || !workLocation || !age)
      return res.status(400).json({ error: 'All compulsory details are required (Name, Emp ID, Designation, Work Location, Age).' });

    let employee = await Employee.findOne({ employeeNumber });
    let isNew = false;

    if (!employee) {
      employee = new Employee({ name, employeeNumber, designation, department, employmentType, category, dob, workLocation, age, height, weight, pulse, bp, sugar, issue, tabletsGiven, quantity, operatorId: req.operator.operatorId });
      isNew = true;
    } else {
      employee.name = name;
      employee.designation = designation;
      if (department) employee.department = department;
      if (employmentType) employee.employmentType = employmentType;
      if (category) employee.category = category;
      if (dob) employee.dob = dob;
      employee.workLocation = workLocation;
      employee.age = age;
      employee.height = height || employee.height;
      employee.weight = weight || employee.weight;
      employee.pulse = pulse || employee.pulse;
      employee.bp = bp || employee.bp;
      employee.sugar = sugar || employee.sugar;
      employee.issue = issue || employee.issue;
      employee.tabletsGiven = tabletsGiven || employee.tabletsGiven;
      employee.quantity = quantity || employee.quantity;
      employee.operatorId = req.operator.operatorId;
    }
    await employee.save();

    // Since it's an illness visit, save the Medicine/Visit record
    if (issue || visitCategory) {
      await new Medicine({ employeeId: employee._id, issue: issue || 'General Visit', tabletsGiven, quantity, temperature, firstAid, visitCategory, operatorId: req.operator.operatorId, issuedDate: new Date() }).save();
    }

    if (addReport) {
      const rDate = reportDate ? new Date(reportDate) : new Date();
      const count = await TestReport.countDocuments({ employeeId: employee._id });
      const reportNumber = `report_${count + 1}_${rDate.toISOString().split('T')[0]}`;
      const testReport = new TestReport({
        employeeId: employee._id, reportNumber, reportDate: rDate, operatorId: req.operator.operatorId,
        htn: reportData.htn || '', dm: reportData.dm || '', rbs: reportData.rbs || '',
        serumCreatinine: reportData.serumCreatinine || '', serumUrea: reportData.serumUrea || '',
        serumCholinesterase: reportData.serumCholinesterase || '', serumCholesterol: reportData.serumCholesterol || '',
        serumTriglycerides: reportData.serumTriglycerides || '', hdl: reportData.hdl || '',
        ldl: reportData.ldl || '', vldl: reportData.vldl || '',
        totalLeucocytes: reportData.totalLeucocytes || '', erythrocyteCount: reportData.erythrocyteCount || '',
        neutrophils: reportData.neutrophils || '', lymphocytes: reportData.lymphocytes || '',
        eosinophils: reportData.eosinophils || '', monocytes: reportData.monocytes || '',
        basophils: reportData.basophils || '', esr: reportData.esr || '', hb: reportData.hb || '',
        plateletCount: reportData.plateletCount || '', packedCellVolume: reportData.packedCellVolume || '',
        mcv: reportData.mcv || '', mch: reportData.mch || '', mchc: reportData.mchc || '',
        rcdw: reportData.rcdw || '', rbcSmear: reportData.rbcSmear || '', wbcSmear: reportData.wbcSmear || '',
        plateletSmear: reportData.plateletSmear || '', parasites: reportData.parasites || '',
        specificGravity: reportData.specificGravity || '', urinePh: reportData.urinePh || '',
        urineAcetone: reportData.urineAcetone || '', urineNitrites: reportData.urineNitrites || '',
        ubs: reportData.ubs || '', ubp: reportData.ubp || '', urobilinogen: reportData.urobilinogen || '',
        urineLeucocyte: reportData.urineLeucocyte || '', urineAlbumin: reportData.urineAlbumin || '',
        urineSugar: reportData.urineSugar || '', uml: reportData.uml || '', rbc: reportData.rbc || '',
        ec: reportData.ec || '', casts: reportData.casts || '', crystals: reportData.crystals || '',
        xrayReport: reportData.xrayReport || '', rightEar: reportData.rightEar || '', leftEar: reportData.leftEar || '',
        rightEye: reportData.rightEye || '', leftEye: reportData.leftEye || '',
        remark: remark || '', attendedBy: attendedBy || ''
      });
      await testReport.save();
      await new AuditLog({ operatorId: req.operator.operatorId, action: `Added test report ${reportNumber} for employee ${employeeNumber}.` }).save();
    }

    await new AuditLog({ operatorId: req.operator.operatorId, action: `${isNew ? 'Created' : 'Updated'} employee ${employeeNumber} (${name}).` }).save();
    res.json({ success: true, employee, isNew });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Filter Employees by Vitals ---
app.get('/api/employees/filter-vitals', authMiddleware, async (req, res) => {
  try {
    const { bpMin, bpMax, sugarMin, sugarMax, pulseMin, pulseMax } = req.query;
    let employees = await Employee.find();
    
    employees = employees.filter(emp => {
      // Pulse filter
      if (pulseMin && emp.pulse < Number(pulseMin)) return false;
      if (pulseMax && emp.pulse > Number(pulseMax)) return false;
      
      // Sugar filter (assuming stored as string but representing a number)
      if (sugarMin || sugarMax) {
        if (!emp.sugar) return false;
        const sugarVal = Number(emp.sugar);
        if (isNaN(sugarVal)) return false;
        if (sugarMin && sugarVal < Number(sugarMin)) return false;
        if (sugarMax && sugarVal > Number(sugarMax)) return false;
      }
      
      // BP Systolic filter
      if (bpMin || bpMax) {
        if (!emp.bp || emp.bp === 'N/A') return false;
        const systolic = Number(emp.bp.split('/')[0]);
        if (isNaN(systolic)) return false;
        if (bpMin && systolic < Number(bpMin)) return false;
        if (bpMax && systolic > Number(bpMax)) return false;
      }
      
      return true;
    });
    
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Search Employees ---
app.get('/api/employees/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const queryRegex = { $regex: q, $options: 'i' };
    const employees = await Employee.find({
      $or: [
        { employeeNumber: queryRegex }, { name: queryRegex },
        { designation: queryRegex }, { workLocation: queryRegex }
      ]
    });
    res.json(employees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Employee reports & meds ---
app.get('/api/employees/:employeeNumber/reports', authMiddleware, async (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const employee = await Employee.findOne({ employeeNumber });
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });
    const reports = await TestReport.find({ employeeId: employee._id }).sort({ reportDate: -1 });
    const medicines = await Medicine.find({ employeeId: employee._id }).sort({ issuedDate: -1 });
    const uploads = await UploadedFile.find({ employeeId: employee._id }).sort({ uploadedAt: -1 });
    const suggestions = await HospitalSuggestion.find({ employeeId: employee._id }).sort({ suggestedAt: -1 });
    res.json({ employee, reports, medicines, uploads, suggestions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Add Test Report ---
app.post('/api/reports', authMiddleware, async (req, res) => {
  try {
    const { employeeNumber, reportDate, ...reportData } = req.body;
    if (!employeeNumber) return res.status(400).json({ error: 'Employee Number is required.' });
    const employee = await Employee.findOne({ employeeNumber });
    if (!employee) return res.status(404).json({ error: 'Employee not found. Please register employee general details first.' });
    const rDate = reportDate ? new Date(reportDate) : new Date();
    const count = await TestReport.countDocuments({ employeeId: employee._id });
    const reportNumber = `report_${count + 1}_${rDate.toISOString().split('T')[0]}`;
    const testReport = new TestReport({ employeeId: employee._id, reportNumber, reportDate: rDate, operatorId: req.operator.operatorId, ...reportData });
    await testReport.save();
    await new AuditLog({ operatorId: req.operator.operatorId, action: `Added test report ${reportNumber} for employee ${employeeNumber}.` }).save();
    res.status(201).json({ success: true, report: testReport });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Delete Report ---
app.delete('/api/reports/:id', authMiddleware, async (req, res) => {
  try {
    const report = await TestReport.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    await new AuditLog({ operatorId: req.operator.operatorId, action: `Deleted test report ${report.reportNumber}.` }).save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Save Hospital Suggestion ---
app.post('/api/hospital-suggestions', authMiddleware, async (req, res) => {
  try {
    const { employeeNumber, hospitalName, reason, arogyasri } = req.body;
    if (!employeeNumber || !hospitalName || !reason) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const employee = await Employee.findOne({ employeeNumber });
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    const suggestion = new HospitalSuggestion({
      employeeId: employee._id,
      hospitalName,
      reason,
      arogyasri: arogyasri === true || arogyasri === 'true',
      operatorId: req.operator.operatorId
    });
    await suggestion.save();
    res.json({ success: true, message: 'Suggestion saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hospital-suggestions/all', authMiddleware, async (req, res) => {
  try {
    const suggestions = await HospitalSuggestion.find()
      .populate('employeeId', 'employeeNumber name designation workLocation age bp')
      .sort({ suggestedAt: -1 });
    res.json(suggestions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Get Open Hospital Suggestion ---
app.get('/api/hospital-suggestions/open/:empNumber', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeNumber: req.params.empNumber });
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });
    
    // Find the most recent open case
    const suggestion = await HospitalSuggestion.findOne({ employeeId: employee._id, status: 'Open' }).sort({ suggestedAt: -1 });
    if (!suggestion) return res.json({ success: true, suggestion: null });
    
    res.json({ success: true, suggestion });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- File Upload ---
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { employeeNumber, reportId, reportType, hospitalName, suggestionId, amount, closeCase } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const employee = await Employee.findOne({ employeeNumber });
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });
    const relativePath = `/uploads/${req.file.filename}`;
    
    const dateStr = new Date().toISOString().split('T')[0];
    const ext = require('path').extname(req.file.originalname) || '.pdf';
    const customFileName = `${employeeNumber}_${dateStr}${ext}`;
    
    const uploadedFile = new UploadedFile({ 
      employeeId: employee._id, 
      reportId: reportId ? new mongoose.Types.ObjectId(reportId) : undefined, 
      fileName: customFileName, 
      filePath: relativePath,
      reportType: reportType || 'General',
      hospitalName: hospitalName || '',
      operatorId: req.operator.operatorId
    });
    
    await uploadedFile.save();
    
    // If it's a Hospital Report and we have a suggestion ID, update the suggestion
    if (reportType === 'Hospital' && suggestionId) {
      const updateData = {};
      if (amount) updateData.amount = Number(amount);
      if (closeCase === 'true' || closeCase === true) updateData.status = 'Closed';
      await HospitalSuggestion.findByIdAndUpdate(suggestionId, updateData);
    }
    
    if (reportId) {
      await TestReport.findByIdAndUpdate(reportId, { $push: { uploadedFiles: relativePath } });
    }
    res.json({ success: true, file: uploadedFile });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Bulk Import ---
app.post('/api/import', authMiddleware, async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'Invalid import data. Must contain a non-empty rows array.' });

    let createdCount = 0, updatedCount = 0, skippedCount = 0, reportsCreatedCount = 0;
    const errors = [];
    const batchEmpIds = new Set();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const name = row['Name of the Employee'] || row['Full Name'] || row.Name || row['Employee Name'] || 'Unknown';
      const employeeNumber = row['Employee ID / Number'] || row['Employee ID'] || row['Emp No'] || row['Employee Number'] || row.employeeNumber;
      if (!employeeNumber) { errors.push(`Row ${index + 1}: Missing Employee ID/Number.`); skippedCount++; continue; }

      // Parse Historical Date
      let recordDate = new Date();
      const rawDate = row['Issued Date'] || row['Visit Date'] || row.Date || row.date;
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          recordDate = parsed;
        } else if (typeof rawDate === 'number') {
          // Handle Excel serial date format
          recordDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        } else if (typeof rawDate === 'string' && rawDate.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/)) {
          const parts = rawDate.split(/[-/]/);
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          const pd = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(pd.getTime())) recordDate = pd;
        }
      }

      const designation = row.Designation || 'General Staff';
      const department = row.Department || '';
      const employmentType = row['Regular / Contract'] || 'Regular';
      const category = row.Category || '';
      const dob = row['Date of Birth'] || '';
      const doj = row['Date of Joining'] || '';
      const village = row.Village || '';
      const presentAddress = row['Present Address'] || '';
      const workLocation = row['Work Location / Area'] || row['Work Location'] || row['Working Area'] || row.Worklocation || 'Industrial Site';
      const ageStr = String(row.Age || '30').replace(/\D/g, '');
      const age = Number(ageStr) || 30;
      const height = Number(row['Height (cm)'] || row.Height) || 165;
      const weight = Number(row['Weight (kg)'] || row.weight || row.Weight) || 60;
      const pulse = Number(row['Pulse (bpm)'] || row.Pulse || row.pulse) || 72;
      const bp = row['Blood Pressure (BP)'] || row.Bp || row.bp || '120/80';
      const issue = row['Issue / Complaint'] || row.complaint || row.issue || '';
      const tabletsGiven = row['Treatment Given'] || row['Tablets Given'] || row.tabletsGiven || '';
      const quantity = Number(row.Quantity || row.quantity) || 0;
      
      const visitCategory = row['Category (First Aid / General)'] || '';
      const firstAid = row['First Aid Done / Referred to Hospital'] || '';

      let employee = await Employee.findOne({ employeeNumber });
      let isNew = false;

      try {
        if (!employee) {
          employee = new Employee({ name, employeeNumber, designation, department, employmentType, category, dob, doj, village, presentAddress, workLocation, age, height, weight, pulse, bp, issue, tabletsGiven, quantity });
          isNew = true;
        } else {
          // Only update basic details if it's the latest info (we'll just overwrite for simplicity on import)
          Object.assign(employee, { name: name !== 'Unknown' ? name : employee.name, designation, department, employmentType, category, dob, doj, village, presentAddress, workLocation, age, height, weight, pulse, bp, issue, tabletsGiven, quantity });
        }
        await employee.save();
        
        // Ensure we only count employee creation/updates once per batch even if they have multiple rows
        if (!batchEmpIds.has(employeeNumber)) {
          batchEmpIds.add(employeeNumber);
          if (isNew) createdCount++; else updatedCount++;
        }

        // Save historical health issue/medicine visit
        if (issue || (tabletsGiven && quantity > 0) || visitCategory || firstAid) {
          await new Medicine({ 
            employeeId: employee._id, 
            issue: issue || 'General Visit', 
            tabletsGiven, 
            quantity, 
            visitCategory,
            firstAid,
            issuedDate: recordDate,
            operatorId: req.operator.operatorId 
          }).save();
        }

        // Save historical test report if parameters exist
        const hasReport = row.HTN !== undefined || row.DM !== undefined || row.Rbs !== undefined || row.RBS !== undefined;
        if (hasReport) {
          const count = await TestReport.countDocuments({ employeeId: employee._id });
          const reportNumber = `report_${count + 1}_${recordDate.toISOString().split('T')[0]}`;
          await new TestReport({
            employeeId: employee._id, reportNumber, reportDate: recordDate,
            htn: String(row.HTN || ''), dm: String(row.DM || ''), rbs: String(row.Rbs || row.RBS || ''),
            serumCreatinine: String(row['Seum creatinine'] || ''), serumUrea: String(row['serum urea'] || '')
          }).save();
          reportsCreatedCount++;
        }
      } catch (err) {
        errors.push(`Row ${index + 1} (${employeeNumber}): ${err.message}`);
        skippedCount++;
      }
    }

    await new AuditLog({ operatorId: req.operator.operatorId, action: `Bulk import: Created ${createdCount}, updated ${updatedCount}, skipped ${skippedCount}.` }).save();
    res.json({ success: true, summary: { totalProcessed: rows.length, created: createdCount, updated: updatedCount, skipped: skippedCount, reportsCreated: reportsCreatedCount, errors } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Backup ---
app.get('/api/backup', authMiddleware, async (req, res) => {
  try {
    const backupData = {
      operators: await Operator.find(), employees: await Employee.find(),
      testReports: await TestReport.find(), medicines: await Medicine.find(),
      uploadedFiles: await UploadedFile.find(), auditLogs: await AuditLog.find(),
      backupTimestamp: new Date()
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=ohc_db_backup.json');
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Restore ---
app.post('/api/restore', authMiddleware, async (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !backupData.employees)
      return res.status(400).json({ error: 'Invalid backup file structure.' });
    if (backupData.employees.length > 0) { await Employee.deleteMany({}); await Employee.insertMany(backupData.employees); }
    if (backupData.testReports && backupData.testReports.length > 0) { await TestReport.deleteMany({}); await TestReport.insertMany(backupData.testReports); }
    if (backupData.medicines && backupData.medicines.length > 0) { await Medicine.deleteMany({}); await Medicine.insertMany(backupData.medicines); }
    await new AuditLog({ operatorId: req.operator.operatorId, action: 'Restored database from backup.' }).save();
    res.json({ success: true, message: 'Database restored successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Catch-all ---
app.get(/^(.*)$/, (req, res) => {
  if (req.path === '/login.html' || req.path === '/login') {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'operator.html'));
  }
});

// ==========================================
// START SERVERS
// ==========================================
(async () => {
  const regPort = await findFreePort(PORT_REG);
  const appPort = await findFreePort(PORT_APP);

  regApp.listen(regPort, () => {
    console.log(`[OHC Service] Operator Registration Portal: http://localhost:${regPort}`);
    if (regPort !== PORT_REG) console.log(`  (Note: default port ${PORT_REG} was busy, using ${regPort})`);
  });

  app.listen(appPort, () => {
    console.log(`[OHC Service] Operator Login & Medical Dashboard: http://localhost:${appPort}`);
    if (appPort !== PORT_APP) console.log(`  (Note: default port ${PORT_APP} was busy, using ${appPort})`);
  });
})();
