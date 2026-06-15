// ===== SECURITY MODULE =====
// Prevents multiple accounts per user (device fingerprinting + email binding)

const SECURITY_CONFIG = {
  MAX_ACCOUNTS_PER_DEVICE: 1,
  SESSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
  TOKEN_REFRESH_INTERVAL: 60 * 60 * 1000 // 1 hour
};

// Generate device fingerprint
async function generateDeviceFingerprint() {
  const components = [
    navigator.userAgent,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
    navigator.deviceMemory || 0,
    // Canvas fingerprinting
    await getCanvasFingerprint(),
    // WebGL fingerprinting
    await getWebGLFingerprint()
  ];
  
  const fingerprintString = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getCanvasFingerprint() {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f00';
      ctx.fillRect(0, 0, 50, 50);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(50, 0, 50, 50);
      ctx.fillStyle = '#00f';
      ctx.fillRect(100, 0, 50, 50);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText('Exalyte', 10, 30);
      resolve(canvas.toDataURL());
    } catch (e) {
      resolve('canvas-error');
    }
  });
}

async function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'webgl-not-supported';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return `${vendor}|${renderer}`;
    }
    return 'webgl-no-debug';
  } catch (e) {
    return 'webgl-error';
  }
}

// Store device fingerprint on signup
async function registerDeviceFingerprint(email) {
  const fingerprint = await generateDeviceFingerprint();
  const existing = localStorage.getItem('registered_fingerprints');
  let fingerprints = existing ? JSON.parse(existing) : {};
  
  if (!fingerprints[fingerprint]) {
    fingerprints[fingerprint] = {
      email: email,
      registeredAt: Date.now(),
      lastSeen: Date.now()
    };
  } else {
    fingerprints[fingerprint].lastSeen = Date.now();
  }
  
  localStorage.setItem('registered_fingerprints', JSON.stringify(fingerprints));
  return fingerprint;
}

// Check if device already has an account
async function checkDeviceHasAccount() {
  const fingerprint = await generateDeviceFingerprint();
  const existing = localStorage.getItem('registered_fingerprints');
  if (!existing) return false;
  
  const fingerprints = JSON.parse(existing);
  return !!fingerprints[fingerprint];
}

// Validate no multiple accounts on signup
async function validateNoMultipleAccounts(email) {
  const fingerprint = await generateDeviceFingerprint();
  const existing = localStorage.getItem('registered_fingerprints');
  
  if (existing) {
    const fingerprints = JSON.parse(existing);
    // If this fingerprint already has an account with a DIFFERENT email
    if (fingerprints[fingerprint] && fingerprints[fingerprint].email !== email) {
      return {
        valid: false,
        error: 'Multiple accounts are not permitted on this device. Please use your existing account.'
      };
    }
  }
  
  return { valid: true };
}

// Secure token storage (httpOnly equivalent for frontend)
function setSecureToken(token) {
  // Store with expiration
  const tokenData = {
    token: token,
    expiresAt: Date.now() + SECURITY_CONFIG.SESSION_DURATION
  };
  localStorage.setItem('secure_token', JSON.stringify(tokenData));
}

function getSecureToken() {
  const tokenDataStr = localStorage.getItem('secure_token');
  if (!tokenDataStr) return null;
  
  try {
    const tokenData = JSON.parse(tokenDataStr);
    if (Date.now() > tokenData.expiresAt) {
      localStorage.removeItem('secure_token');
      localStorage.removeItem('secure_user');
      return null;
    }
    return tokenData.token;
  } catch {
    return null;
  }
}

function setSecureUser(user) {
  const userData = {
    user: user,
    expiresAt: Date.now() + SECURITY_CONFIG.SESSION_DURATION
  };
  localStorage.setItem('secure_user', JSON.stringify(userData));
}

function getSecureUser() {
  const userDataStr = localStorage.getItem('secure_user');
  if (!userDataStr) return null;
  
  try {
    const userData = JSON.parse(userDataStr);
    if (Date.now() > userData.expiresAt) {
      localStorage.removeItem('secure_user');
      localStorage.removeItem('secure_token');
      return null;
    }
    return userData.user;
  } catch {
    return null;
  }
}

function clearSecureSession() {
  localStorage.removeItem('secure_token');
  localStorage.removeItem('secure_user');
  // Keep fingerprint data to prevent re-registration
}

// Sanitize input (XSS protection)
function sanitizeInput(str) {
  if (!str) return '';
  return str.replace(/[&<>/\\]/g, function(match) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '/': '&#x2F;',
      '\\': '&#x5C;'
    };
    return escapeMap[match];
  });
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// CSRF protection (add token to all requests)
function getCSRFToken() {
  let token = localStorage.getItem('csrf_token');
  if (!token) {
    token = generateCSRFToken();
    localStorage.setItem('csrf_token', token);
  }
  return token;
}

function generateCSRFToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting for API calls
class RateLimiter {
  constructor(limit = 10, window = 60000) {
    this.limit = limit;
    this.window = window;
    this.requests = [];
  }
  
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.window);
    if (this.requests.length >= this.limit) {
      return false;
    }
    this.requests.push(now);
    return true;
  }
}

const apiRateLimiter = new RateLimiter(30, 60000);

// Secure fetch wrapper
async function secureFetch(endpoint, options = {}) {
  // Rate limiting check
  if (!apiRateLimiter.canMakeRequest()) {
    return { error: 'Too many requests. Please slow down.' };
  }
  
  const token = getSecureToken();
  const csrfToken = getCSRFToken();
  
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'same-origin'
    });
    
    if (response.status === 401) {
      clearSecureSession();
      window.location.href = '/login.html';
      return { error: 'Session expired' };
    }
    
    const data = await response.json();
    return { ...data, _status: response.status };
  } catch (error) {
    console.error('Fetch error:', error);
    return { error: 'Network error. Please try again.' };
  }
}

// Check if user is logged in
function isLoggedIn() {
  return !!getSecureToken() && !!getSecureUser();
}

// Get current user
function getCurrentUser() {
  const user = getSecureUser();
  if (user && user.is_admin === undefined) {
    // Ensure boolean
    user.is_admin = user.is_admin === 1 || user.is_admin === true;
  }
  return user;
}

// Logout with cleanup
function logout() {
  clearSecureSession();
  window.location.href = '/';
}

// Initialize security on page load
document.addEventListener('DOMContentLoaded', () => {
  // Add CSRF token to all forms
  document.querySelectorAll('form').forEach(form => {
    if (!form.querySelector('input[name="csrf_token"]')) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'csrf_token';
      input.value = getCSRFToken();
      form.appendChild(input);
    }
  });
  
  // Prevent right-click on sensitive pages (optional)
  if (window.location.pathname.includes('/exam.html')) {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
  }
  
  // Warn before leaving exam
  if (window.location.pathname.includes('/exam.html')) {
    window.addEventListener('beforeunload', (e) => {
      if (!window.examSubmitted) {
        e.preventDefault();
        e.returnValue = 'You have not submitted your exam. Are you sure you want to leave?';
      }
    });
  }
});
