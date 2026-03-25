// Main App Initialization

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Exalyte App Initializing...');
    
    // Make sure all global functions are available
    window.checkAuth = checkAuth;
    window.login = login;
    window.loginWithGoogle = loginWithGoogle;
    window.signup = signup;
    window.logout = logout;
    window.loadDashboard = loadDashboard;
    window.startExam = startExam;
    window.showLeaderboard = showLeaderboard;
    window.showHistory = showHistory;
    window.showAdminPanel = showAdminPanel;
    window.showAuth = showAuth;
    
    // Start the app
    checkAuth();
});

// Handle Google OAuth redirect
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('code')) {
    console.log('OAuth callback detected');
    // Supabase handles this automatically
}
