// public/register.js

const loginLink = document.getElementById('login-link');
const currentHost = window.location.hostname;
loginLink.href = `http://${currentHost}:9012/login.html`;

// DOM Elements
const registerForm = document.getElementById('register-form');
const regName = document.getElementById('reg-name');
const regEmpId = document.getElementById('reg-empid');
const regMobile = document.getElementById('reg-mobile');
const regEmail = document.getElementById('reg-email');
const regPwd = document.getElementById('reg-pwd');
const regConfPwd = document.getElementById('reg-confpwd');

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

// Handle Register Submit
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fullName = regName.value.trim();
  const employeeId = regEmpId.value.trim().toUpperCase();
  const mobile = regMobile.value.trim();
  const email = regEmail.value.trim().toLowerCase();
  const password = regPwd.value;
  const confirmPassword = regConfPwd.value;

  if (password !== confirmPassword) {
    showToast("Passwords do not match.", "error");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.", "error");
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fullName,
        employeeId,
        mobile,
        email,
        password,
        confirmPassword
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast("Registration successful! Redirecting to Login Terminal...", "success");
      registerForm.reset();
      setTimeout(() => {
        window.location.href = `http://${currentHost}:9012/login.html`;
      }, 2000);
    } else {
      showToast(data.error || "Failed to register operator.", "error");
    }
  } catch (err) {
    console.error('Registration error:', err);
    showToast("Server connection error during registration.", "error");
  }
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
  const isInteractive = e.target.closest('a, button, select, input, textarea');
  if (isInteractive) {
    cursorDot.classList.add('hovered');
    cursorOutline.classList.add('hovered');
  } else {
    cursorDot.classList.remove('hovered');
    cursorOutline.classList.remove('hovered');
  }
});
