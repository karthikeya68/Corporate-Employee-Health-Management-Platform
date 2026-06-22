// public/login.js

const STORAGE_KEYS = {
  TOKEN: 'ohc_token',
  OPERATOR: 'ohc_operator'
};



// DOM Elements
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPwdInput = document.getElementById('login-pwd');

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

// Handle Login Submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const employeeIdOrEmail = loginUsername.value.trim();
  const password = loginPwdInput.value;
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employeeIdOrEmail,
        password
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Store token and details in localStorage
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.OPERATOR, JSON.stringify(data.operator));
      
      showToast("Login successful! Loading dashboard...", "success");
      setTimeout(() => {
        window.location.href = 'operator.html';
      }, 1000);
    } else {
      showToast(data.error || "Login failed.", "error");
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast("Server connection error during login.", "error");
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
