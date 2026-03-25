const SUPABASE_URL = 'https://pwprxidlohbzfsoxrnxs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hJTweaPJGWeaNPQxbBaEPw_jR0O9xhx';
const ADMIN_EMAIL = 'alamin05052008@gmail.com';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;

window.supabase = supabase;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.currentUser = currentUser;
window.currentProfile = currentProfile;
