// ===== COMMON UI FUNCTIONS =====

// Update header based on auth state
function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const userMenu = document.getElementById('userMenu');
  const userNameSpan = document.getElementById('userName');
  const userInitialSpan = document.getElementById('userInitial');
  
  if (isLoggedIn()) {
    const user = getCurrentUser();
    if (authBtn) authBtn.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      if (userNameSpan) userNameSpan.textContent = user?.name || 'Student';
      if (userInitialSpan && user?.name) {
        userInitialSpan.textContent = user.name.charAt(0).toUpperCase();
      }
    }
  } else {
    if (authBtn) authBtn.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
  }
}

// Initialize scroll header effect
function initScrollHeader() {
  const header = document.querySelector('.sticky-header');
  if (!header) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// Initialize mobile menu
function initMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  
  if (!menuToggle) return;
  
  function openMenu() {
    mobileMenu?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  function closeMenu() {
    mobileMenu?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  menuToggle.addEventListener('click', openMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

// Show skeleton loader
function showSkeleton(container, type = 'card', count = 3) {
  const skeletons = {
    card: '<div class="skeleton skeleton-card" style="height:180px"></div>',
    exam: '<div class="exam-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:60%"></div><div class="skeleton skeleton-badge" style="margin-top:12px"></div></div>',
    row: '<div class="skeleton skeleton-text" style="height:40px; margin:8px 0"></div>'
  };
  
  container.innerHTML = Array(count).fill(skeletons[type] || skeletons.card).join('');
}

// Show notification
function showNotification(message, type = 'error', duration = 5000) {
  const existing = document.querySelector('.notification-toast');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = `notification-toast notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: ${type === 'error' ? 'var(--error)' : 'var(--success)'};
    z-index: 1000;
    animation: slideIn 0.3s ease;
    font-size: 0.85rem;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Redirect if not logged in
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Redirect if logged in (for login page)
function requireGuest() {
  if (isLoggedIn()) {
    const user = getCurrentUser();
    if (user?.is_admin) {
      window.location.href = '/admin.html';
    } else {
      window.location.href = '/dashboard.html';
    }
    return false;
  }
  return true;
}

// Redirect if not admin
function requireAdmin() {
  if (!requireAuth()) return false;
  const user = getCurrentUser();
  if (!user?.is_admin) {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
}

// Initialize all pages
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  initScrollHeader();
  initMobileMenu();
});
