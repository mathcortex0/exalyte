// Main App Initialization

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Exalyte App Initializing...');
    
    // Check if Supabase is available, retry if not
    function initApp() {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            console.log('Supabase found, initializing...');
            window.checkAuth();
        } else {
            console.log('Waiting for Supabase to load...');
            setTimeout(initApp, 500);
        }
    }
    
    initApp();
});

// Handle Google OAuth redirect
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('code')) {
    console.log('OAuth callback detected');
}
