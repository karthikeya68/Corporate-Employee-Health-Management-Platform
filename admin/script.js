// admin/script.js

// Simulated State (Local Storage keys)
const STORAGE_KEYS = {
  USERS: 'caretaker_users',
  RECORDS: 'caretaker_records',
  LOGGED_USER: 'caretaker_logged_admin'
};

// Application State
let loggedUser = null;
let isRegisterMode = false;

// Pagination and Search State
let currentPage = 1;
let totalPages = 1;
const limit = 10;
let searchQuery = '';
let searchTimeout = null;

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

// Stats DOM
const statTotalPatients = document.getElementById('stat-total-patients');
const statTotalQty = document.getElementById('stat-total-qty');
const statTotalOperators = document.getElementById('stat-total-operators');

// Table Controls & Body
const searchInput = document.getElementById('search-input');
const downloadBtn = document.getElementById('download-btn');
const triggerUploadBtn = document.getElementById('trigger-upload-btn');
const adminFileInput = document.getElementById('admin-file-input');
const masterRecordsBody = document.getElementById('master-records-body');
const masterEmptyState = document.getElementById('master-empty-state');

// Pagination DOM
const paginationInfo = document.getElementById('pagination-info');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

// Modal DOM
const editModal = document.getElementById('edit-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editRecordForm = document.getElementById('edit-record-form');

const editRecId = document.getElementById('edit-rec-id');
const editRecEmpId = document.getElementById('edit-rec-empid');
const editRecName = document.getElementById('edit-rec-name');
const editRecDept = document.getElementById('edit-rec-dept');
const editRecArea = document.getElementById('edit-rec-area');
const editRecDisease = document.getElementById('edit-rec-disease');
const editRecTablets = document.getElementById('edit-rec-tablets');
const editRecQty = document.getElementById('edit-rec-qty');

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
    authTitle.textContent = "Admin Registration";
    authDesc.textContent = "Register a new administrator account.";
    authBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Create Admin';
    nameGroup.style.display = 'flex';
    toggleAuthLink.textContent = "Back to Administrator Login";
    regNameInput.required = true;
  } else {
    authTitle.textContent = "Administrator Login";
    authDesc.textContent = "Access control panel. Register or login to administer medical data.";
    authBtn.innerHTML = '<i class="fa-solid fa-unlock-keyhole"></i> Access Dashboard';
    nameGroup.style.display = 'none';
    toggleAuthLink.textContent = "First time here? Register as Admin";
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
    if (users.some(u => u.empId === empId)) {
      showToast("A user with this Admin ID is already registered.", "error");
      return;
    }
    
    users.push({ empId, name, password, role: 'admin' });
    db.saveUsers(users);
    
    showToast("Admin registered successfully! Logging in...", "success");
    isRegisterMode = false;
    toggleAuthLink.click();
    loginEmpidInput.value = empId;
    loginPwdInput.value = password;
    authForm.dispatchEvent(new Event('submit'));
  } else {
    const matchedUser = users.find(u => u.empId === empId && u.role === 'admin');
    
    if (!matchedUser || matchedUser.password !== password) {
      showToast("Invalid Credentials for Admin role.", "error");
      return;
    }
    
    loggedUser = matchedUser;
    localStorage.setItem(STORAGE_KEYS.LOGGED_USER, JSON.stringify(loggedUser));
    
    showToast("Admin access authenticated!", "success");
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
  
  currentPage = 1;
  searchQuery = '';
  searchInput.value = '';
  
  loadDashboardData();
}

// --- Logout ---
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.LOGGED_USER);
  loggedUser = null;
  showToast("Logged out from Admin portal.", "success");
  showAuthPage();
});

// --- Load Dashboard Data ---
function loadDashboardData() {
  loadStats();
  loadRecords();
}

// --- Load Simulated Stats ---
function loadStats() {
  const records = db.getRecords();
  const users = db.getUsers();
  
  const totalRecords = records.length;
  const totalQty = records.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const totalOperators = users.filter(u => u.role === 'operator').length;
  
  statTotalPatients.textContent = totalRecords;
  statTotalQty.textContent = totalQty;
  statTotalOperators.textContent = totalOperators;
}

// --- Load Records with Search and Pagination (Client-Side) ---
function loadRecords() {
  const allRecords = db.getRecords();
  
  // Sort by date descending
  allRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Filter based on search query
  let filtered = allRecords;
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    filtered = allRecords.filter(r => 
      String(r.empId).toLowerCase().includes(q) ||
      String(r.name).toLowerCase().includes(q) ||
      String(r.department).toLowerCase().includes(q) ||
      String(r.workingArea).toLowerCase().includes(q) ||
      String(r.disease).toLowerCase().includes(q) ||
      String(r.tabletsGiven).toLowerCase().includes(q) ||
      String(r.enteredBy).toLowerCase().includes(q)
    );
  }
  
  // Pagination Math
  const totalRecords = filtered.length;
  totalPages = Math.ceil(totalRecords / limit) || 1;
  
  if (currentPage > totalPages) currentPage = totalPages;
  
  const startIndex = (currentPage - 1) * limit;
  const paginatedRecords = filtered.slice(startIndex, startIndex + limit);
  
  masterRecordsBody.innerHTML = '';
  
  if (paginatedRecords.length === 0) {
    masterEmptyState.style.display = 'flex';
    updatePaginationControls();
    return;
  }
  
  masterEmptyState.style.display = 'none';
  
  paginatedRecords.forEach(record => {
    const tr = document.createElement('tr');
    const date = new Date(record.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    tr.innerHTML = `
      <td><strong>${escapeHTML(record.empId)}</strong></td>
      <td>${escapeHTML(record.name)}</td>
      <td><span class="cell-pill dept">${escapeHTML(record.department)}</span></td>
      <td>${escapeHTML(record.workingArea)}</td>
      <td><span class="cell-pill disease">${escapeHTML(record.disease)}</span></td>
      <td>${escapeHTML(record.tabletsGiven)}</td>
      <td style="font-weight:600;">${record.quantity}</td>
      <td><span class="role-tag operator" style="font-size:0.7rem;">${escapeHTML(record.enteredBy || 'unknown')}</span></td>
      <td style="color:var(--text-muted); font-size:0.85rem;">${date}</td>
      <td>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary btn-icon edit-btn" data-id="${record._id}" title="Edit Record">
            <i class="fa-solid fa-pencil" style="color:var(--primary);"></i>
          </button>
          <button class="btn btn-secondary btn-icon delete-btn" data-id="${record._id}" title="Delete Record">
            <i class="fa-solid fa-trash-can" style="color:var(--danger);"></i>
          </button>
        </div>
      </td>
    `;
    masterRecordsBody.appendChild(tr);
  });
  
  setupTableActionListeners();
  updatePaginationControls();
}

function updatePaginationControls() {
  paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadRecords();
  }
});

nextPageBtn.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage++;
    loadRecords();
  }
});

// --- Search Input Listener with Debounce ---
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchQuery = e.target.value;
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    loadRecords();
  }, 300);
});

// --- Table Action Clicks ---
function setupTableActionListeners() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditModal(id);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Are you sure you want to permanently delete this medical record?")) {
        deleteRecord(id);
      }
    });
  });
}

// --- Delete Record Handler ---
function deleteRecord(id) {
  const records = db.getRecords();
  const updated = records.filter(r => r._id !== id);
  db.saveRecords(updated);
  
  showToast("Record successfully deleted.", "success");
  loadDashboardData();
}

// --- Edit Modal Handlers ---
function openEditModal(id) {
  const records = db.getRecords();
  const record = records.find(r => r._id === id);
  
  if (!record) {
    showToast("Record details not found.", "error");
    return;
  }
  
  editRecId.value = record._id;
  editRecEmpId.value = record.empId;
  editRecName.value = record.name;
  editRecDept.value = record.department;
  editRecArea.value = record.workingArea;
  editRecDisease.value = record.disease;
  editRecTablets.value = record.tabletsGiven;
  editRecQty.value = record.quantity;
  
  editModal.classList.add('show');
}

function closeEditModal() {
  editModal.classList.remove('show');
  editRecordForm.reset();
}

closeModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);

editRecordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const id = editRecId.value;
  const records = db.getRecords();
  const recordIndex = records.findIndex(r => r._id === id);
  
  if (recordIndex === -1) {
    showToast("Record not found.", "error");
    return;
  }
  
  records[recordIndex] = {
    ...records[recordIndex],
    empId: editRecEmpId.value.trim().toUpperCase(),
    name: editRecName.value.trim(),
    department: editRecDept.value.trim(),
    workingArea: editRecArea.value.trim(),
    disease: editRecDisease.value.trim(),
    tabletsGiven: editRecTablets.value.trim(),
    quantity: parseInt(editRecQty.value, 10)
  };
  
  db.saveRecords(records);
  showToast("Record updated successfully!", "success");
  closeEditModal();
  loadDashboardData();
});

// --- Export Excel Sheet (Client-Side) ---
downloadBtn.addEventListener('click', () => {
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  
  try {
    const records = db.getRecords();
    const sorted = [...records].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const excelRows = sorted.map(rec => ({
      'Emp ID': rec.empId,
      'Patient Name': rec.name,
      'Department': rec.department,
      'Working Area': rec.workingArea,
      'Health Disease': rec.disease,
      'Tablets Given': rec.tabletsGiven,
      'Quantity': rec.quantity,
      'Entered By': rec.enteredBy,
      'Source': rec.source,
      'Date Added': new Date(rec.createdAt).toISOString()
    }));
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    
    worksheet['!cols'] = [
      { wch: 12 }, // Emp ID
      { wch: 20 }, // Patient Name
      { wch: 15 }, // Department
      { wch: 15 }, // Working Area
      { wch: 20 }, // Disease
      { wch: 25 }, // Tablets Given
      { wch: 10 }, // Quantity
      { wch: 15 }, // Entered By
      { wch: 15 }, // Source
      { wch: 25 }  // Date Added
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medical Records');
    
    const filename = `medical_records_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    showToast("Excel spreadsheet downloaded successfully!", "success");
  } catch (err) {
    showToast(`Export failed: ${err.message}`, "error");
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Export Excel';
  }
});

// --- Import Excel (Admin) ---
triggerUploadBtn.addEventListener('click', () => adminFileInput.click());

adminFileInput.addEventListener('change', (e) => {
  if (e.target.files.length === 0) return;
  const file = e.target.files[0];
  
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    showToast("Invalid file format. Please upload an Excel sheet (.xlsx, .xls)", "error");
    adminFileInput.value = '';
    return;
  }
  
  triggerUploadBtn.disabled = true;
  triggerUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  
  const reader = new FileReader();
  
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
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
      
      showToast(`Spreadsheet uploaded and synchronized successfully! (${importedRecords.length} records imported)`, "success");
      loadDashboardData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      adminFileInput.value = '';
      triggerUploadBtn.disabled = false;
      triggerUploadBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Excel';
    }
  };
  
  reader.onerror = function() {
    showToast("File reading error.", "error");
    triggerUploadBtn.disabled = false;
    triggerUploadBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Excel';
  };
  
  reader.readAsArrayBuffer(file);
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
