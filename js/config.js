// Supabase Configuration
const SUPABASE_URL = 'https://pwprxidlohbzfsoxrnxs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hJTweaPJGWeaNPQxbBaEPw_jR0O9xhx';
const ADMIN_EMAIL = 'alamin05052008@gmail.com';

// Initialize Supabase client - Check if supabase is available
let supabase;

// Wait for Supabase to be available
function initSupabase() {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase initialized successfully');
        return true;
    } else {
        console.error('Supabase not loaded yet');
        return false;
    }
}

// Try to initialize immediately, if not, wait for DOM
if (!initSupabase()) {
    window.addEventListener('load', () => {
        initSupabase();
    });
}

// App State
let currentUser = null;
let currentProfile = null;
let currentView = 'auth';
let currentExam = null;
let currentQuestions = [];
let userAnswers = {};
let timerInterval = null;
let examStartTime = null;

// Export for other files
window.supabaseClient = supabase;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.currentUser = currentUser;
window.currentProfile = currentProfile;

// Function to get supabase client (ensures it's ready)
function getSupabase() {
    if (!supabase) {
        initSupabase();
    }
    return supabase;
}

window.getSupabase = getSupabase;
