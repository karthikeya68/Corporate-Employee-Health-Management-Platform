// operator/script.js

// Simulated State (Local Storage keys)
const STORAGE_KEYS = {
  USERS: 'caretaker_users',
  RECORDS: 'caretaker_records',
  LOGGED_USER: 'caretaker_logged_operator'
};

// Application State
let loggedUser = null;
let isRegisterMode = false;
let selectedFile = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authDesc = document.getElementById('auth-desc');
const authBtn = document.getElementById('auth-btn');
const nameGroup = document.getElementById('name-group');
const toggleAuthLink = document.getElementById('toggle-auth-link');
const displayUserName = document.getElementById('display-user-name');
const logoutBtn = document.getElementById('logout-btn');

// Form inputs
const regNameInput = document.getElementById('reg-name');
const loginEmpidInput = document.getElementById('login-empid');
const loginPwdInput = document.getElementById('login-pwd');

// Record Form inputs
const recordForm = document.getElementById('record-form');
const recEmpId = document.getElementById('rec-empid');
const recName = document.getElementById('rec-name');
const recDept = document.getElementById('rec-dept');
const recArea = document.getElementById('rec-area');
const recDisease = document.getElementById('rec-disease');
const recTablets = document.getElementById('rec-tablets');
const recQty = document.getElementById('rec-qty');

// File Upload DOM
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const uploadBtn = document.getElementById('upload-btn');

// Records Table DOM
const recordsBody = document.getElementById('records-body');
const emptyRecords = document.getElementById('empty-records');

// --- Helper: LocalStorage DB Operations ---
const db = {
  getUsers: () => {
    let users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    const hasAdmin = users.some(u => u.empId === 'ADM100');
    
    if (!hasAdmin) {
      users.push({ empId: 'ADM100', name: 'System Administrator', password: 'adminpassword', role: 'admin' });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
    return users;
  },
  saveUsers: (users) => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)),
  getRecords: () => JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS)) || [],
  saveRecords: (records) => localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records))
};

// --- Helper: Toast Notification ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  toast.className = `alert-toast show ${type}`;
  
  if (type === 'success') {
    toastIcon.className = 'fa-solid fa-circle-check';
  } else {
    toastIcon.className = 'fa-solid fa-circle-exclamation';
  }
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// --- Toggle Auth Mode ---
toggleAuthLink.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    authTitle.textContent = "Operator Register";
    authDesc.textContent = "Register a new operator account for this system.";
    authBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Register';
    nameGroup.style.display = 'flex';
    toggleAuthLink.textContent = "Already have an account? Login here";
    regNameInput.required = true;
  } else {
    authTitle.textContent = "Operator Login";
    authDesc.textContent = "Please log in to access the medical entry terminal.";
    authBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
    nameGroup.style.display = 'none';
    toggleAuthLink.textContent = "Need to register as a new Operator?";
    regNameInput.required = false;
  }
});

// --- Auth Submission (Simulated) ---
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const empId = loginEmpidInput.value.trim().toUpperCase();
  const password = loginPwdInput.value;
  const name = regNameInput.value.trim();
  
  const users = db.getUsers();
  
  if (isRegisterMode) {
    // Check if user already exists
    if (users.some(u => u.empId === empId)) {
      showToast("A user with this Employee ID is already registered.", "error");
      return;
    }
    
    // Register User
    users.push({ empId, name, password, role: 'operator' });
    db.saveUsers(users);
    
    showToast("Registration successful! Logging in...", "success");
    isRegisterMode = false;
    toggleAuthLink.click();
    loginEmpidInput.value = empId;
    loginPwdInput.value = password;
    authForm.dispatchEvent(new Event('submit'));
  } else {
    // Login User
    const matchedUser = users.find(u => u.empId === empId && u.role === 'operator');
    
    if (!matchedUser || matchedUser.password !== password) {
      showToast("Invalid Credentials for Operator role.", "error");
      return;
    }
    
    loggedUser = matchedUser;
    localStorage.setItem(STORAGE_KEYS.LOGGED_USER, JSON.stringify(loggedUser));
    
    showToast("Logged in successfully!", "success");
    initializeDashboard();
  }
});

// --- Check Auth Status on Startup ---
function checkAuth() {
  const session = localStorage.getItem(STORAGE_KEYS.LOGGED_USER);
  if (!session) {
    showAuthPage();
    return;
  }
  
  loggedUser = JSON.parse(session);
  initializeDashboard();
}

function showAuthPage() {
  authSection.style.display = 'flex';
  dashboardSection.style.display = 'none';
}

function initializeDashboard() {
  authSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  displayUserName.textContent = loggedUser.name;
  
  recordForm.reset();
  resetFileSelection();
  loadRecentEntries();
}

// --- Logout ---
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.LOGGED_USER);
  loggedUser = null;
  showToast("Logged out successfully.", "success");
  showAuthPage();
});

// --- Load Operator Records (Filtered by enteredBy) ---
function loadRecentEntries() {
  const allRecords = db.getRecords();
  
  // Filter for records entered by this operator
  const myRecords = allRecords.filter(r => r.enteredBy === loggedUser.empId);
  
  // Sort by date descending
  myRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  recordsBody.innerHTML = '';
  
  if (myRecords.length === 0) {
    emptyRecords.style.display = 'flex';
    return;
  }
  
  emptyRecords.style.display = 'none';
  
  // Show top 10 recent records
  const recent = myRecords.slice(0, 10);
  recent.forEach(record => {
    const tr = document.createElement('tr');
    
    const date = new Date(record.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    tr.innerHTML = `
      <td><strong>${escapeHTML(record.empId)}</strong></td>
      <td>${escapeHTML(record.name)}</td>
      <td><span class="cell-pill dept">${escapeHTML(record.department)}</span></td>
      <td>${escapeHTML(record.workingArea)}</td>
      <td><span class="cell-pill disease">${escapeHTML(record.disease)}</span></td>
      <td>${escapeHTML(record.tabletsGiven)}</td>
      <td>${record.quantity}</td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${date}</td>
    `;
    recordsBody.appendChild(tr);
  });
}

// --- Submit Manual Record ---
recordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const newRecord = {
    _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    empId: recEmpId.value.trim().toUpperCase(),
    name: recName.value.trim(),
    department: recDept.value.trim(),
    workingArea: recArea.value.trim(),
    disease: recDisease.value.trim(),
    tabletsGiven: recTablets.value.trim(),
    quantity: parseInt(recQty.value, 10),
    enteredBy: loggedUser.empId,
    source: 'manual',
    createdAt: new Date().toISOString()
  };
  
  const records = db.getRecords();
  records.push(newRecord);
  db.saveRecords(records);
  
  showToast("Medical record saved successfully!", "success");
  recordForm.reset();
  loadRecentEntries();
});

// --- Drag and Drop File Upload & Parsing ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

function handleFileSelect(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    showToast("Invalid file format. Please upload an Excel sheet (.xlsx, .xls)", "error");
    resetFileSelection();
    return;
  }
  
  selectedFile = file;
  fileName.innerHTML = `<i class="fa-regular fa-file-excel" style="color: var(--accent); margin-right: 0.5rem;"></i>${escapeHTML(file.name)} (${(file.size / 1024).toFixed(1)} KB)`;
  fileInfo.style.display = 'flex';
}

function resetFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.style.display = 'none';
}

uploadBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (rows.length === 0) {
        throw new Error('The uploaded Excel sheet contains no data.');
      }
      
      const importedRecords = [];
      const now = new Date().toISOString();
      
      rows.forEach((row, index) => {
        const rowKeys = {};
        Object.keys(row).forEach(k => {
          rowKeys[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = k;
        });
        
        const empIdKey = rowKeys['empid'] || rowKeys['employeeid'] || rowKeys['id'] || rowKeys['pid'];
        const nameKey = rowKeys['name'] || rowKeys['patientname'] || rowKeys['fullname'] || rowKeys['personname'];
        const deptKey = rowKeys['department'] || rowKeys['dept'];
        const areaKey = rowKeys['workingarea'] || rowKeys['area'] || rowKeys['workarea'] || rowKeys['location'];
        const diseaseKey = rowKeys['healthdisease'] || rowKeys['disease'] || rowKeys['healthdesease'] || rowKeys['healthissue'] || rowKeys['symptoms'];
        const tabletsKey = rowKeys['tabletsgiven'] || rowKeys['tablets'] || rowKeys['tabets'] || rowKeys['medicine'] || rowKeys['tabetsgiven'];
        const qtyKey = rowKeys['quantity'] || rowKeys['qty'] || rowKeys['count'] || rowKeys['amount'];
        
        if (!empIdKey || !row[empIdKey]) {
          throw new Error(`Row ${index + 2}: 'Emp ID' field is missing or empty.`);
        }
        if (!nameKey || !row[nameKey]) {
          throw new Error(`Row ${index + 2}: 'Name' field is missing or empty.`);
        }
        
        let quantityVal = 1;
        if (qtyKey) {
          const val = parseInt(row[qtyKey], 10);
          if (!isNaN(val) && val > 0) quantityVal = val;
        }
        
        importedRecords.push({
          _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          empId: String(row[empIdKey]).trim().toUpperCase(),
          name: String(row[nameKey]).trim(),
          department: deptKey ? String(row[deptKey]).trim() : 'General',
          workingArea: areaKey ? String(row[areaKey]).trim() : 'Not Specified',
          disease: diseaseKey ? String(row[diseaseKey]).trim() : 'Common Disease',
          tabletsGiven: tabletsKey ? String(row[tabletsKey]).trim() : 'None',
          quantity: quantityVal,
          enteredBy: loggedUser.empId,
          source: 'excel_upload',
          createdAt: now
        });
      });
      
      const existing = db.getRecords();
      const consolidated = existing.concat(importedRecords);
      db.saveRecords(consolidated);
      
      showToast(`Imported ${importedRecords.length} records successfully!`, "success");
      resetFileSelection();
      loadRecentEntries();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="fa-solid fa-check"></i> Upload';
    }
  };
  
  reader.onerror = function() {
    showToast("File reading error.", "error");
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<i class="fa-solid fa-check"></i> Upload';
  };
  
  reader.readAsArrayBuffer(selectedFile);
});

// --- Helper: Escape HTML ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Start
checkAuth();

// --- Custom Mouse Cursor Tracker ---
const cursorDot = document.getElementById('custom-dot');
const cursorOutline = document.getElementById('custom-outline');

window.addEventListener('mousemove', (e) => {
  const posX = e.clientX;
  const posY = e.clientY;
  
  cursorDot.style.left = `${posX}px`;
  cursorDot.style.top = `${posY}px`;
  
  cursorOutline.animate({
    left: `${posX}px`,
    top: `${posY}px`
  }, { duration: 150, fill: 'forwards' });
});

document.addEventListener('mouseover', (e) => {
  const isInteractive = e.target.closest('a, button, select, input, textarea, .file-upload-zone, .pagination-btn, .edit-btn, .delete-btn');
  if (isInteractive) {
    cursorDot.classList.add('hovered');
    cursorOutline.classList.add('hovered');
  } else {
    cursorDot.classList.remove('hovered');
    cursorOutline.classList.remove('hovered');
  }
});
