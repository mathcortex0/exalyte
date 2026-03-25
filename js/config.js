// Supabase Configuration
const SUPABASE_URL = 'https://pwprxidlohbzfsoxrnxs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hJTweaPJGWeaNPQxbBaEPw_jR0O9xhx';
const ADMIN_EMAIL = 'alamin05052008@gmail.com';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
window.supabase = supabase;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.currentUser = currentUser;
window.currentProfile = currentProfile;
