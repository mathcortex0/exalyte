async function checkAuth() {
    showLoading(true);
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (user) {
        currentUser = user;
        await loadProfile();
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
            window.location.href = 'dashboard.html';
        }
    } else {
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
    }
    showLoading(false);
}

async function checkAuthAndRedirect() {
    showLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        window.location.href = 'dashboard.html';
    }
    showLoading(false);
}

async function loadProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (data) {
        currentProfile = data;
    } else {
        const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
                id: currentUser.id,
                email: currentUser.email,
                full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
                role: currentUser.email === ADMIN_EMAIL ? 'admin' : 'user'
            })
            .select()
            .single();
        currentProfile = newProfile;
    }
}

async function login(email, password) {
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    showLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    showLoading(false);
    if (error) showToast(error.message, 'error');
    else window.location.href = 'dashboard.html';
}

async function loginWithGoogle() {
    showLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/dashboard.html' }
    });
    if (error) {
        showToast(error.message, 'error');
        showLoading(false);
    }
}

async function signup(email, password, fullName) {
    if (!email || !password || !fullName) {
        showToast('Please fill all fields', 'error');
        return;
    }
    showLoading(true);
    const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
    });
    showLoading(false);
    if (error) showToast(error.message, 'error');
    else showToast('Signup successful! Please verify your email.', 'success');
}

async function logout() {
    showLoading(true);
    await supabase.auth.signOut();
    showLoading(false);
    window.location.href = 'index.html';
}

window.checkAuth = checkAuth;
window.checkAuthAndRedirect = checkAuthAndRedirect;
window.login = login;
window.loginWithGoogle = loginWithGoogle;
window.signup = signup;
window.logout = logout;
