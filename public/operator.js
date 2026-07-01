// public/operator.js

const STORAGE_KEYS = {
  TOKEN: 'ohc_token',
  OPERATOR: 'ohc_operator',
  DRAFT: 'ohc_report_draft_',
  THEME: 'ohc_theme'
};

// Global variables
let jwtToken = null;
let currentOperator = null;
let activeEmployeeNumber = null; // For currently selected employee in forms
let selectedReportsToCompare = [];
let checkupsChartInstance = null;
let complaintsChartInstance = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initTheme();
  setupSidebarNavigation();
  setupFormHandlers();
  setupSearchHandlers();
  setupSettingsHandlers();
  setupModalHandlers();
});

// Check if user is logged in
function checkAuth() {
  jwtToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const operatorStr = localStorage.getItem(STORAGE_KEYS.OPERATOR);

  if (!jwtToken || !operatorStr) {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.OPERATOR);
    window.location.href = 'login.html';
    return;
  }

  currentOperator = JSON.parse(operatorStr);
  
  // Display operator details
  document.getElementById('operator-display-name').textContent = currentOperator.fullName;
  document.getElementById('operator-display-id').textContent = currentOperator.employeeId;

  // Load dashboard
  loadDashboardData();
}

// Log Out function
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.OPERATOR);
  window.location.href = 'login.html';
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.classList.remove('dark');
    document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-moon"></i>';
  }

  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').innerHTML = isDark ? 
      '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  });
}

// --- Navigation ---
function setupSidebarNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

function switchView(viewId) {
  // Hide all sections
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
  
  // Show target section
  const section = document.getElementById(`view-${viewId}`);
  if (section) {
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
  }

  // Update Header Title
  const titles = {
    'dashboard': 'Dashboard Overview',
    'employee-form-view': 'Employee File Registration',
    'patient-form-view': 'New Patient (Illness Visit)',
    'patient-history-view': 'Patient History & Analytics',
    'issue-history': 'Global Issue History',
    'yearly-report-view': 'Upload Yearly Report',
    'hospital-report-view': 'Upload Hospital Report',
    'report-form': 'Medical Test Report',
    'search-history': 'Employee Records Management',
    'settings': 'Settings & Import Panel'
  };
  document.getElementById('current-view-title').textContent = titles[viewId] || 'OHC Management System';

  // Load specific view data
  if (viewId === 'dashboard') {
    loadDashboardData();
  } else if (viewId === 'search-history') {
    searchEmployees('');
  } else if (viewId === 'issue-history') {
    loadIssueHistory();
  }
}

// --- API Fetch Helper ---
async function fetchWithAuth(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${jwtToken}`;
  
  try {
    const res = await fetch(url, options);
    if (res.status === 401) {
      // Token expired or invalid
      showToast('Session expired. Logging out...', 'error');
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.OPERATOR);
        window.location.href = 'login.html';
      }, 1500);
      throw new Error('Unauthorized');
    }
    return res;
  } catch (err) {
    console.error('Fetch error:', err);
    throw err;
  }
}

// --- Toast notification ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  toast.className = `alert-toast show ${type}`;
  
  if (type === 'success') {
    toastIcon.className = 'fa-solid fa-circle-check';
  } else if (type === 'error') {
    toastIcon.className = 'fa-solid fa-circle-xmark';
  } else {
    toastIcon.className = 'fa-solid fa-circle-exclamation';
  }
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// --- Dashboard Loading ---
async function loadDashboardData() {
  try {
    const fromInput = document.getElementById('dashboard-from-date');
    const toInput = document.getElementById('dashboard-to-date');
    
    const params = new URLSearchParams();
    if (fromInput && fromInput.value) params.append('from', fromInput.value);
    if (toInput && toInput.value) params.append('to', toInput.value);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await fetchWithAuth(`/api/dashboard/stats${queryString}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch stats: ${res.statusText}`);
    }
    const stats = await res.json();

    document.getElementById('stat-total-employees').textContent = stats.totalEmployees;
    document.getElementById('stat-today-checkups').textContent = stats.todayCheckups;
    
    const overallEl = document.getElementById('stat-overall-checkups');
    if (overallEl) overallEl.textContent = stats.totalCheckups || 0;
    
    // Load today's patients table
    const recentBody = document.getElementById('dashboard-recent-employees');
    recentBody.innerHTML = '';
    if (stats.todayPatients && stats.todayPatients.length > 0) {
      stats.todayPatients.forEach(med => {
        const tr = document.createElement('tr');
        const emp = med.employeeId;
        const timeStr = new Date(med.issuedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        tr.innerHTML = `
          <td><span style="font-size:0.85rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${timeStr}</span></td>
          <td><strong>${emp ? emp.employeeNumber : 'N/A'}</strong></td>
          <td>${emp ? emp.name : 'Unknown'}</td>
          <td><span class="role-tag admin">${med.issue || 'None'}</span></td>
          <td><i class="fa-solid fa-pills" style="color:var(--text-muted);"></i> ${med.tabletsGiven || 'None'}</td>
          <td><span style="font-weight:600;">${med.quantity || 0}</span></td>
        `;
        
        // Add click listener to show profile if employee exists
        if (emp) {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => showEmployeeProfile(emp.employeeNumber));
        }
        recentBody.appendChild(tr);
      });
    } else {
      recentBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">No patient visits found for this date.</td></tr>`;
    }

    // Load Charts
    loadDashboardCharts(queryString);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

async function loadDashboardCharts(queryString = '') {
  try {
    const res = await fetchWithAuth(`/api/dashboard/analytics${queryString}`);
    if (!res.ok) {
      throw new Error('Failed to load charts');
    }
    const analytics = await res.json();

    // Chart 1: Checkups Trend
    if (checkupsChartInstance) {
      checkupsChartInstance.destroy();
    }
    const checkupCtx = document.getElementById('chart-checkups').getContext('2d');
    
    // Create gradient
    const gradient = checkupCtx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(2, 132, 199, 0.5)');
    gradient.addColorStop(1, 'rgba(2, 132, 199, 0.05)');

    checkupsChartInstance = new Chart(checkupCtx, {
      type: 'line',
      data: {
        labels: analytics.checkups.labels,
        datasets: [{
          label: 'Health Checkups',
          data: analytics.checkups.data,
          borderColor: '#0284c7',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ffffff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: { 
            beginAtZero: true,
            ticks: { precision: 0 } // whole numbers only
          }
        }
      }
    });

    // Chart 2: Common Complaints
    if (complaintsChartInstance) {
      complaintsChartInstance.destroy();
    }
    const complaintsCtx = document.getElementById('chart-complaints').getContext('2d');
    
    const predefinedIssues = [
      "Abdomen Pain", "Acidity", "Back Pain", "Body Pains", "Cold", "Cough", "Dog Bite", 
      "Eye Irritation", "Fever", "Finger Pain", "Foot Pain", "Hand Finger Pain", "Headache", 
      "Joint Pains", "Knee Pain", "Left Foot Finger Pain", "Left Shoulder Pain", "Leg Pain", 
      "Motions", "Neck Pain", "Pain", "Right Hand Pain", "Right Knee Pain", "Right Leg Pain", 
      "Right Shoulder Pain", "Shoulder Pain", "Skin Irritation", "Tooth Pain", "Vomiting", 
      "Weakness", "Wound Pain", "Wrist Pain"
    ];

    const issueCounts = predefinedIssues.map(issue => {
      const idx = analytics.complaints.labels.indexOf(issue);
      return idx !== -1 ? analytics.complaints.data[idx] : 0;
    });

    complaintsChartInstance = new Chart(complaintsCtx, {
      type: 'bar',
      data: {
        labels: predefinedIssues,
        datasets: [{
          label: 'Occurrences',
          data: issueCounts,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1, color: '#e2e8f0' } },
          y: { ticks: { autoSkip: false, font: { size: 11 }, color: '#e2e8f0' } }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load charts:', err);
  }
}

// --- Employee Registration & Saving ---
function setupFormHandlers() {
  // Handle report section toggle visibility
  const reportToggle = document.getElementById('emp-add-report-toggle');
  const reportSection = document.getElementById('embedded-report-section');
  if (reportToggle && reportSection) {
    reportToggle.addEventListener('change', () => {
      reportSection.style.display = reportToggle.checked ? 'flex' : 'none';
      if (reportToggle.checked) {
        document.getElementById('emp-rep-date').value = new Date().toISOString().split('T')[0];
        const empNum = document.getElementById('emp-number').value.trim().toUpperCase();
        if (empNum) {
          loadDraftIfExistsCombined(empNum);
        }
      }
    });
  }

  // Handle General Form submission
  const generalForm = document.getElementById('employee-general-form');
  generalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('emp-name').value.trim();
    const employeeNumber = document.getElementById('emp-number').value.trim().toUpperCase();
    const designation = document.getElementById('emp-designation').value.trim();
    const workLocation = document.getElementById('emp-location').value.trim();
    const age = Number(document.getElementById('emp-age').value);
    
    // Optional vitals fields
    const heightVal = document.getElementById('emp-height').value;
    const weightVal = document.getElementById('emp-weight').value;
    const pulseVal = document.getElementById('emp-pulse').value;
    const bpVal = document.getElementById('emp-bp').value.trim();

    const height = heightVal ? Number(heightVal) : 0;
    const weight = weightVal ? Number(weightVal) : 0;
    const pulse = pulseVal ? Number(pulseVal) : 0;
    const bp = bpVal || 'N/A';

    const payload = {
      name, employeeNumber, designation, workLocation,
      age, height, weight, pulse, bp,
      issue: '', tabletsGiven: '', quantity: 0
    };

    // If report toggle is checked, pack report fields too
    const addReport = reportToggle && reportToggle.checked;
    if (addReport) {
      payload.addReport = true;
      payload.reportDate = document.getElementById('emp-rep-date').value;
      payload.htn = document.getElementById('emp-rep-htn').value;
      payload.dm = document.getElementById('emp-rep-dm').value;
      payload.rbs = document.getElementById('emp-rep-rbs').value.trim();
      payload.serumCreatinine = document.getElementById('emp-rep-creatinine').value.trim();
      payload.serumUrea = document.getElementById('emp-rep-urea').value.trim();
      payload.serumCholinesterase = document.getElementById('emp-rep-cholinesterase').value.trim();
      payload.serumCholesterol = document.getElementById('emp-rep-cholesterol').value.trim();
      payload.serumTriglycerides = document.getElementById('emp-rep-triglycerides').value.trim();
      payload.hdl = document.getElementById('emp-rep-hdl').value.trim();
      payload.ldl = document.getElementById('emp-rep-ldl').value.trim();
      payload.vldl = document.getElementById('emp-rep-vldl').value.trim();
      payload.totalLeucocytes = document.getElementById('emp-rep-wbc').value.trim();
      payload.erythrocyteCount = document.getElementById('emp-rep-rbccount').value.trim();
      payload.neutrophils = document.getElementById('emp-rep-neutrophils').value.trim();
      payload.lymphocytes = document.getElementById('emp-rep-lymphocytes').value.trim();
      payload.eosinophils = document.getElementById('emp-rep-eosinophils').value.trim();
      payload.monocytes = document.getElementById('emp-rep-monocytes').value.trim();
      payload.basophils = document.getElementById('emp-rep-basophils').value.trim();
      payload.esr = document.getElementById('emp-rep-esr').value.trim();
      payload.hb = document.getElementById('emp-rep-hb').value.trim();
      payload.plateletCount = document.getElementById('emp-rep-platelets').value.trim();
      payload.packedCellVolume = document.getElementById('emp-rep-pcv').value.trim();
      payload.mcv = document.getElementById('emp-rep-mcv').value.trim();
      payload.mch = document.getElementById('emp-rep-mch').value.trim();
      payload.mchc = document.getElementById('emp-rep-mchc').value.trim();
      payload.rcdw = document.getElementById('emp-rep-rcdw').value.trim();
      payload.rbcSmear = document.getElementById('emp-rep-rbcsmear').value.trim();
      payload.wbcSmear = document.getElementById('emp-rep-wbcsmear').value.trim();
      payload.plateletSmear = document.getElementById('emp-rep-plateletsmear').value.trim();
      payload.parasites = document.getElementById('emp-rep-parasites').value.trim();
      payload.specificGravity = document.getElementById('emp-rep-gravity').value.trim();
      payload.urinePh = document.getElementById('emp-rep-urineph').value.trim();
      payload.urineAcetone = document.getElementById('emp-rep-acetone').value.trim();
      payload.urineNitrites = document.getElementById('emp-rep-nitrites').value.trim();
      payload.ubs = document.getElementById('emp-rep-ubs').value.trim();
      payload.ubp = document.getElementById('emp-rep-ubp').value.trim();
      payload.urobilinogen = document.getElementById('emp-rep-urobilinogen').value.trim();
      payload.urineLeucocyte = document.getElementById('emp-rep-urineleucocyte').value.trim();
      payload.urineAlbumin = document.getElementById('emp-rep-urinealbumin').value.trim();
      payload.urineSugar = document.getElementById('emp-rep-urinesugar').value.trim();
      payload.uml = document.getElementById('emp-rep-uml').value.trim();
      payload.rbc = document.getElementById('emp-rep-urinerbc').value.trim();
      payload.ec = document.getElementById('emp-rep-urineec').value.trim();
      payload.casts = document.getElementById('emp-rep-casts').value.trim();
      payload.crystals = document.getElementById('emp-rep-crystals').value.trim();
      payload.xrayReport = document.getElementById('emp-rep-xray').value.trim();
      payload.rightEar = document.getElementById('emp-rep-right-ear').value.trim();
      payload.leftEar = document.getElementById('emp-rep-left-ear').value.trim();
      payload.rightEye = document.getElementById('emp-rep-right-eye').value.trim();
      payload.leftEye = document.getElementById('emp-rep-left-eye').value.trim();
    }

    try {
      const res = await fetchWithAuth('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Employee file & Checkup details successfully submitted!`, 'success');
        activeEmployeeNumber = employeeNumber;

        if (addReport) {
          localStorage.removeItem(STORAGE_KEYS.DRAFT + employeeNumber);
        }

        // Show view history button
        document.getElementById('btn-goto-history').style.display = 'inline-flex';
        
        // Reset form
        generalForm.reset();
        if (reportToggle) reportToggle.checked = false;
        if (reportSection) reportSection.style.display = 'none';

        // Switch to history search view
        setTimeout(() => {
          switchView('search-history');
          showEmployeeProfile(employeeNumber);
        }, 1500);
      } else {
        showToast(data.error || 'Failed to save details.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    }
  });

  // --- New Patient (Illness Visit) Handlers ---

  // Set auto visit date/time when view opens
  function updateVisitDateTime() {
    const el = document.getElementById('pat-visit-datetime');
    if (el) {
      const now = new Date();
      const formatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        '  ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      el.value = formatted;
    }
  }
  updateVisitDateTime();
  // Refresh every second
  setInterval(updateVisitDateTime, 1000);

  const patReportToggle = document.getElementById('pat-add-report-toggle');
  const patReportSection = document.getElementById('patient-report-section');
  if (patReportToggle && patReportSection) {
    patReportToggle.addEventListener('change', () => {
      patReportSection.style.display = patReportToggle.checked ? 'flex' : 'none';
      if (patReportToggle.checked) {
        document.getElementById('pat-rep-date').value = new Date().toISOString().split('T')[0];
        const empNum = document.getElementById('pat-number').value.trim().toUpperCase();
        if (empNum) {
          loadDraftIfExistsPatient(empNum);
        }
      }
    });
  }

  // Submit patient illness form
  const patientForm = document.getElementById('patient-illness-form');
  patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('pat-name').value.trim();
    const employeeNumber = document.getElementById('pat-number').value.trim().toUpperCase();
    const designation = document.getElementById('pat-designation').value.trim();
    const department = document.getElementById('pat-department') ? document.getElementById('pat-department').value.trim() : '';
    const category = document.getElementById('pat-category') ? document.getElementById('pat-category').value.trim() : '';
    const dob = document.getElementById('pat-dob') ? document.getElementById('pat-dob').value.trim() : '';
    const employmentType = document.getElementById('pat-employment-type') ? document.getElementById('pat-employment-type').value : '';
    const visitCategory = document.getElementById('pat-visit-category') ? document.getElementById('pat-visit-category').value : '';
    
    const workLocation = document.getElementById('pat-location').value.trim();
    const age = Number(document.getElementById('pat-age').value);
    const issue = document.getElementById('pat-issue').value.trim();
    const tabletsGiven = document.getElementById('pat-tablets').value.trim();
    const quantity = Number(document.getElementById('pat-qty').value || 0);
    const temperature = document.getElementById('pat-temp') ? document.getElementById('pat-temp').value.trim() : '';
    const firstAid = document.getElementById('pat-firstaid') ? document.getElementById('pat-firstaid').value : '';
    const attendedBy = document.getElementById('pat-attended-by').value.trim();
    const remark = document.getElementById('pat-remark').value.trim();
    
    // New Vitals
    const bpVal = document.getElementById('pat-bp') ? document.getElementById('pat-bp').value.trim() : '';
    const sugarVal = document.getElementById('pat-sugar') ? document.getElementById('pat-sugar').value.trim() : '';
    const pulseVal = document.getElementById('pat-pulse') ? document.getElementById('pat-pulse').value.trim() : '';

    if (!attendedBy) {
      showToast('Please enter the Doctor / Nurse name (Attended By).', 'error');
      document.getElementById('pat-attended-by').focus();
      return;
    }

    const payload = {
      name, employeeNumber, designation, department, employmentType, category, dob, workLocation, age,
      height: 0, weight: 0, 
      pulse: pulseVal ? Number(pulseVal) : 0, 
      bp: bpVal || 'N/A',
      sugar: sugarVal,
      issue, tabletsGiven, quantity,
      temperature, firstAid, visitCategory,
      attendedBy, remark,
      visitDateTime: new Date().toISOString()
    };

    // Pack optional report if toggle is checked
    const addReport = patReportToggle && patReportToggle.checked;
    if (addReport) {
      payload.addReport = true;
      payload.reportDate = document.getElementById('pat-rep-date').value;
      payload.htn = document.getElementById('pat-rep-htn').value;
      payload.dm = document.getElementById('pat-rep-dm').value;
      payload.rbs = document.getElementById('pat-rep-rbs').value.trim();
      payload.serumCreatinine = document.getElementById('pat-rep-creatinine').value.trim();
      payload.serumUrea = document.getElementById('pat-rep-urea').value.trim();
      payload.serumCholinesterase = document.getElementById('pat-rep-cholinesterase').value.trim();
      payload.serumCholesterol = document.getElementById('pat-rep-cholesterol').value.trim();
      payload.serumTriglycerides = document.getElementById('pat-rep-triglycerides').value.trim();
      payload.hdl = document.getElementById('pat-rep-hdl').value.trim();
      payload.ldl = document.getElementById('pat-rep-ldl').value.trim();
      payload.vldl = document.getElementById('pat-rep-vldl').value.trim();
      payload.totalLeucocytes = document.getElementById('pat-rep-wbc').value.trim();
      payload.erythrocyteCount = document.getElementById('pat-rep-rbccount').value.trim();
      payload.neutrophils = document.getElementById('pat-rep-neutrophils').value.trim();
      payload.lymphocytes = document.getElementById('pat-rep-lymphocytes').value.trim();
      payload.eosinophils = document.getElementById('pat-rep-eosinophils').value.trim();
      payload.monocytes = document.getElementById('pat-rep-monocytes').value.trim();
      payload.basophils = document.getElementById('pat-rep-basophils').value.trim();
      payload.esr = document.getElementById('pat-rep-esr').value.trim();
      payload.hb = document.getElementById('pat-rep-hb').value.trim();
      payload.plateletCount = document.getElementById('pat-rep-platelets').value.trim();
      payload.packedCellVolume = document.getElementById('pat-rep-pcv').value.trim();
      payload.mcv = document.getElementById('pat-rep-mcv').value.trim();
      payload.mch = document.getElementById('pat-rep-mch').value.trim();
      payload.mchc = document.getElementById('pat-rep-mchc').value.trim();
      payload.rcdw = document.getElementById('pat-rep-rcdw').value.trim();
      payload.rbcSmear = document.getElementById('pat-rep-rbcsmear').value.trim();
      payload.wbcSmear = document.getElementById('pat-rep-wbcsmear').value.trim();
      payload.plateletSmear = document.getElementById('pat-rep-plateletsmear').value.trim();
      payload.parasites = document.getElementById('pat-rep-parasites').value.trim();
      payload.specificGravity = document.getElementById('pat-rep-gravity').value.trim();
      payload.urinePh = document.getElementById('pat-rep-urineph').value.trim();
      payload.urineAcetone = document.getElementById('pat-rep-acetone').value.trim();
      payload.urineNitrites = document.getElementById('pat-rep-nitrites').value.trim();
      payload.ubs = document.getElementById('pat-rep-ubs').value.trim();
      payload.ubp = document.getElementById('pat-rep-ubp').value.trim();
      payload.urobilinogen = document.getElementById('pat-rep-urobilinogen').value.trim();
      payload.urineLeucocyte = document.getElementById('pat-rep-urineleucocyte').value.trim();
      payload.urineAlbumin = document.getElementById('pat-rep-urinealbumin').value.trim();
      payload.urineSugar = document.getElementById('pat-rep-urinesugar').value.trim();
      payload.uml = document.getElementById('pat-rep-uml').value.trim();
      payload.rbc = document.getElementById('pat-rep-urinerbc').value.trim();
      payload.ec = document.getElementById('pat-rep-urineec').value.trim();
      payload.casts = document.getElementById('pat-rep-casts').value.trim();
      payload.crystals = document.getElementById('pat-rep-crystals').value.trim();
      payload.xrayReport = document.getElementById('pat-rep-xray').value.trim();
      payload.rightEar = document.getElementById('pat-rep-right-ear').value.trim();
      payload.leftEar = document.getElementById('pat-rep-left-ear').value.trim();
      payload.rightEye = document.getElementById('pat-rep-right-eye').value.trim();
      payload.leftEye = document.getElementById('pat-rep-left-eye').value.trim();
    }

    try {
      const res = await fetchWithAuth('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Patient details and report submitted successfully!', 'success');
        if (addReport) {
          localStorage.removeItem(STORAGE_KEYS.DRAFT + 'pat_' + employeeNumber);
        }
        patientForm.reset();
        updateVisitDateTime(); // Reset datetime after form reset
        if (patReportToggle) patReportToggle.checked = false;
        if (patReportSection) patReportSection.style.display = 'none';
        document.getElementById('pat-autofill-status').textContent = '';

        setTimeout(() => {
          switchView('search-history');
          showEmployeeProfile(employeeNumber);
        }, 1500);
      } else {
        showToast(data.error || 'Failed to save patient details.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    }
  });

  // Auto-fill patient form fields when Employee ID is typed (debounced)
  const patNumberInput = document.getElementById('pat-number');
  const patAutofillStatus = document.getElementById('pat-autofill-status');
  let patAutofillTimer = null;
  if (patNumberInput) {
    patNumberInput.addEventListener('input', () => {
      clearTimeout(patAutofillTimer);
      const empNum = patNumberInput.value.trim().toUpperCase();
      if (!empNum || empNum.length < 3) {
        if (patAutofillStatus) patAutofillStatus.textContent = '';
        return;
      }
      if (patAutofillStatus) patAutofillStatus.textContent = '🔍 Searching...';
      patAutofillTimer = setTimeout(async () => {
        try {
          const res = await fetchWithAuth(`/api/employees/${empNum}/reports`);
          if (res.ok) {
            const data = await res.json();
            const emp = data.employee;
            document.getElementById('pat-name').value = emp.name || '';
            document.getElementById('pat-location').value = emp.workLocation || '';
            document.getElementById('pat-designation').value = emp.designation || '';
            if (document.getElementById('pat-department')) document.getElementById('pat-department').value = emp.department || '';
            if (document.getElementById('pat-category')) document.getElementById('pat-category').value = emp.category || '';
            if (document.getElementById('pat-dob')) document.getElementById('pat-dob').value = emp.dob || '';
            document.getElementById('pat-age').value = emp.age || '';
            if (patAutofillStatus) patAutofillStatus.textContent = '✅ Auto-filled';
            showToast(`Pre-filled details for ${emp.name} (${empNum})`, 'info');
          } else {
            if (patAutofillStatus) patAutofillStatus.textContent = '⚠️ Not found';
          }
        } catch (err) {
          if (patAutofillStatus) patAutofillStatus.textContent = '';
        }
      }, 600);
    });
  }

  // Auto-fill registration employee details when ID is typed
  const empNumberInput = document.getElementById('emp-number');
  if (empNumberInput) {
    empNumberInput.addEventListener('change', async () => {
      const empNum = empNumberInput.value.trim().toUpperCase();
      if (!empNum) return;
      try {
        const res = await fetchWithAuth(`/api/employees/${empNum}/reports`);
        if (res.ok) {
          const data = await res.json();
          const emp = data.employee;
          document.getElementById('emp-name').value = emp.name;
          document.getElementById('emp-location').value = emp.workLocation;
          document.getElementById('emp-designation').value = emp.designation;
          document.getElementById('emp-age').value = emp.age;
          document.getElementById('emp-height').value = emp.height || '';
          document.getElementById('emp-weight').value = emp.weight || '';
          document.getElementById('emp-pulse').value = emp.pulse || '';
          document.getElementById('emp-bp').value = emp.bp || '';
          showToast(`Pre-filled details for employee ${empNum}`, 'info');
        }
      } catch (err) {
        // Safe to ignore if new
      }
    });
  }

  // Setup Draft Auto-save for Embedded Test Reports
  setInterval(autoSaveDraft, 5000);
}

// Auto-save report details draft to localStorage
function autoSaveDraft() {
  // 1. Check employee registration view
  const viewEmp = document.getElementById('view-employee-form-view');
  if (viewEmp && viewEmp.style.display !== 'none') {
    const reportToggle = document.getElementById('emp-add-report-toggle');
    if (reportToggle && reportToggle.checked) {
      const empNum = document.getElementById('emp-number').value.trim().toUpperCase();
      if (empNum) {
        const fields = ['rep-date', 'rep-htn', 'rep-dm', 'rep-rbs', 'rep-creatinine', 'rep-urea', 'rep-cholinesterase', 
                        'rep-cholesterol', 'rep-triglycerides', 'rep-hdl', 'rep-ldl', 'rep-vldl', 'rep-wbc', 'rep-rbccount', 
                        'rep-neutrophils', 'rep-lymphocytes', 'rep-eosinophils', 'rep-monocytes', 'rep-basophils', 'rep-esr', 
                        'rep-hb', 'rep-platelets', 'rep-pcv', 'rep-mcv', 'rep-mch', 'rep-mchc', 'rep-rcdw', 'rep-rbcsmear', 
                        'rep-wbcsmear', 'rep-plateletsmear', 'rep-parasites', 'rep-gravity', 'rep-urineph', 'rep-acetone', 
                        'rep-nitrites', 'rep-ubs', 'rep-ubp', 'rep-urobilinogen', 'rep-urineleucocyte', 'rep-urinealbumin', 
                        'rep-urinesugar', 'rep-uml', 'rep-urinerbc', 'rep-urineec', 'rep-casts', 'rep-crystals', 'rep-xray', 
                        'rep-right-ear', 'rep-left-ear', 'rep-right-eye', 'rep-left-eye'];

        const draftData = {};
        fields.forEach(f => {
          const el = document.getElementById('emp-' + f);
          if (el) draftData[f] = el.value;
        });
        localStorage.setItem(STORAGE_KEYS.DRAFT + empNum, JSON.stringify(draftData));
      }
    }
    return;
  }

  // 2. Check patient view
  const viewPat = document.getElementById('view-patient-form-view');
  if (viewPat && viewPat.style.display !== 'none') {
    const reportToggle = document.getElementById('pat-add-report-toggle');
    if (reportToggle && reportToggle.checked) {
      const empNum = document.getElementById('pat-number').value.trim().toUpperCase();
      if (empNum) {
        const fields = ['rep-date', 'rep-htn', 'rep-dm', 'rep-rbs', 'rep-creatinine', 'rep-urea', 'rep-cholinesterase', 
                        'rep-cholesterol', 'rep-triglycerides', 'rep-hdl', 'rep-ldl', 'rep-vldl', 'rep-wbc', 'rep-rbccount', 
                        'rep-neutrophils', 'rep-lymphocytes', 'rep-eosinophils', 'rep-monocytes', 'rep-basophils', 'rep-esr', 
                        'rep-hb', 'rep-platelets', 'rep-pcv', 'rep-mcv', 'rep-mch', 'rep-mchc', 'rep-rcdw', 'rep-rbcsmear', 
                        'rep-wbcsmear', 'rep-plateletsmear', 'rep-parasites', 'rep-gravity', 'rep-urineph', 'rep-acetone', 
                        'rep-nitrites', 'rep-ubs', 'rep-ubp', 'rep-urobilinogen', 'rep-urineleucocyte', 'rep-urinealbumin', 
                        'rep-urinesugar', 'rep-uml', 'rep-urinerbc', 'rep-urineec', 'rep-casts', 'rep-crystals', 'rep-xray', 
                        'rep-right-ear', 'rep-left-ear', 'rep-right-eye', 'rep-left-eye'];

        const draftData = {};
        fields.forEach(f => {
          const el = document.getElementById('pat-' + f);
          if (el) draftData[f] = el.value;
        });
        localStorage.setItem(STORAGE_KEYS.DRAFT + 'pat_' + empNum, JSON.stringify(draftData));
      }
    }
  }
}

function loadDraftIfExistsPatient(empNum) {
  const draftStr = localStorage.getItem(STORAGE_KEYS.DRAFT + 'pat_' + empNum);
  if (!draftStr) return;

  const draft = JSON.parse(draftStr);
  Object.keys(draft).forEach(f => {
    const el = document.getElementById('pat-' + f);
    if (el) el.value = draft[f];
  });
  showToast('Restored patient report draft from auto-save.', 'info');
}

function loadDraftIfExistsCombined(empNum) {
  const draftStr = localStorage.getItem(STORAGE_KEYS.DRAFT + empNum);
  if (!draftStr) return;

  const draft = JSON.parse(draftStr);
  Object.keys(draft).forEach(f => {
    const el = document.getElementById('emp-' + f);
    if (el) el.value = draft[f];
  });
  showToast('Restored report draft from auto-save.', 'info');
}

function openReportForm(empNum) {
  switchView('employee-form-view');
  
  // Pre-fill details of existing employee
  fetchWithAuth(`/api/employees/${empNum}/reports`)
    .then(res => res.json())
    .then(data => {
      const emp = data.employee;
      document.getElementById('emp-name').value = emp.name;
      document.getElementById('emp-number').value = emp.employeeNumber;
      document.getElementById('emp-designation').value = emp.designation;
      document.getElementById('emp-location').value = emp.workLocation;
      document.getElementById('emp-age').value = emp.age;
      document.getElementById('emp-height').value = emp.height || '';
      document.getElementById('emp-weight').value = emp.weight || '';
      document.getElementById('emp-pulse').value = emp.pulse || '';
      document.getElementById('emp-bp').value = emp.bp || '';

      // Check report toggle and show section
      const reportToggle = document.getElementById('emp-add-report-toggle');
      const reportSection = document.getElementById('embedded-report-section');
      reportToggle.checked = true;
      reportSection.style.display = 'flex';

      // Reset report inputs
      document.getElementById('emp-rep-date').value = new Date().toISOString().split('T')[0];
      const reportFields = ['rep-htn', 'rep-dm', 'rep-rbs', 'rep-creatinine', 'rep-urea', 'rep-cholinesterase', 
                            'rep-cholesterol', 'rep-triglycerides', 'rep-hdl', 'rep-ldl', 'rep-vldl', 'rep-wbc', 'rep-rbccount', 
                            'rep-neutrophils', 'rep-lymphocytes', 'rep-eosinophils', 'rep-monocytes', 'rep-basophils', 'rep-esr', 
                            'rep-hb', 'rep-platelets', 'rep-pcv', 'rep-mcv', 'rep-mch', 'rep-mchc', 'rep-rcdw', 'rep-rbcsmear', 
                            'rep-wbcsmear', 'rep-plateletsmear', 'rep-parasites', 'rep-gravity', 'rep-urineph', 'rep-acetone', 
                            'rep-nitrites', 'rep-ubs', 'rep-ubp', 'rep-urobilinogen', 'rep-urineleucocyte', 'rep-urinealbumin', 
                            'rep-urinesugar', 'rep-uml', 'rep-urinerbc', 'rep-urineec', 'rep-casts', 'rep-crystals', 'rep-xray', 
                            'rep-right-ear', 'rep-left-ear', 'rep-right-eye', 'rep-left-eye'];
      reportFields.forEach(f => {
        const el = document.getElementById('emp-' + f);
        if (el) el.value = '';
      });

      loadDraftIfExistsCombined(empNum);
    })
    .catch(err => {
      showToast('Error fetching employee vitals.', 'error');
    });
}

function cancelReportEntry() {
  switchView('search-history');
}

// --- Search Records Module ---
function setupSearchHandlers() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('btn-search-trigger');

  searchBtn.addEventListener('click', () => {
    searchEmployees(searchInput.value.trim());
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchEmployees(searchInput.value.trim());
    }
  });
}

async function searchEmployees(query) {
  try {
    const res = await fetchWithAuth(`/api/employees/search?q=${encodeURIComponent(query)}`);
    const employees = await res.json();
    
    const resultsBody = document.getElementById('search-results-body');
    resultsBody.innerHTML = '';

    if (employees && employees.length > 0) {
      employees.forEach(emp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${emp.employeeNumber}</strong></td>
          <td>${emp.name}</td>
          <td>${emp.designation}</td>
          <td>${emp.workLocation}</td>
          <td>${emp.age}</td>
          <td><span class="role-tag operator">${emp.bp}</span></td>
          <td>
            <button class="btn btn-secondary btn-icon" onclick="showEmployeeProfile('${emp.employeeNumber}')" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;"><i class="fa-solid fa-folder-open"></i> File</button>
            <button class="btn btn-primary btn-icon" onclick="openReportForm('${emp.employeeNumber}')" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;"><i class="fa-solid fa-file-medical"></i> +Report</button>
          </td>
        `;
        resultsBody.appendChild(tr);
      });
    } else {
      resultsBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No records found. Create an employee details file or import data.</td></tr>';
    }
  } catch (err) {
    showToast('Failed to load search results.', 'error');
  }
}

// --- Profile View & History Modal ---
async function showEmployeeProfile(empNum) {
  try {
    const res = await fetchWithAuth(`/api/employees/${empNum}/reports`);
    if (!res.ok) throw new Error('Employee not found');
    const data = await res.json();

    const emp = data.employee;
    
    // Fill general profile info
    document.getElementById('prof-name').textContent = emp.name;
    document.getElementById('prof-number').textContent = emp.employeeNumber;
    document.getElementById('prof-designation').textContent = emp.designation;
    document.getElementById('prof-department').textContent = emp.department || '-';
    document.getElementById('prof-category').textContent = emp.category || '-';
    document.getElementById('prof-dob').textContent = emp.dob || '-';
    document.getElementById('prof-doj').textContent = emp.doj || '-';
    document.getElementById('prof-village').textContent = emp.village || '-';
    document.getElementById('prof-address').textContent = emp.presentAddress || '-';
    document.getElementById('prof-location').textContent = emp.workLocation;
    document.getElementById('prof-age').textContent = emp.age;
    document.getElementById('prof-height').textContent = emp.height;
    document.getElementById('prof-weight').textContent = emp.weight;
    document.getElementById('prof-bp').textContent = emp.bp;
    document.getElementById('prof-pulse').textContent = emp.pulse;

    let medText = 'None';
    if (emp.tabletsGiven) {
      medText = `${emp.tabletsGiven} (${emp.quantity})`;
    }
    document.getElementById('prof-meds').textContent = medText;

    // Reset report comparison arrays
    selectedReportsToCompare = [];
    document.getElementById('modal-btn-compare-reports').disabled = true;

    // Render suggestions history
    const suggBody = document.getElementById('profile-suggestions-history');
    if (suggBody) {
      suggBody.innerHTML = '';
      if (data.suggestions && data.suggestions.length > 0) {
        let totalAmount = 0;
        data.suggestions.forEach(sugg => {
          const dateStr = new Date(sugg.suggestedAt).toLocaleDateString();
          const tr = document.createElement('tr');
          const amount = sugg.amount || 0;
          totalAmount += amount;
          const statusBadge = sugg.status === 'Closed' ? '<span class="role-tag admin" style="background:#e0ffe0; color:#008000;">Closed</span>' : '<span class="role-tag admin" style="background:#fff3e0; color:#e65100;">Open</span>';
          const arogyasriText = sugg.arogyasri ? '<i class="fa-solid fa-check" style="color: green;"></i> Yes' : '-';
          
          tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${sugg.hospitalName}</strong></td>
            <td>${sugg.reason}</td>
            <td>${arogyasriText}</td>
            <td>${amount}</td>
            <td>${statusBadge}</td>
          `;
          suggBody.appendChild(tr);
        });
        
        const totalSpan = document.getElementById('profile-total-amount');
        if (totalSpan) totalSpan.textContent = totalAmount;
      } else {
        suggBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No hospital suggestions found.</td></tr>';
      }
    }

    // Render report history
    const historyBody = document.getElementById('profile-reports-history');
    historyBody.innerHTML = '';

    if (data.reports && data.reports.length > 0) {
      data.reports.forEach(rep => {
        const dateStr = new Date(rep.reportDate).toLocaleDateString();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" class="report-compare-chk" value="${rep._id}" style="width: 18px; height: 18px;"></td>
          <td><strong>${rep.reportNumber}</strong></td>
          <td>${dateStr}</td>
          <td>${rep.htn || 'Nil'}</td>
          <td>${rep.dm || 'Nil'}</td>
          <td>${rep.rbs || 'Nil'}</td>
          <td>
            <button class="btn btn-secondary" onclick="viewReportDetails('${rep._id}', '${empNum}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"><i class="fa-solid fa-eye"></i> View</button>
            <button class="btn btn-danger" onclick="deleteReport('${rep._id}', '${empNum}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
          </td>
        `;
        
        // Setup comparison selection listener
        const chk = tr.querySelector('.report-compare-chk');
        chk.addEventListener('change', () => {
          if (chk.checked) {
            selectedReportsToCompare.push(rep);
          } else {
            selectedReportsToCompare = selectedReportsToCompare.filter(r => r._id !== rep._id);
          }

          const compareBtn = document.getElementById('modal-btn-compare-reports');
          if (selectedReportsToCompare.length === 2) {
            compareBtn.disabled = false;
            compareBtn.classList.remove('btn-secondary');
            compareBtn.classList.add('btn-success');
          } else {
            compareBtn.disabled = true;
          }
        });

        historyBody.appendChild(tr);
      });
    } else {
      historyBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No historical checkup reports found.</td></tr>';
    }

    // Attach profile buttons
    const addRepBtn = document.getElementById('modal-btn-add-report');
    addRepBtn.onclick = () => {
      closeEmployeeModal();
      openReportForm(empNum);
    };

    const compareBtn = document.getElementById('modal-btn-compare-reports');
    compareBtn.onclick = () => {
      openReportsComparison();
    };

    // Render attachments
    const docsList = document.getElementById('profile-uploaded-docs');
    docsList.innerHTML = '';
    if (data.uploads && data.uploads.length > 0) {
      data.uploads.forEach(up => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '0.4rem 0.75rem';
        li.style.background = 'var(--bg-app)';
        li.style.borderRadius = 'var(--radius-sm)';
        let extraInfo = up.reportType === 'Yearly' ? '<span class="role-tag" style="background:#0ea5e9;color:white;margin-left:0.5rem;">Yearly Report</span>' : '';
        if (up.reportType === 'Hospital') extraInfo = `<span class="role-tag" style="background:#8b5cf6;color:white;margin-left:0.5rem;">Hospital: ${up.hospitalName}</span>`;
        
        li.innerHTML = `
          <span><i class="fa-solid fa-file-lines" style="color: var(--primary); margin-right: 0.5rem;"></i> ${up.fileName} ${extraInfo}</span>
          <a href="${up.filePath}" target="_blank" class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"><i class="fa-solid fa-download"></i> View File</a>
        `;
        docsList.appendChild(li);
      });
    } else {
      docsList.innerHTML = '<li style="font-size:0.85rem; color:var(--text-light); text-align:center;">No attached documents.</li>';
    }

    // Attachment Form setup
    const docForm = document.getElementById('modal-doc-upload-form');
    docForm.onsubmit = async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('modal-doc-file');
      if (fileInput.files.length === 0) return;

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('employeeNumber', empNum);

      try {
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          },
          body: formData
        });
        const upData = await upRes.json();
        if (upRes.ok && upData.success) {
          showToast('Document uploaded and attached successfully!', 'success');
          fileInput.value = '';
          showEmployeeProfile(empNum); // Refresh
        } else {
          showToast(upData.error || 'Upload failed.', 'error');
        }
      } catch (err) {
        showToast('Connection error during upload.', 'error');
      }
    };

    // Show modal
    document.getElementById('modal-employee-profile').classList.add('show');
  } catch (err) {
    showToast('Failed to load employee details.', 'error');
  }
}

function closeEmployeeModal() {
  document.getElementById('modal-employee-profile').classList.remove('show');
}

// Delete Report
async function deleteReport(reportId, empNum) {
  if (!confirm('Are you sure you want to delete this test report? This action cannot be undone.')) return;
  try {
    const res = await fetchWithAuth(`/api/reports/${reportId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Test report deleted.', 'success');
      showEmployeeProfile(empNum); // Refresh
    } else {
      showToast('Failed to delete report.', 'error');
    }
  } catch (err) {
    showToast('Connection error.', 'error');
  }
}

// --- Settings & Imports ---
function setupSettingsHandlers() {
  const dropZoneEmp = document.getElementById('import-drop-zone-employees');
  const fileInputEmp = document.getElementById('import-file-input-employees');
  const dropZonePat = document.getElementById('import-drop-zone-patients');
  const fileInputPat = document.getElementById('import-file-input-patients');

  const setupDropZone = (dropZone, fileInput) => {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = 'rgba(2, 132, 199, 0.05)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-input)';
      dropZone.style.background = 'rgba(2, 132, 199, 0.01)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-input)';
      dropZone.style.background = 'rgba(2, 132, 199, 0.01)';
      if (e.dataTransfer.files.length > 0) {
        processImportFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        processImportFile(e.target.files[0]);
      }
    });
  };

  setupDropZone(dropZoneEmp, fileInputEmp);
  setupDropZone(dropZonePat, fileInputPat);

  // Backup Trigger
  document.getElementById('btn-download-backup').addEventListener('click', async () => {
    try {
      const res = await fetchWithAuth('/api/backup');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ohc_db_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Database backup downloaded successfully.', 'success');
    } catch (err) {
      showToast('Failed to generate database backup.', 'error');
    }
  });

  // Restore Trigger
  const restoreInput = document.getElementById('restore-file-input');
  document.getElementById('btn-trigger-restore').addEventListener('click', () => {
    restoreInput.click();
  });

  restoreInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backupData = JSON.parse(evt.target.result);
        if (!confirm('WARNING: Restoring the database will overwrite all existing records. Do you wish to proceed?')) {
          restoreInput.value = '';
          return;
        }

        const res = await fetchWithAuth('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData)
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Database restored successfully!', 'success');
          loadDashboardData();
        } else {
          showToast(data.error || 'Restore failed.', 'error');
        }
      } catch (err) {
        showToast('Invalid backup JSON file.', 'error');
      }
      restoreInput.value = '';
    };
    reader.readAsText(file);
  });
}

// Parse Excel or CSV file with Batched Processing and Progress Bar
function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      // Reset and Show Progress UI
      const progContainer = document.getElementById('import-progress-container');
      const progBar = document.getElementById('import-progress-bar');
      const progText = document.getElementById('import-progress-percentage');
      const progStatus = document.getElementById('import-progress-status');
      
      if (progContainer) progContainer.style.display = 'block';
      if (progBar) progBar.style.width = '0%';
      if (progText) progText.textContent = '0%';
      if (progStatus) progStatus.textContent = 'Parsing File...';
      document.getElementById('import-summary-card').style.display = 'none';

      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        showToast('Uploaded spreadsheet is empty.', 'error');
        if (progStatus) progStatus.textContent = 'Failed: Empty File';
        return;
      }

      showToast(`Parsed ${rows.length} rows. Starting import...`, 'info');
      if (progStatus) progStatus.textContent = 'Importing Data...';

      // Batch processing variables
      const BATCH_SIZE = 50;
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let allErrors = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        try {
          const res = await fetchWithAuth('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: batch })
          });

          const result = await res.json();
          if (res.ok && result.success) {
            totalCreated += result.summary.created;
            totalUpdated += result.summary.updated;
            totalSkipped += result.summary.skipped;
            if (result.summary.errors && result.summary.errors.length > 0) {
              allErrors = allErrors.concat(result.summary.errors);
            }
          } else {
            allErrors.push(`Batch ${i/BATCH_SIZE + 1} failed: ${result.error}`);
          }
        } catch (err) {
          allErrors.push(`Batch ${i/BATCH_SIZE + 1} network error: ${err.message}`);
        }

        totalProcessed += batch.length;
        
        // Update Progress Bar
        const percent = Math.min(100, Math.round((totalProcessed / rows.length) * 100));
        if (progBar) progBar.style.width = percent + '%';
        if (progText) progText.textContent = percent + '%';
      }

      if (progStatus) progStatus.textContent = 'Import Completed';
      showToast('Bulk import completed!', 'success');
      
      // Show summary
      document.getElementById('import-summary-card').style.display = 'block';
      document.getElementById('import-total').textContent = rows.length;
      document.getElementById('import-created').textContent = totalCreated;
      document.getElementById('import-updated').textContent = totalUpdated;
      document.getElementById('import-skipped').textContent = totalSkipped;

      const errorsLog = document.getElementById('import-errors-log');
      errorsLog.innerHTML = '';
      if (allErrors.length > 0) {
        allErrors.forEach(err => {
          const div = document.createElement('div');
          div.textContent = err;
          errorsLog.appendChild(div);
        });
      } else {
        errorsLog.innerHTML = '<div style="color:var(--accent);">No validation or import errors.</div>';
      }

      // Hide progress container after a short delay
      setTimeout(() => {
        if (progContainer) progContainer.style.display = 'none';
      }, 5000);

    } catch (err) {
      console.error(err);
      showToast('Error parsing file. Ensure it is a valid Excel/CSV spreadsheet.', 'error');
      const progStatus = document.getElementById('import-progress-status');
      if (progStatus) progStatus.textContent = 'Failed: Parsing Error';
    }
  };
  reader.readAsArrayBuffer(file);
}

// --- Report Details Modal & Print/PDF ---
async function viewReportDetails(reportId, empNum) {
  try {
    const res = await fetchWithAuth(`/api/employees/${empNum}/reports`);
    const data = await res.json();
    const rep = data.reports.find(r => r._id === reportId);
    if (!rep) return;

    const emp = data.employee;
    const dateStr = new Date(rep.reportDate).toLocaleDateString();

    const container = document.getElementById('report-view-content');
    container.innerHTML = `
      <div style="border-bottom: 2px solid var(--primary); padding-bottom: 1rem; margin-bottom: 1.5rem; text-align: center;">
        <h2 style="color: var(--primary);"><i class="fa-solid fa-hospital-user"></i> Occupational Health Checkup Report</h2>
        <span style="font-size: 0.9rem; color: var(--text-muted);">Occupational Health Center (OHC)</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
        <div>
          <strong>Employee Name:</strong> ${emp.name}<br>
          <strong>Employee ID:</strong> ${emp.employeeNumber}<br>
          <strong>Designation:</strong> ${emp.designation}<br>
          <strong>Work Location:</strong> ${emp.workLocation}
        </div>
        <div style="text-align: right;">
          <strong>Report Number:</strong> ${rep.reportNumber}<br>
          <strong>Report Date:</strong> ${dateStr}<br>
          <strong>Age:</strong> ${emp.age} yrs<br>
          <strong>BP / Pulse:</strong> ${emp.bp} / ${emp.pulse} bpm
        </div>
      </div>

      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; margin-bottom: 0.75rem; color: var(--secondary); text-transform: uppercase; font-size: 0.95rem;">1. History & General Vitals</h3>
      <table class="data-table" style="margin-bottom: 1.5rem;">
        <tr><td style="width: 50%;">HTN (Hypertension)</td><td><strong>${rep.htn || 'Nil'}</strong></td></tr>
        <tr><td>DM (Diabetes Mellitus)</td><td><strong>${rep.dm || 'Nil'}</strong></td></tr>
        <tr><td>RBS (Random Blood Sugar)</td><td><strong>${rep.rbs || 'Nil'}</strong></td></tr>
      </table>

      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; margin-bottom: 0.75rem; color: var(--secondary); text-transform: uppercase; font-size: 0.95rem;">2. Renal Parameters</h3>
      <table class="data-table" style="margin-bottom: 1.5rem;">
        <tr><td style="width: 50%;">Serum Creatinine</td><td><strong>${rep.serumCreatinine || 'Nil'}</strong></td></tr>
        <tr><td>Serum Urea</td><td><strong>${rep.serumUrea || 'Nil'}</strong></td></tr>
        <tr><td>Serum Cholinesterase</td><td><strong>${rep.serumCholinesterase || 'Nil'}</strong></td></tr>
      </table>

      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; margin-bottom: 0.75rem; color: var(--secondary); text-transform: uppercase; font-size: 0.95rem;">3. Lipid Profile</h3>
      <table class="data-table" style="margin-bottom: 1.5rem;">
        <tr><td style="width: 50%;">Serum Cholesterol</td><td><strong>${rep.serumCholesterol || 'Nil'}</strong></td></tr>
        <tr><td>Serum Triglycerides</td><td><strong>${rep.serumTriglycerides || 'Nil'}</strong></td></tr>
        <tr><td>HDL</td><td><strong>${rep.hdl || 'Nil'}</strong></td></tr>
        <tr><td>LDL</td><td><strong>${rep.ldl || 'Nil'}</strong></td></tr>
        <tr><td>VLDL</td><td><strong>${rep.vldl || 'Nil'}</strong></td></tr>
      </table>

      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; margin-bottom: 0.75rem; color: var(--secondary); text-transform: uppercase; font-size: 0.95rem;">4. Complete Blood Picture (CBP)</h3>
      <table class="data-table" style="margin-bottom: 1.5rem;">
        <tr><td style="width: 50%;">Total Leucocytes (WBC)</td><td><strong>${rep.totalLeucocytes || 'Nil'}</strong></td></tr>
        <tr><td>Erythrocyte Count (RBC)</td><td><strong>${rep.erythrocyteCount || 'Nil'}</strong></td></tr>
        <tr><td>Neutrophils / Lymphocytes</td><td><strong>${rep.neutrophils || 'Nil'} / ${rep.lymphocytes || 'Nil'}</strong></td></tr>
        <tr><td>Eosinophils / Monocytes / Basophils</td><td><strong>${rep.eosinophils || 'Nil'} / ${rep.monocytes || 'Nil'} / ${rep.basophils || 'Nil'}</strong></td></tr>
        <tr><td>Hemoglobin (HB) / ESR</td><td><strong>${rep.hb || 'Nil'} / ${rep.esr || 'Nil'}</strong></td></tr>
        <tr><td>Platelet Count</td><td><strong>${rep.plateletCount || 'Nil'}</strong></td></tr>
        <tr><td>PCV / MCV / MCH / MCHC</td><td><strong>${rep.packedCellVolume || 'Nil'} / ${rep.mcv || 'Nil'} / ${rep.mch || 'Nil'} / ${rep.mchc || 'Nil'}</strong></td></tr>
        <tr><td>RBC Smear / WBC Smear / Platelet Smear</td><td><strong>${rep.rbcSmear || 'Nil'} / ${rep.wbcSmear || 'Nil'} / ${rep.plateletSmear || 'Nil'}</strong></td></tr>
      </table>

      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; margin-bottom: 0.75rem; color: var(--secondary); text-transform: uppercase; font-size: 0.95rem;">5. Complete Urine Examination (CUE)</h3>
      <table class="data-table" style="margin-bottom: 1.5rem;">
        <tr><td style="width: 50%;">Urine pH / Specific Gravity</td><td><strong>${rep.urinePh || 'Nil'} / ${rep.specificGravity || 'Nil'}</strong></td></tr>
        <tr><td>Urine Albumin / Sugar / Acetone</td><td><strong>${rep.urineAlbumin || 'Nil'} / ${rep.urineSugar || 'Nil'} / ${rep.urineAcetone || 'Nil'}</strong></td></tr>
        <tr><td>Urine Nitrites / Leucocytes</td><td><strong>${rep.urineNitrites || 'Nil'} / ${rep.urineLeucocyte || 'Nil'}</strong></td></tr>
        <tr><td>RBC / EC / Casts / Crystals</td><td><strong>${rep.rbc || 'Nil'} / ${rep.ec || 'Nil'} / ${rep.casts || 'Nil'} / ${rep.crystals || 'Nil'}</strong></td></tr>
      </table>

      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; margin-bottom: 0.75rem; color: var(--secondary); text-transform: uppercase; font-size: 0.95rem;">6. Audiometry & Eye & Radiography</h3>
      <table class="data-table">
        <tr><td style="width: 50%;">Radiograph (X-Ray)</td><td><strong>${rep.xrayReport || 'Nil'}</strong></td></tr>
        <tr><td>Audiometry (Right / Left Ear)</td><td><strong>${rep.rightEar || 'Nil'} / ${rep.leftEar || 'Nil'}</strong></td></tr>
        <tr><td>Vision (Right / Left Eye)</td><td><strong>${rep.rightEye || 'Nil'} / ${rep.leftEye || 'Nil'}</strong></td></tr>
      </table>
    `;

    document.getElementById('modal-report-details').classList.add('show');
  } catch (err) {
    showToast('Failed to fetch report details.', 'error');
  }
}

// Reports Comparison side by side
function openReportsComparison() {
  if (selectedReportsToCompare.length !== 2) return;

  const [rep1, rep2] = selectedReportsToCompare;
  const date1 = new Date(rep1.reportDate).toLocaleDateString();
  const date2 = new Date(rep2.reportDate).toLocaleDateString();

  const fields = [
    { label: 'Report Number', key: 'reportNumber' },
    { label: 'Report Date', key: 'reportDate', format: (v) => new Date(v).toLocaleDateString() },
    { label: 'HTN', key: 'htn' },
    { label: 'DM', key: 'dm' },
    { label: 'RBS', key: 'rbs' },
    { label: 'Serum Creatinine', key: 'serumCreatinine' },
    { label: 'Serum Urea', key: 'serumUrea' },
    { label: 'Serum Cholinesterase', key: 'serumCholinesterase' },
    { label: 'Serum Cholesterol', key: 'serumCholesterol' },
    { label: 'Serum Triglycerides', key: 'serumTriglycerides' },
    { label: 'HDL', key: 'hdl' },
    { label: 'LDL', key: 'ldl' },
    { label: 'VLDL', key: 'vldl' },
    { label: 'Total Leucocytes (WBC)', key: 'totalLeucocytes' },
    { label: 'Erythrocyte Count (RBC)', key: 'erythrocyteCount' },
    { label: 'Neutrophils', key: 'neutrophils' },
    { label: 'Lymphocytes', key: 'lymphocytes' },
    { label: 'Eosinophils', key: 'eosinophils' },
    { label: 'Monocytes', key: 'monocytes' },
    { label: 'Basophils', key: 'basophils' },
    { label: 'ESR', key: 'esr' },
    { label: 'Hemoglobin (HB)', key: 'hb' },
    { label: 'Platelet Count', key: 'plateletCount' },
    { label: 'Packed Cell Volume', key: 'packedCellVolume' },
    { label: 'MCV', key: 'mcv' },
    { label: 'MCH', key: 'mch' },
    { label: 'MCHC', key: 'mchc' },
    { label: 'RCDW', key: 'rcdw' },
    { label: 'RBC Smear', key: 'rbcSmear' },
    { label: 'WBC Smear', key: 'wbcSmear' },
    { label: 'Platelet Smear', key: 'plateletSmear' },
    { label: 'Parasites', key: 'parasites' },
    { label: 'Specific Gravity', key: 'specificGravity' },
    { label: 'Urine pH', key: 'urinePh' },
    { label: 'Urine Acetone', key: 'urineAcetone' },
    { label: 'Urine Nitrites', key: 'urineNitrites' },
    { label: 'UBS', key: 'ubs' },
    { label: 'UBP', key: 'ubp' },
    { label: 'Urobilinogen', key: 'urobilinogen' },
    { label: 'Urine Leucocyte', key: 'urineLeucocyte' },
    { label: 'Urine Albumin', key: 'urineAlbumin' },
    { label: 'Urine Sugar', key: 'urineSugar' },
    { label: 'UML', key: 'uml' },
    { label: 'RBC (Urine)', key: 'rbc' },
    { label: 'EC (Urine)', key: 'ec' },
    { label: 'Casts', key: 'casts' },
    { label: 'Crystals', key: 'crystals' },
    { label: 'Radiograph (X-Ray)', key: 'xrayReport' },
    { label: 'Right Ear Hearing', key: 'rightEar' },
    { label: 'Left Ear Hearing', key: 'leftEar' },
    { label: 'Right Eye Vision', key: 'rightEye' },
    { label: 'Left Eye Vision', key: 'leftEye' }
  ];

  let rowsHtml = '';
  fields.forEach(f => {
    let val1 = rep1[f.key] || '-';
    let val2 = rep2[f.key] || '-';
    
    if (f.format) {
      if (rep1[f.key]) val1 = f.format(rep1[f.key]);
      if (rep2[f.key]) val2 = f.format(rep2[f.key]);
    }

    const isDifferent = val1.trim() !== val2.trim();
    const rowClass = isDifferent ? 'diff-low' : '';

    rowsHtml += `
      <tr class="${rowClass}">
        <td><strong>${f.label}</strong></td>
        <td>${val1}</td>
        <td>${val2}</td>
        <td style="text-align: center;">${isDifferent ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>'}</td>
      </tr>
    `;
  });

  const container = document.getElementById('report-view-content');
  container.innerHTML = `
    <div style="border-bottom: 2px solid var(--accent); padding-bottom: 1rem; margin-bottom: 1.5rem; text-align: center;">
      <h2 style="color: var(--accent);"><i class="fa-solid fa-code-compare"></i> Side-by-Side Report Comparison</h2>
      <span style="font-size: 0.9rem; color: var(--text-muted);">Comparing checkups of ${date1} and ${date2}</span>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Checkup Parameters</th>
          <th>Report 1 (${date1})</th>
          <th>Report 2 (${date2})</th>
          <th style="width: 80px; text-align: center;">Discrepancy</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  document.getElementById('modal-report-details').classList.add('show');
}

function closeReportDetailsModal() {
  document.getElementById('modal-report-details').classList.remove('show');
}

// Print report
function printReport() {
  window.print();
}

// PDF Download
function downloadReportPdf() {
  const element = document.getElementById('print-pdf-area');
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `ohc_report_${Date.now()}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // Hide buttons during rendering
  const footerBtns = element.querySelector('.col-12');
  if (footerBtns) footerBtns.style.display = 'none';

  html2pdf().set(opt).from(element).save().then(() => {
    if (footerBtns) footerBtns.style.display = 'flex';
  });
}

// --- Setup Modal and Miscellaneous Listeners ---
function setupModalHandlers() {
  window.addEventListener('click', (e) => {
    const profileModal = document.getElementById('modal-employee-profile');
    const detailsModal = document.getElementById('modal-report-details');

    if (e.target === profileModal) {
      closeEmployeeModal();
    }
    if (e.target === detailsModal) {
      closeReportDetailsModal();
    }
  });
}

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
  const isInteractive = e.target.closest('a, button, select, input, textarea, .file-upload-zone, .menu-item, input[type="checkbox"]');
  if (isInteractive) {
    cursorDot.classList.add('hovered');
    cursorOutline.classList.add('hovered');
  } else {
    cursorDot.classList.remove('hovered');
    cursorOutline.classList.remove('hovered');
  }
});

// ==========================================
// PATIENT HISTORY MODULE
// ==========================================
let phIssuesChartInstance = null;
let phMedsChartInstance = null;

async function loadPatientHistory() {
  const input = document.getElementById('ph-search-input');
  const empNum = input.value.trim().toUpperCase();
  if (!empNum) {
    showToast('Please enter an Employee ID.', 'error');
    input.focus();
    return;
  }

  // Show loading state
  const btn = document.getElementById('ph-search-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';
  btn.disabled = true;

  // Hide all panels
  ['ph-employee-banner','ph-stats','ph-charts','ph-timeline','ph-no-data'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  try {
    const res = await fetchWithAuth(`/api/employees/${empNum}/reports`);
    if (!res.ok) {
      document.getElementById('ph-no-data').style.display = 'block';
      return;
    }

    const data = await res.json();
    const { employee: emp, reports, medicines } = data;

    if (!emp) {
      document.getElementById('ph-no-data').style.display = 'block';
      return;
    }

    // ---- Employee Banner ----
    document.getElementById('ph-emp-name').textContent = emp.name;
    document.getElementById('ph-emp-id').innerHTML = `<i class="fa-solid fa-id-badge"></i> ${emp.employeeNumber}`;
    document.getElementById('ph-emp-desig').innerHTML = `<i class="fa-solid fa-briefcase"></i> ${emp.designation}`;
    document.getElementById('ph-emp-location').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${emp.workLocation}`;
    document.getElementById('ph-emp-age').innerHTML = `<i class="fa-solid fa-calendar-days"></i> Age ${emp.age}`;
    document.getElementById('ph-employee-banner').style.display = 'block';

    // ---- Stats ----
    const totalVisits = medicines.length; // each medicine record = 1 visit
    const recentIssue = emp.issue || (medicines.length > 0 ? medicines[0].issue : '—');
    document.getElementById('ph-total-visits').textContent = totalVisits;
    document.getElementById('ph-total-tablets').textContent = medicines.length;
    document.getElementById('ph-total-reports').textContent = reports.length;
    document.getElementById('ph-recent-issue').textContent = recentIssue || '—';
    const statsEl = document.getElementById('ph-stats');
    statsEl.style.display = 'block';

    // ---- Issues Chart ----
    const issueMap = {};
    medicines.forEach(m => {
      if (m.issue) issueMap[m.issue] = (issueMap[m.issue] || 0) + 1;
    });
    if (emp.issue) issueMap[emp.issue] = (issueMap[emp.issue] || 0) + 1;
    const issueLabels = Object.keys(issueMap);
    const issueCounts = Object.values(issueMap);

    if (phIssuesChartInstance) phIssuesChartInstance.destroy();
    const issCtx = document.getElementById('ph-issues-chart').getContext('2d');
    phIssuesChartInstance = new Chart(issCtx, {
      type: 'bar',
      data: {
        labels: issueLabels.length > 0 ? issueLabels : ['No Issues Recorded'],
        datasets: [{
          label: 'Occurrences',
          data: issueCounts.length > 0 ? issueCounts : [0],
          backgroundColor: ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981'].slice(0, issueLabels.length || 1),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });

    // ---- Medicines Chart ----
    const medMap = {};
    medicines.forEach(m => {
      if (m.tabletsGiven) medMap[m.tabletsGiven] = (medMap[m.tabletsGiven] || 0) + (m.quantity || 1);
    });
    const medLabels = Object.keys(medMap);
    const medCounts = Object.values(medMap);

    if (phMedsChartInstance) phMedsChartInstance.destroy();
    const medCtx = document.getElementById('ph-meds-chart').getContext('2d');
    phMedsChartInstance = new Chart(medCtx, {
      type: 'doughnut',
      data: {
        labels: medLabels.length > 0 ? medLabels : ['No Medicines'],
        datasets: [{
          data: medCounts.length > 0 ? medCounts : [1],
          backgroundColor: ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }
        }
      }
    });

    document.getElementById('ph-charts').style.display = 'grid';

    // ---- Visit Timeline ----
    const timelineList = document.getElementById('ph-timeline-list');
    timelineList.innerHTML = '';

    // Merge medicines into timeline events
    const events = medicines.map(m => ({
      date: m.issuedDate,
      type: 'visit',
      issue: m.issue,
      tablets: m.tabletsGiven,
      qty: m.quantity
    }));

    // Add report events
    reports.forEach(r => {
      events.push({
        date: r.reportDate,
        type: 'report',
        reportNumber: r.reportNumber,
        htn: r.htn,
        dm: r.dm,
        rbs: r.rbs
      });
    });

    // Sort by date descending
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (events.length === 0) {
      timelineList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:2rem;">No visit or report history found.</div>';
    } else {
      events.forEach(ev => {
        const dateStr = new Date(ev.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        let html = '';
        if (ev.type === 'visit') {
          html = `
            <div style="display:flex;gap:1rem;align-items:flex-start;padding:0.9rem 1rem;background:var(--bg-secondary);border-radius:10px;border-left:4px solid #3b82f6;">
              <div style="width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.15);color:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fa-solid fa-stethoscope"></i>
              </div>
              <div style="flex:1;">
                <div style="font-weight:700;color:var(--text-primary);margin-bottom:0.2rem;">OHC Visit — ${ev.issue || 'General Checkup'}</div>
                <div style="font-size:0.85rem;color:var(--text-muted);">
                  <i class="fa-solid fa-pills"></i> ${ev.tablets || 'None'} &nbsp;|&nbsp;
                  <i class="fa-solid fa-hashtag"></i> Qty: ${ev.qty || 0}
                </div>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">${dateStr}</div>
            </div>`;
        } else {
          html = `
            <div style="display:flex;gap:1rem;align-items:flex-start;padding:0.9rem 1rem;background:var(--bg-secondary);border-radius:10px;border-left:4px solid #f59e0b;">
              <div style="width:36px;height:36px;border-radius:50%;background:rgba(245,158,11,0.15);color:#f59e0b;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fa-solid fa-file-medical"></i>
              </div>
              <div style="flex:1;">
                <div style="font-weight:700;color:var(--text-primary);margin-bottom:0.2rem;">Lab Report — ${ev.reportNumber || ''}</div>
                <div style="font-size:0.85rem;color:var(--text-muted);">
                  ${ev.htn ? 'HTN: ' + ev.htn : ''} ${ev.dm ? '| DM: ' + ev.dm : ''} ${ev.rbs ? '| RBS: ' + ev.rbs : ''}
                </div>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">${dateStr}</div>
            </div>`;
        }
        timelineList.insertAdjacentHTML('beforeend', html);
      });
    }

    document.getElementById('ph-timeline').style.display = 'block';
    document.getElementById('ph-clear-btn').style.display = 'inline-flex';

  } catch (err) {
    showToast('Error loading patient history: ' + err.message, 'error');
    document.getElementById('ph-no-data').style.display = 'block';
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-search"></i> Search History';
    btn.disabled = false;
  }
}

function clearPatientHistory() {
  document.getElementById('ph-search-input').value = '';
  ['ph-employee-banner','ph-stats','ph-charts','ph-timeline','ph-no-data'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('ph-clear-btn').style.display = 'none';
  if (phIssuesChartInstance) { phIssuesChartInstance.destroy(); phIssuesChartInstance = null; }
  if (phMedsChartInstance) { phMedsChartInstance.destroy(); phMedsChartInstance = null; }
}

// Allow Enter key in Patient History search
document.addEventListener('DOMContentLoaded', () => {
  const phInput = document.getElementById('ph-search-input');
  if (phInput) {
    phInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') loadPatientHistory();
    });
  }

  // Database Connection Status Checker
  async function checkDbStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      const dot = document.getElementById('db-status-dot');
      const text = document.getElementById('db-status-text');
      if (data.connected) {
        dot.style.backgroundColor = '#10b981'; // Green
        text.textContent = 'Connected';
      } else {
        dot.style.backgroundColor = '#ef4444'; // Red
        text.textContent = 'Disconnected';
      }
    } catch (err) {
      const dot = document.getElementById('db-status-dot');
      const text = document.getElementById('db-status-text');
      if (dot) dot.style.backgroundColor = '#ef4444'; // Red
      if (text) text.textContent = 'Disconnected';
    }
  }

  // Initial check and set interval
  checkDbStatus();
  setInterval(checkDbStatus, 5000);
});


// --- Global Issue History & Excel Export ---
let currentIssueHistoryData = [];

async function loadIssueHistory() {
  const tbody = document.getElementById('issue-history-body');
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</td></tr>';
  
  const fromDate = document.getElementById('ih-from-date') ? document.getElementById('ih-from-date').value : '';
  const toDate = document.getElementById('ih-to-date') ? document.getElementById('ih-to-date').value : '';
  let query = '';
  if (fromDate || toDate) query = `?from=${fromDate}&to=${toDate}`;

  try {
    const res = await fetchWithAuth('/api/issues/history' + query);
    if (!res.ok) throw new Error('Failed to fetch issue history');
    const issues = await res.json();
    currentIssueHistoryData = issues; // store for excel export
    
    tbody.innerHTML = '';
    
    if (issues.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--text-muted);">No issue records found.</td></tr>';
      return;
    }
    
    issues.forEach(issue => {
      const emp = issue.employeeId;
      const tr = document.createElement('tr');
      const dateStr = new Date(issue.issuedDate).toLocaleString();
      
      // Backward compatibility: If emp is an object, it's populated. If not, it means employee was not found.
      const empNo = emp && emp.employeeNumber ? emp.employeeNumber : 'N/A';
      const empName = emp && emp.name ? emp.name : 'Employee Not Found';
      const empDesig = emp && emp.designation ? emp.designation : '-';
      const empLoc = emp && emp.workLocation ? emp.workLocation : '-';
      
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${empNo}</strong></td>
        <td>${empName}</td>
        <td>${empDesig}</td>
        <td>${empLoc}</td>
        <td><span class="role-tag admin">${issue.issue}</span></td>
        <td>${issue.tabletsGiven || '-'}</td>
        <td><span style="font-weight:600;">${issue.quantity || '-'}</span></td>
        <td>${issue.temperature || '-'}</td>
        <td>${issue.firstAid || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    // Populate select dropdown filters dynamically
    const designations = new Set();
    const locations = new Set();
    const uniqueIssues = new Set();

    issues.forEach(issue => {
      const emp = issue.employeeId;
      if (emp && emp.designation) designations.add(emp.designation);
      if (emp && emp.workLocation) locations.add(emp.workLocation);
      if (issue.issue) uniqueIssues.add(issue.issue);
    });

    const desigSelect = document.getElementById('ih-filter-designation');
    const locSelect = document.getElementById('ih-filter-location');
    const issueSelect = document.getElementById('ih-filter-issue');

    if (desigSelect) desigSelect.innerHTML = '<option value="">All</option>' + Array.from(designations).sort().map(d => `<option value="${d}">${d}</option>`).join('');
    if (locSelect) locSelect.innerHTML = '<option value="">All</option>' + Array.from(locations).sort().map(l => `<option value="${l}">${l}</option>`).join('');
    if (issueSelect) issueSelect.innerHTML = '<option value="">All</option>' + Array.from(uniqueIssues).sort().map(i => `<option value="${i}">${i}</option>`).join('');

  } catch (err) {
    showToast(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--danger);">Error loading history</td></tr>';
  }
}

// Function to filter the Issue History table dynamically
function filterIssueHistoryTable(columnIndex) {
  const table = document.getElementById('issue-history-table');
  const filterRow = table.getElementsByClassName('filter-row')[0];
  const inputs = filterRow.querySelectorAll('.input-ctrl');
  
  // Get all filter values in an array
  const filterValues = Array.from(inputs).map(input => input.value.toLowerCase());
  
  const tbody = document.getElementById('issue-history-body');
  const tr = tbody.getElementsByTagName('tr');
  
  // Skip filtering if it's the empty state/loading state
  if (tr.length === 1 && tr[0].getElementsByTagName('td')[0].colSpan > 1) return;
  
  for (let i = 0; i < tr.length; i++) {
    let rowMatches = true;
    const tds = tr[i].getElementsByTagName('td');
    
    for (let j = 0; j < filterValues.length; j++) {
      if (filterValues[j] && tds[j]) {
        const cellText = tds[j].textContent || tds[j].innerText;
        if (cellText.toLowerCase().indexOf(filterValues[j]) === -1) {
          rowMatches = false;
          break;
        }
      }
    }
    
    if (rowMatches) {
      tr[i].style.display = "";
    } else {
      tr[i].style.display = "none";
    }
  }
}

function exportIssueHistoryExcel() {
  if (!currentIssueHistoryData || currentIssueHistoryData.length === 0) {
    showToast('No data available to export.', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-export-issues');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
  btn.disabled = true;
  
  try {
    const rows = currentIssueHistoryData.map(issue => {
      const emp = issue.employeeId;
      return {
        'Employee Number': emp && emp.employeeNumber ? emp.employeeNumber : 'N/A',
        'Employee Name': emp && emp.name ? emp.name : 'Employee Not Found',
        'Designation': emp && emp.designation ? emp.designation : '-',
        'Work Location': emp && emp.workLocation ? emp.workLocation : '-',
        'Issue': issue.issue,
        'Tablets Given': issue.tabletsGiven || '',
        'Quantity': issue.quantity || 0,
        'Temperature': issue.temperature || '',
        'First Aid': issue.firstAid || '',
        'Issued Date': new Date(issue.issuedDate).toLocaleString(),
        'Entered By': issue.operatorName || issue.operatorId || 'Unknown'
      };
    });
    
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 15 }, // Emp No
      { wch: 25 }, // Name
      { wch: 20 }, // Desig
      { wch: 15 }, // Loc
      { wch: 25 }, // Issue
      { wch: 20 }, // Tablets
      { wch: 10 }, // Qty
      { wch: 20 }  // Date
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Issue History');
    
    XLSX.writeFile(workbook, 'Issue_History_Export.xlsx');
    showToast('Excel exported successfully!', 'success');
  } catch (err) {
    showToast('Failed to export Excel: ' + err.message, 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// --- Yearly & Hospital Report Submission Handlers ---
document.addEventListener('DOMContentLoaded', () => {
  async function fetchEmpName(empId, nameInputId) {
    if (!empId) {
      document.getElementById(nameInputId).value = '';
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/employees/search?q=${empId}`);
      const data = await res.json();
      const match = data.find(e => e.employeeNumber.toUpperCase() === empId.toUpperCase());
      if (match) {
        document.getElementById(nameInputId).value = match.name;
      } else {
        document.getElementById(nameInputId).value = 'Not Found';
      }
    } catch (err) {
      document.getElementById(nameInputId).value = 'Error fetching';
    }
  }

  const yrEmpInput = document.getElementById('yr-emp-id');
  if (yrEmpInput) {
    yrEmpInput.addEventListener('blur', (e) => fetchEmpName(e.target.value.trim(), 'yr-emp-name'));
  }
  const hrEmpInput = document.getElementById('hr-emp-id');
  if (hrEmpInput) {
    hrEmpInput.addEventListener('blur', async (e) => {
      const empNum = e.target.value.trim();
      await fetchEmpName(empNum, 'hr-emp-name');
      
      if (!empNum) return;
      try {
        const res = await fetchWithAuth(`/api/hospital-suggestions/open/${empNum}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.suggestion) {
            document.getElementById('hr-hospital-name').value = data.suggestion.hospitalName;
            if (data.suggestion.amount) document.getElementById('hr-amount').value = data.suggestion.amount;
            document.getElementById('hr-suggestion-id').value = data.suggestion._id;
            showToast('Warning: Unclosed hospital case found! Resuming previous session data.', 'warning');
          } else {
            // clear out if no suggestion
            document.getElementById('hr-hospital-name').value = "";
            document.getElementById('hr-amount').value = "";
            document.getElementById('hr-suggestion-id').value = "";
          }
        }
      } catch (err) {
        console.error('Error fetching open hospital cases:', err);
      }
    });
  }
  const hsEmpInput = document.getElementById('hs-emp-id');
  if (hsEmpInput) {
    hsEmpInput.addEventListener('blur', (e) => fetchEmpName(e.target.value.trim(), 'hs-emp-name'));
  }

  // --- Hospital Report Tab Toggle ---
  const btnSuggest = document.getElementById('btn-show-suggest');
  const btnUpload = document.getElementById('btn-show-upload');
  const secSuggest = document.getElementById('section-suggest-hospital');
  const secUpload = document.getElementById('section-upload-hospital');

  if (btnSuggest && btnUpload) {
    btnSuggest.addEventListener('click', () => {
      secSuggest.style.display = 'block';
      secUpload.style.display = 'none';
      btnSuggest.classList.replace('btn-secondary', 'btn-primary');
      btnUpload.classList.replace('btn-primary', 'btn-secondary');
    });
    btnUpload.addEventListener('click', () => {
      secSuggest.style.display = 'none';
      secUpload.style.display = 'block';
      btnUpload.classList.replace('btn-secondary', 'btn-primary');
      btnSuggest.classList.replace('btn-primary', 'btn-secondary');
    });
  }
  const yrForm = document.getElementById('yearly-report-form');
  if (yrForm) {
    yrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = document.getElementById('yr-emp-id').value.trim().toUpperCase();
      const fileInput = document.getElementById('yr-file');
      if (!empId || !fileInput.files.length) return;

      const btn = document.getElementById('yr-submit-btn');
      const origText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
      btn.disabled = true;

      const formData = new FormData();
      formData.append('employeeNumber', empId);
      formData.append('reportType', 'Yearly');
      formData.append('file', fileInput.files[0]);

      try {
        const res = await fetchWithAuth('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Yearly report uploaded successfully!', 'success');
        yrForm.reset();
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
      } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
      }
    });
  }

  const hsForm = document.getElementById('hospital-suggest-form');
  if (hsForm) {
    hsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = document.getElementById('hs-emp-id').value.trim().toUpperCase();
      const hospitalName = document.getElementById('hs-hospital-name').value;
      const reason = document.getElementById('hs-reason').value.trim();
      const arogyasri = document.getElementById('hs-arogyasri') ? document.getElementById('hs-arogyasri').checked : false;
      
      if (!empId || !hospitalName || !reason) return;

      const btn = document.getElementById('hs-submit-btn');
      const origText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      btn.disabled = true;

      try {
        const res = await fetchWithAuth('/api/hospital-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeNumber: empId, hospitalName, reason, arogyasri })
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save suggestion');
        }

        showToast('Hospital Suggestion saved successfully!', 'success');
        hsForm.reset();
      } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
      } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
      }
    });
  }

  const hrForm = document.getElementById('hospital-report-form');
  if (hrForm) {
    hrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = document.getElementById('hr-emp-id').value.trim().toUpperCase();
      const hospitalName = document.getElementById('hr-hospital-name').value.trim();
      const fileInput = document.getElementById('hr-file');
      const amount = document.getElementById('hr-amount') ? document.getElementById('hr-amount').value : '';
      const closeCase = document.getElementById('hr-close-case') ? document.getElementById('hr-close-case').checked : false;
      const suggestionId = document.getElementById('hr-suggestion-id') ? document.getElementById('hr-suggestion-id').value : '';
      
      if (!empId || !hospitalName || !fileInput.files.length) return;

      const btn = document.getElementById('hr-submit-btn');
      const origText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
      btn.disabled = true;

      const formData = new FormData();
      formData.append('employeeNumber', empId);
      formData.append('reportType', 'Hospital');
      formData.append('hospitalName', hospitalName);
      if (amount) formData.append('amount', amount);
      formData.append('closeCase', closeCase);
      if (suggestionId) formData.append('suggestionId', suggestionId);
      formData.append('file', fileInput.files[0]);

      try {
        const res = await fetchWithAuth('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Hospital report uploaded successfully!', 'success');
        hrForm.reset();
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
      } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
      }
    });
  }
});

// --- Dashboard Vitals Filter ---
async function filterEmployeesByVitals() {
  const tbody = document.getElementById('vitals-filter-results');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</td></tr>';

  const bpMin = document.getElementById('filter-bp-min').value;
  const bpMax = document.getElementById('filter-bp-max').value;
  const sugarMin = document.getElementById('filter-sugar-min').value;
  const sugarMax = document.getElementById('filter-sugar-max').value;
  const pulseMin = document.getElementById('filter-pulse-min').value;
  const pulseMax = document.getElementById('filter-pulse-max').value;

  const query = new URLSearchParams({ bpMin, bpMax, sugarMin, sugarMax, pulseMin, pulseMax }).toString();

  try {
    const res = await fetchWithAuth('/api/employees/filter-vitals?' + query);
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No employees found matching these criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(emp => `
      <tr>
        <td style="font-weight: 600;">${emp.employeeNumber}</td>
        <td>${emp.name}</td>
        <td>${emp.designation}</td>
        <td>${emp.bp || 'N/A'}</td>
        <td>${emp.sugar || 'N/A'}</td>
        <td>${emp.pulse || 'N/A'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Search failed: ' + err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--danger);">Search Error</td></tr>';
  }
}

// --- View by Hospital Logic ---
let allHospitalSuggestions = [];

document.addEventListener('DOMContentLoaded', () => {
  const btnSearchEmp = document.getElementById('btn-show-search-emp');
  const btnSearchHosp = document.getElementById('btn-show-search-hosp');
  const secSearchEmp = document.getElementById('section-search-emp');
  const secSearchHosp = document.getElementById('section-search-hosp');
  const hospSelect = document.getElementById('hosp-filter-select');

  if (btnSearchEmp && btnSearchHosp) {
    btnSearchEmp.addEventListener('click', () => {
      secSearchEmp.style.display = 'block';
      secSearchHosp.style.display = 'none';
      btnSearchEmp.classList.replace('btn-secondary', 'btn-primary');
      btnSearchHosp.classList.replace('btn-primary', 'btn-secondary');
    });

    btnSearchHosp.addEventListener('click', () => {
      secSearchEmp.style.display = 'none';
      secSearchHosp.style.display = 'block';
      btnSearchHosp.classList.replace('btn-secondary', 'btn-primary');
      btnSearchEmp.classList.replace('btn-primary', 'btn-secondary');
      loadAllHospitalSuggestions(); // Fetch when tab is clicked
    });
  }

  if (hospSelect) {
    hospSelect.addEventListener('change', renderHospitalSuggestionsTable);
  }
});

async function loadAllHospitalSuggestions() {
  try {
    const res = await fetchWithAuth('/api/hospital-suggestions/all');
    if (!res.ok) throw new Error('Failed to load hospital data');
    allHospitalSuggestions = await res.json();
    
    // Extract unique hospitals
    const hospitals = [...new Set(allHospitalSuggestions.map(s => s.hospitalName))];
    
    const hospSelect = document.getElementById('hosp-filter-select');
    const currentVal = hospSelect.value;
    
    hospSelect.innerHTML = '<option value="">Select a hospital to view patients...</option>';
    hospitals.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      hospSelect.appendChild(opt);
    });
    
    // restore selection if possible
    if (hospitals.includes(currentVal)) {
      hospSelect.value = currentVal;
    }
    
    renderHospitalSuggestionsTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderHospitalSuggestionsTable() {
  const selectedHosp = document.getElementById('hosp-filter-select').value;
  const tbody = document.getElementById('hosp-filter-results');
  tbody.innerHTML = '';
  
  if (!selectedHosp) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Please select a hospital above.</td></tr>';
    return;
  }
  
  const filtered = allHospitalSuggestions.filter(s => s.hospitalName === selectedHosp);
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No suggestions found for this hospital.</td></tr>';
    return;
  }
  
  filtered.forEach(sugg => {
    const dateStr = new Date(sugg.suggestedAt).toLocaleDateString();
    const emp = sugg.employeeId || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td style="font-weight: 600;">${emp.employeeNumber || 'Unknown'}</td>
      <td>${emp.name || 'Unknown'}</td>
      <td>${sugg.reason}</td>
    `;
    tbody.appendChild(tr);
  });
}

