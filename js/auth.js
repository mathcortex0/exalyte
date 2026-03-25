// Authentication Functions

async function checkAuth() {
    showLoading(true);
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (user) {
            window.currentUser = user;
            await loadProfile();
            loadDashboard();
        } else {
            window.currentUser = null;
            window.currentProfile = null;
            showAuth();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showAuth();
    } finally {
        showLoading(false);
    }
}

async function loadProfile() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .single();
        
        if (data) {
            window.currentProfile = data;
        } else {
            // Create profile if doesn't exist
            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: window.currentUser.id,
                    email: window.currentUser.email,
                    full_name: window.currentUser.user_metadata?.full_name || window.currentUser.email.split('@')[0],
                    role: window.currentUser.email === ADMIN_EMAIL ? 'admin' : 'user'
                })
                .select()
                .single();
            
            if (newProfile) {
                window.currentProfile = newProfile;
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function login(email, password) {
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    showLoading(true);
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        showToast('Login successful!', 'success');
        await checkAuth();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function loginWithGoogle() {
    showLoading(true);
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
    } catch (error) {
        showToast(error.message, 'error');
        showLoading(false);
    }
}

async function signup(email, password, fullName) {
    if (!email || !password || !fullName) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email', 'error');
        return;
    }
    
    showLoading(true);
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        
        if (error) throw error;
        
        showToast('Signup successful! Please check your email for verification.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function logout() {
    showLoading(true);
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.currentUser = null;
        window.currentProfile = null;
        showAuth();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Export functions
window.checkAuth = checkAuth;
window.login = login;
window.loginWithGoogle = loginWithGoogle;
window.signup = signup;
window.logout = logout;
