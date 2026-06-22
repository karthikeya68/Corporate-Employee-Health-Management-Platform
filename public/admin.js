// public/admin.js

// Simulated State (Local Storage keys)
const STORAGE_KEYS = {
  USERS: 'caretaker_users',
  EMPLOYEES: 'caretaker_employees',
  RECORDS: 'caretaker_records',
  LOGGED_USER: 'caretaker_logged_admin'
};

// Application State
let loggedUser = null;

// Pagination and Search State
let currentPage = 1;
let totalPages = 1;
const limit = 10;
let searchQuery = '';
let searchTimeout = null;

// DOM Elements
const displayUserName = document.getElementById('display-user-name');
const logoutBtn = document.getElementById('logout-btn');

// Stats DOM
const statTotalPatients = document.getElementById('stat-total-patients');
const statTotalQty = document.getElementById('stat-total-qty');
const statTotalOperators = document.getElementById('stat-total-operators');
const statTodayQty = document.getElementById('stat-today-qty');
const statTotalTablets = document.getElementById('stat-total-tablets');

// Tab 1: Master Logs Table & Controls
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

// Tab 2: Manual Entries Forms
const adminEmployeeForm = document.getElementById('admin-employee-form');
const empIdInput = document.getElementById('emp-id');
const empNameInput = document.getElementById('emp-name');
const empDeptInput = document.getElementById('emp-dept');
const empAreaInput = document.getElementById('emp-area');

const adminPrescribeForm = document.getElementById('admin-prescribe-form');
const presEmpId = document.getElementById('pres-empid');
const presName = document.getElementById('pres-name');
const presArea = document.getElementById('pres-area');
const presSet = document.getElementById('pres-set');
const presProblem = document.getElementById('pres-problem');
const presTablets = document.getElementById('pres-tablets');
const presQty = document.getElementById('pres-qty');

// Tab 3: History Lookup DOM
const historySearchId = document.getElementById('history-search-id');
const lookupHistoryBtn = document.getElementById('lookup-history-btn');
const historyResults = document.getElementById('history-results');
const historyEmpty = document.getElementById('history-empty');
const histEmpName = document.getElementById('hist-emp-name');
const histEmpId = document.getElementById('hist-emp-id');
const histEmpDept = document.getElementById('hist-emp-dept');
const histEmpArea = document.getElementById('hist-emp-area');
const empHistoryBody = document.getElementById('emp-history-body');

// Tab 4: Admin Management
const adminsListContainer = document.getElementById('admins-list-container');

// Modal DOM
const editModal = document.getElementById('edit-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editRecordForm = document.getElementById('edit-record-form');

const editRecId = document.getElementById('edit-rec-id');
const editRecEmpId = document.getElementById('edit-rec-empid');
const editRecName = document.getElementById('edit-rec-name');
const editRecProblem = document.getElementById('edit-rec-problem');
const editRecTablets = document.getElementById('edit-rec-tablets');
const editRecQty = document.getElementById('edit-rec-qty');

// --- Helper: LocalStorage DB Operations ---
const db = {
  getUsers: () => JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [],
  saveUsers: (users) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    fetch('/api/save-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users)
    }).catch(err => console.error('Failed to sync users to server:', err));
  },
  getEmployees: () => JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) || [],
  saveEmployees: (employees) => {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    fetch('/api/save-employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employees)
    }).catch(err => console.error('Failed to sync employees to server:', err));
  },
  getRecords: () => JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS)) || [],
  saveRecords: (records) => {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    fetch('/api/save-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records)
    }).catch(err => console.error('Failed to sync records to server:', err));
  }
};

async function syncFromDatabase() {
  try {
    const res = await fetch('/api/get-all');
    const data = await res.json();
    if (data.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
    if (data.employees) localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(data.employees));
    if (data.records) localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(data.records));
  } catch (err) {
    console.error('Failed to sync from database server:', err);
  }
}

// Toast notification helper
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

// --- Check Auth Status ---
function checkAuth() {
  const session = localStorage.getItem(STORAGE_KEYS.LOGGED_USER);
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  
  loggedUser = JSON.parse(session);
  initializeDashboard();
}

function initializeDashboard() {
  displayUserName.textContent = loggedUser.name;
  switchTab('master-logs');
  loadDashboardData();
  
  // Set up stats timeframe filter listener
  const statsTimeframeSelect = document.getElementById('stats-timeframe');
  if (statsTimeframeSelect) {
    statsTimeframeSelect.addEventListener('change', () => {
      loadStats();
    });
  }

  // Set up offline banner upload handlers
  const offlineUploadBtn = document.getElementById('offline-upload-btn');
  const offlineFileInput = document.getElementById('offline-file-input');
  if (offlineUploadBtn && offlineFileInput) {
    offlineUploadBtn.addEventListener('click', () => {
      offlineFileInput.click();
    });
    offlineFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        parseAndSaveExcel(e.target.files[0], true);
      }
    });
  }
  
  // Set up auto-completing name and patient history insights during prescription entry
  presEmpId.addEventListener('input', () => {
    const id = presEmpId.value.trim().toUpperCase();
    if (!id) {
      presName.value = '';
      updatePatientInsights('');
      return;
    }
    const employees = db.getEmployees();
    const matched = employees.find(e => e.empId === id);
    presName.value = matched ? matched.name : '';
    updatePatientInsights(id);
  });

  // Check database status and start polling every 5 seconds
  checkDbStatus();
  setInterval(checkDbStatus, 5000);
}

// --- Helper: Check MongoDB Status ---
async function checkDbStatus() {
  const badge = document.getElementById('db-status');
  const banner = document.getElementById('offline-banner');
  if (!badge) return;

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data && data.connected) {
      badge.className = 'db-status-badge connected';
      badge.innerHTML = '<i class="fa-solid fa-circle"></i> MongoDB Connected';
      if (banner) banner.style.display = 'none';
    } else {
      badge.className = 'db-status-badge disconnected';
      badge.innerHTML = '<i class="fa-solid fa-circle"></i> MongoDB Disconnected';
      if (banner) banner.style.display = 'flex';
    }
  } catch (err) {
    badge.className = 'db-status-badge disconnected';
    badge.innerHTML = '<i class="fa-solid fa-circle"></i> MongoDB Disconnected';
    if (banner) banner.style.display = 'flex';
  }
}

// --- Patient History Insights Helper ---
function updatePatientInsights(empId) {
  const insightsPanel = document.getElementById('patient-history-insights');
  const insightTotalTablets = document.getElementById('insight-total-tablets');
  const insightCommonIssue = document.getElementById('insight-common-issue');
  const insightFrequentArea = document.getElementById('insight-frequent-area');

  if (!insightsPanel) return;

  if (!empId) {
    insightsPanel.style.display = 'none';
    return;
  }

  const employees = db.getEmployees();
  const matchedEmp = employees.find(e => e.empId === empId);
  if (!matchedEmp) {
    insightsPanel.style.display = 'none';
    return;
  }

  const records = db.getRecords();
  const empRecords = records.filter(r => r.empId === empId);

  if (empRecords.length === 0) {
    insightTotalTablets.textContent = '0';
    insightCommonIssue.textContent = 'None';
    insightCommonIssue.title = 'None';
    const workArea = matchedEmp.workingArea || 'N/A';
    insightFrequentArea.textContent = workArea;
    insightFrequentArea.title = workArea;
    insightsPanel.style.display = 'flex';
    return;
  }

  // Calculate total tablets taken
  const totalQty = empRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);

  // Calculate most common issue (problem)
  const problemCounts = {};
  empRecords.forEach(r => {
    const prob = (r.problem || '').trim();
    if (prob) {
      problemCounts[prob] = (problemCounts[prob] || 0) + 1;
    }
  });
  let mostCommonProblem = 'N/A';
  let maxProbCount = 0;
  for (const prob in problemCounts) {
    if (problemCounts[prob] > maxProbCount) {
      maxProbCount = problemCounts[prob];
      mostCommonProblem = prob;
    }
  }

  // Calculate most frequent working area
  const areaCounts = {};
  empRecords.forEach(r => {
    const area = (r.workingArea || '').trim();
    if (area) {
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    }
  });
  let mostFreqArea = matchedEmp.workingArea || 'N/A';
  let maxAreaCount = 0;
  for (const area in areaCounts) {
    if (areaCounts[area] > maxAreaCount) {
      maxAreaCount = areaCounts[area];
      mostFreqArea = area;
    }
  }

  // Update DOM
  insightTotalTablets.textContent = totalQty;
  insightCommonIssue.textContent = mostCommonProblem;
  insightCommonIssue.title = mostCommonProblem;
  insightFrequentArea.textContent = mostFreqArea;
  insightFrequentArea.title = mostFreqArea;

  insightsPanel.style.display = 'flex';
}

// --- Logout ---
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.LOGGED_USER);
  loggedUser = null;
  window.location.href = 'login.html';
});

// --- Tab Switching Logic ---
window.switchTab = function(tabId) {
  // Update Tab Button States
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
    btn.getAttribute('onclick').includes(tabId)
  );
  if (activeBtn) activeBtn.classList.add('active');
  
  // Update Tab Content States
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  const selectedTabContent = document.getElementById(`tab-${tabId}`);
  if (selectedTabContent) {
    selectedTabContent.style.display = 'block';
  }
  
  // Refresh Tab specific views
  if (tabId === 'master-logs') loadDashboardData();
  if (tabId === 'admin-mgr') loadStaffLists();
  if (tabId === 'emp-history') clearHistoryLookup();
};

function loadDashboardData() {
  loadStats();
  loadRecords();
}

// --- Stats Widgets Loader ---
function loadStats() {
  const records = db.getRecords();
  const employees = db.getEmployees();
  const users = db.getUsers();
  
  // Get timeframe filter selection
  const statsTimeframeSelect = document.getElementById('stats-timeframe');
  const timeframe = statsTimeframeSelect ? statsTimeframeSelect.value : 'all';
  
  // Filter records based on timeframe
  let filteredRecords = [...records];
  const now = new Date();
  
  if (timeframe === 'today') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    filteredRecords = records.filter(r => r.createdAt && new Date(r.createdAt) >= startOfToday);
  } else if (timeframe === '2days') {
    const fortyEightHoursAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    filteredRecords = records.filter(r => r.createdAt && new Date(r.createdAt) >= fortyEightHoursAgo);
  } else if (timeframe === 'week') {
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    filteredRecords = records.filter(r => r.createdAt && new Date(r.createdAt) >= sevenDaysAgo);
  } else if (timeframe === 'month') {
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    filteredRecords = records.filter(r => r.createdAt && new Date(r.createdAt) >= thirtyDaysAgo);
  }
  
  // 1. Total patients defined as total unique staff members (empId) who came/got tablets in the period
  const totalPatients = new Set(filteredRecords.map(r => r.empId)).size;
  
  // 2. Tablets Distributed / Total Tablets Given: sum of quantities in the period
  const totalQty = filteredRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  
  // 3. Registered Staff: total staff members (employees) registered in the system (independent of filter)
  const totalStaff = employees.length;
  
  // 4. Today's total tablets (independent of filter)
  const todayStr = new Date().toDateString();
  const todayQty = records
    .filter(r => r.createdAt && new Date(r.createdAt).toDateString() === todayStr)
    .reduce((sum, r) => sum + (r.quantity || 0), 0);
  
  statTotalPatients.textContent = totalPatients;
  statTotalQty.textContent = totalQty;
  statTotalOperators.textContent = totalStaff;
  if (statTodayQty) statTodayQty.textContent = todayQty;
  if (statTotalTablets) statTotalTablets.textContent = totalQty;
}

// --- Tab 1: Master Records grid (Join data) ---
function loadRecords() {
  const allRecords = db.getRecords();
  const allEmployees = db.getEmployees();
  
  // Sort date descending
  allRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Map/Join records to Employee personal details
  let joinedRecords = allRecords.map(rec => {
    const emp = allEmployees.find(e => e.empId === rec.empId) || {
      name: 'Unknown',
      department: 'Not Specified',
      workingArea: 'Not Specified'
    };
    return {
      ...rec,
      name: emp.name,
      department: emp.department,
      workingArea: rec.workingArea || emp.workingArea || 'Not Specified'
    };
  });
  
  // Apply Search query
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    joinedRecords = joinedRecords.filter(r => 
      String(r.empId).toLowerCase().includes(q) ||
      String(r.name).toLowerCase().includes(q) ||
      String(r.department).toLowerCase().includes(q) ||
      String(r.workingArea).toLowerCase().includes(q) ||
      String(r.problem).toLowerCase().includes(q) ||
      String(r.tabletsGiven).toLowerCase().includes(q) ||
      String(r.enteredBy).toLowerCase().includes(q)
    );
  }
  
  // Pagination Math
  const totalRecords = joinedRecords.length;
  totalPages = Math.ceil(totalRecords / limit) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  
  const startIndex = (currentPage - 1) * limit;
  const paginated = joinedRecords.slice(startIndex, startIndex + limit);
  
  masterRecordsBody.innerHTML = '';
  
  if (paginated.length === 0) {
    masterEmptyState.style.display = 'flex';
    updatePaginationControls();
    return;
  }
  
  masterEmptyState.style.display = 'none';
  
  paginated.forEach(record => {
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
      <td>${escapeHTML(record.workingArea)}${record.workingSet ? ` <span class="cell-pill set" style="font-size:0.75rem; background:rgba(37,99,235,0.08); color:var(--primary); font-weight:600; padding:0.15rem 0.45rem; border-radius:4px; border:1px solid rgba(37,99,235,0.15);">${escapeHTML(record.workingSet)}</span>` : ''}</td>
      <td><span class="cell-pill disease">${escapeHTML(record.problem)}</span></td>
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

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchQuery = e.target.value;
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    loadRecords();
  }, 300);
});

// Setup click handlers for Edit and Delete
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
      if (confirm("Are you sure you want to permanently delete this record?")) {
        deleteRecord(id);
      }
    });
  });
}

function deleteRecord(id) {
  const records = db.getRecords();
  const updated = records.filter(r => r._id !== id);
  db.saveRecords(updated);
  
  showToast("Record successfully deleted.", "success");
  loadDashboardData();
}

// --- Modal Editing logic ---
function openEditModal(id) {
  const records = db.getRecords();
  const employees = db.getEmployees();
  
  const record = records.find(r => r._id === id);
  if (!record) return;
  
  const emp = employees.find(e => e.empId === record.empId) || { name: 'Unknown' };
  
  editRecId.value = record._id;
  editRecEmpId.value = record.empId;
  editRecName.value = emp.name;
  editRecProblem.value = record.problem;
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
  const idx = records.findIndex(r => r._id === id);
  if (idx === -1) return;
  
  records[idx] = {
    ...records[idx],
    problem: editRecProblem.value.trim(),
    tabletsGiven: editRecTablets.value.trim(),
    quantity: parseInt(editRecQty.value, 10)
  };
  
  db.saveRecords(records);
  showToast("Health problem log updated!", "success");
  closeEditModal();
  loadDashboardData();
});

// --- Tab 2: Manual Entries submission ---
// 1. Employee personal details save
adminEmployeeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const empId = empIdInput.value.trim().toUpperCase();
  const name = empNameInput.value.trim();
  const department = empDeptInput.value.trim();
  const workingArea = empAreaInput.value.trim();
  
  const employees = db.getEmployees();
  const idx = employees.findIndex(emp => emp.empId === empId);
  
  if (idx > -1) {
    employees[idx] = { empId, name, department, workingArea };
  } else {
    employees.push({ empId, name, department, workingArea });
  }
  
  db.saveEmployees(employees);
  showToast(`Employee ${empId} details saved successfully!`, "success");
  adminEmployeeForm.reset();
});

// 2. Prescribe Tablets & log health problem
adminPrescribeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const empId = presEmpId.value.trim().toUpperCase();
  const problem = presProblem.value.trim();
  const tabletsGiven = presTablets.value.trim();
  const quantity = parseInt(presQty.value, 10);
  
  const employees = db.getEmployees();
  const empExists = employees.some(e => e.empId === empId);
  if (!empExists) {
    showToast("This Employee ID is not registered. Please save their details on the Add Employee tab first!", "error");
    return;
  }
  
  const records = db.getRecords();
  const newRecord = {
    _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    empId,
    problem,
    tabletsGiven,
    quantity,
    workingArea: presArea.value.trim(),
    workingSet: presSet.value,
    enteredBy: loggedUser.empId,
    source: 'manual',
    createdAt: new Date().toISOString()
  };
  records.push(newRecord);
  db.saveRecords(records);
  
  showToast("Tablets distributed and entry saved successfully!", "success");
  adminPrescribeForm.reset();
  updatePatientInsights('');
});

// --- Tab 3: History Lookup logic ---
function clearHistoryLookup() {
  historySearchId.value = '';
  historyResults.style.display = 'none';
  historyEmpty.style.display = 'flex';
}

lookupHistoryBtn.addEventListener('click', () => {
  const id = historySearchId.value.trim().toUpperCase();
  if (!id) {
    showToast("Please enter a valid Employee ID.", "error");
    return;
  }
  
  const employees = db.getEmployees();
  const records = db.getRecords();
  
  const matchedEmp = employees.find(e => e.empId === id);
  if (!matchedEmp) {
    showToast(`Employee ID ${id} is not registered in details repository.`, "error");
    clearHistoryLookup();
    return;
  }
  
  const matchedRecords = records.filter(r => r.empId === id);
  matchedRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Set details banner
  histEmpId.textContent = matchedEmp.empId;
  histEmpName.textContent = matchedEmp.name;
  histEmpDept.textContent = matchedEmp.department;
  histEmpArea.textContent = matchedEmp.workingArea;
  
  // Render history rows
  empHistoryBody.innerHTML = '';
  if (matchedRecords.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-muted);">No health problems logged for this employee.</td>`;
    empHistoryBody.appendChild(tr);
  } else {
    matchedRecords.forEach(r => {
      const tr = document.createElement('tr');
      const date = new Date(r.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      tr.innerHTML = `
        <td><span class="cell-pill disease">${escapeHTML(r.problem)}</span></td>
        <td>${escapeHTML(r.tabletsGiven)}</td>
        <td style="font-weight: 600;">${r.quantity}</td>
        <td><span class="role-tag operator" style="font-size:0.7rem;">${escapeHTML(r.enteredBy)}</span></td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${date}</td>
      `;
      empHistoryBody.appendChild(tr);
    });
  }
  
  historyEmpty.style.display = 'none';
  historyResults.style.display = 'flex';
});

// --- Tab 4: Staff Management (Listing and removing admins and operators) ---
function loadStaffLists() {
  const users = db.getUsers();
  const admins = users.filter(u => u.role === 'admin');
  const operators = users.filter(u => u.role === 'operator');
  
  // Render Admins
  adminsListContainer.innerHTML = '';
  admins.forEach(admin => {
    const div = document.createElement('div');
    div.className = 'user-item';
    const isSelf = admin.empId === loggedUser.empId;
    
    div.innerHTML = `
      <div class="user-item-info">
        <span class="user-item-name">${escapeHTML(admin.name)} ${isSelf ? '<span class="role-tag admin" style="font-size:0.55rem; padding:0.1rem 0.3rem;">You</span>' : ''}</span>
        <span class="user-item-empid">Admin ID: ${escapeHTML(admin.empId)}</span>
      </div>
      <div>
        <button class="btn btn-danger btn-icon remove-user-btn" data-id="${admin.empId}" data-role="admin" ${isSelf ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Remove Administrator">
          <i class="fa-solid fa-user-minus"></i> Remove
        </button>
      </div>
    `;
    adminsListContainer.appendChild(div);
  });

  // Render Operators
  const operatorsListContainer = document.getElementById('operators-list-container');
  operatorsListContainer.innerHTML = '';
  if (operators.length === 0) {
    operatorsListContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); padding:1rem 0;">No operator accounts registered.</p>`;
  } else {
    operators.forEach(op => {
      const div = document.createElement('div');
      div.className = 'user-item';
      
      div.innerHTML = `
        <div class="user-item-info">
          <span class="user-item-name">${escapeHTML(op.name)}</span>
          <span class="user-item-empid">Operator ID: ${escapeHTML(op.empId)}</span>
        </div>
        <div>
          <button class="btn btn-danger btn-icon remove-user-btn" data-id="${op.empId}" data-role="operator" title="Remove Operator">
            <i class="fa-solid fa-user-minus"></i> Remove
          </button>
        </div>
      `;
      operatorsListContainer.appendChild(div);
    });
  }

  // Bind remove buttons click listeners
  document.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const role = btn.getAttribute('data-role');
      if (confirm(`Are you sure you want to remove ${role === 'admin' ? 'Admin' : 'Operator'} credentials for ${id}?`)) {
        removeUser(id, role);
      }
    });
  });
}

function removeUser(empId, role) {
  const users = db.getUsers();
  const updated = users.filter(u => u.empId !== empId);
  db.saveUsers(updated);
  
  showToast(`${role === 'admin' ? 'Admin' : 'Operator'} ${empId} successfully removed.`, "success");
  loadStaffLists();
}

// --- Excel Export (Separate sheets: Employee Details & Health Problems) ---
downloadBtn.addEventListener('click', () => {
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
  
  try {
    const employees = db.getEmployees();
    const records = db.getRecords();
    
    // Sort oldest to newest for the reports
    const sortedRecords = [...records].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const sortedEmployees = [...employees].sort((a, b) => a.empId.localeCompare(b.empId));
    
    // Format Employee Details Rows
    const employeeRows = sortedEmployees.map(emp => ({
      'Emp ID': emp.empId,
      'Employee Name': emp.name,
      'Department': emp.department,
      'Working Area': emp.workingArea
    }));
    
    // Format Health Problems Rows
    const problemRows = sortedRecords.map(rec => {
      const emp = employees.find(e => e.empId === rec.empId) || {};
      return {
        'Emp ID': rec.empId,
        'Health Problem': rec.problem,
        'Tablets Given': rec.tabletsGiven,
        'Quantity': rec.quantity,
        'Working Area': rec.workingArea || emp.workingArea || 'Not Specified',
        'Entered By': rec.enteredBy,
        'Date Prescribed': new Date(rec.createdAt).toISOString()
      };
    });
    
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Employee Details
    const employeeSheet = XLSX.utils.json_to_sheet(employeeRows);
    employeeSheet['!cols'] = [
      { wch: 12 }, // Emp ID
      { wch: 22 }, // Employee Name
      { wch: 15 }, // Department
      { wch: 18 }  // Working Area
    ];
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employee Details');
    
    // Sheet 2: Health Problems Log
    const problemSheet = XLSX.utils.json_to_sheet(problemRows);
    problemSheet['!cols'] = [
      { wch: 12 }, // Emp ID
      { wch: 22 }, // Health Problem
      { wch: 22 }, // Tablets Given
      { wch: 10 }, // Quantity
      { wch: 15 }, // Working Area
      { wch: 15 }, // Entered By
      { wch: 25 }  // Date Prescribed
    ];
    XLSX.utils.book_append_sheet(workbook, problemSheet, 'Health Problems Log');
    
    const filename = `caretaker_records_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    showToast("Separate Excel spreadsheets generated successfully!", "success");
  } catch (err) {
    showToast(`Export failed: ${err.message}`, "error");
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Export Excel';
  }
});

// --- Excel Import (Processes and splits imported rows) ---
triggerUploadBtn.addEventListener('click', () => adminFileInput.click());

adminFileInput.addEventListener('change', (e) => {
  if (e.target.files.length === 0) return;
  const file = e.target.files[0];
  parseAndSaveExcel(file, false);
});

function parseAndSaveExcel(file, isOffline = false) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    showToast("Invalid file format. Please upload an Excel sheet (.xlsx, .xls)", "error");
    return;
  }
  
  if (!isOffline) {
    triggerUploadBtn.disabled = true;
    triggerUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  }
  
  const reader = new FileReader();
  
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const newEmployees = [];
      const newRecords = [];
      const now = new Date().toISOString();
      
      const hasEmpSheet = workbook.SheetNames.some(s => s.toLowerCase().includes('employee'));
      const hasIssueSheet = workbook.SheetNames.some(s => s.toLowerCase().includes('health') || s.toLowerCase().includes('issue') || s.toLowerCase().includes('problem'));
      
      if (hasEmpSheet || hasIssueSheet) {
        // Parse sheets independently
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          const isEmployeeSheet = sheetName.toLowerCase().includes('employee');
          
          rows.forEach((row) => {
            const rowKeys = {};
            Object.keys(row).forEach(k => {
              rowKeys[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = k;
            });
            
            const empIdKey = rowKeys['empid'] || rowKeys['employeeid'] || rowKeys['id'];
            if (!empIdKey || !row[empIdKey]) return;
            const empId = String(row[empIdKey]).trim().toUpperCase();
            
            if (isEmployeeSheet) {
              const nameKey = rowKeys['name'] || rowKeys['patientname'] || rowKeys['fullname'] || rowKeys['employeename'];
              const deptKey = rowKeys['department'] || rowKeys['dept'];
              const areaKey = rowKeys['workingarea'] || rowKeys['area'] || rowKeys['workarea'] || rowKeys['location'];
              
              if (!nameKey || !row[nameKey]) return;
              newEmployees.push({
                empId,
                name: String(row[nameKey]).trim(),
                department: deptKey ? String(row[deptKey]).trim() : 'General',
                workingArea: areaKey ? String(row[areaKey]).trim() : 'Not Specified'
              });
            } else {
              const problemKey = rowKeys['healthproblem'] || rowKeys['problem'] || rowKeys['healthissue'] || rowKeys['symptoms'] || rowKeys['healthdisease'] || rowKeys['disease'];
              const tabletsKey = rowKeys['tabletsgiven'] || rowKeys['tablets'] || rowKeys['tabets'] || rowKeys['medicine'];
              const qtyKey = rowKeys['quantity'] || rowKeys['qty'] || rowKeys['count'];
              
              let quantityVal = 1;
              if (qtyKey) {
                const val = parseInt(row[qtyKey], 10);
                if (!isNaN(val) && val > 0) quantityVal = val;
              }
              
              newRecords.push({
                _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                empId,
                problem: problemKey ? String(row[problemKey]).trim() : 'General Health Problem',
                tabletsGiven: tabletsKey ? String(row[tabletsKey]).trim() : 'None',
                quantity: quantityVal,
                enteredBy: loggedUser.empId,
                source: isOffline ? 'offline_import' : 'excel_upload',
                createdAt: now
              });
            }
          });
        });
      } else {
        // Fallback for unified single sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        rows.forEach((row) => {
          const rowKeys = {};
          Object.keys(row).forEach(k => {
            rowKeys[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = k;
          });
          
          const empIdKey = rowKeys['empid'] || rowKeys['employeeid'] || rowKeys['id'];
          const nameKey = rowKeys['name'] || rowKeys['patientname'] || rowKeys['fullname'];
          if (!empIdKey || !row[empIdKey] || !nameKey || !row[nameKey]) return;
          
          const empId = String(row[empIdKey]).trim().toUpperCase();
          const deptKey = rowKeys['department'] || rowKeys['dept'];
          const areaKey = rowKeys['workingarea'] || rowKeys['area'] || rowKeys['location'];
          const problemKey = rowKeys['healthproblem'] || rowKeys['problem'] || rowKeys['healthissue'] || rowKeys['healthdisease'] || rowKeys['disease'];
          const tabletsKey = rowKeys['tabletsgiven'] || rowKeys['tablets'] || rowKeys['tabets'] || rowKeys['medicine'];
          const qtyKey = rowKeys['quantity'] || rowKeys['qty'] || rowKeys['count'];
          
          let quantityVal = 1;
          if (qtyKey) {
            const val = parseInt(row[qtyKey], 10);
            if (!isNaN(val) && val > 0) quantityVal = val;
          }
          
          newEmployees.push({
            empId,
            name: String(row[nameKey]).trim(),
            department: deptKey ? String(row[deptKey]).trim() : 'General',
            workingArea: areaKey ? String(row[areaKey]).trim() : 'Not Specified'
          });
          
          newRecords.push({
            _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            empId,
            problem: problemKey ? String(row[problemKey]).trim() : 'General Health Problem',
            tabletsGiven: tabletsKey ? String(row[tabletsKey]).trim() : 'None',
            quantity: quantityVal,
            enteredBy: loggedUser.empId,
            source: isOffline ? 'offline_import' : 'excel_upload',
            createdAt: now
          });
        });
      }
      
      // Save data locally
      const existingEmployees = db.getEmployees();
      newEmployees.forEach(newEmp => {
        const index = existingEmployees.findIndex(e => e.empId === newEmp.empId);
        if (index > -1) {
          existingEmployees[index] = newEmp;
        } else {
          existingEmployees.push(newEmp);
        }
      });
      
      const existingRecords = db.getRecords();
      const consolidatedRecords = existingRecords.concat(newRecords);
      
      if (isOffline) {
        localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(existingEmployees));
        localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(consolidatedRecords));
        showToast(`Local storage updated with offline Excel data! (${newEmployees.length} staff details, ${newRecords.length} logs)`, "success");
      } else {
        db.saveEmployees(existingEmployees);
        db.saveRecords(consolidatedRecords);
        showToast(`Excel imported successfully! (${newEmployees.length} employee details updated, ${newRecords.length} health problem logs added)`, "success");
      }
      
      loadDashboardData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      adminFileInput.value = '';
      const offlineInput = document.getElementById('offline-file-input');
      if (offlineInput) offlineInput.value = '';
      if (!isOffline) {
        triggerUploadBtn.disabled = false;
        triggerUploadBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Excel';
      }
    }
  };
  
  reader.onerror = function() {
    showToast("File reading error.", "error");
    if (!isOffline) {
      triggerUploadBtn.disabled = false;
      triggerUploadBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Excel';
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// --- Helper: Escape HTML ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Start
syncFromDatabase().then(() => {
  checkAuth();
});

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
