// ============================================
// DASHBOARD.JS - All Dashboard Functions
// ============================================

// Load Main Dashboard
async function loadDashboard() {
    const supabase = getSupabase();
    if (!supabase) {
        console.log('Waiting for Supabase...');
        showToast('System initializing, please wait...', 'info');
        setTimeout(loadDashboard, 500);
        return;
    }
    
    if (!window.currentUser) {
        console.log('No user found, showing auth');
        showAuth();
        return;
    }
    
    window.currentView = 'dashboard';
    const isAdmin = window.currentProfile?.role === 'admin';
    const userName = window.currentProfile?.full_name || window.currentUser.email?.split('@')[0] || 'User';
    
    showLoading(true);
    
    try {
        // Get all active exams
        const { data: exams, error: examsError } = await supabase
            .from('exams')
            .select('*')
            .gte('end_time', new Date().toISOString())
            .order('created_at', { ascending: false });
        
        if (examsError) {
            console.error('Error loading exams:', examsError);
        }
        
        // Get user's completed exams
        const { data: completed, error: completedError } = await supabase
            .from('results')
            .select('exam_id')
            .eq('user_id', window.currentUser.id);
        
        const completedIds = new Set(completed?.map(c => c.exam_id) || []);
        
        // Get user stats
        const { data: userResults } = await supabase
            .from('results')
            .select('score, correct_count, wrong_count')
            .eq('user_id', window.currentUser.id);
        
        const totalExams = userResults?.length || 0;
        const avgScore = userResults?.length ? 
            (userResults.reduce((sum, r) => sum + (r.score || 0), 0) / userResults.length).toFixed(1) : 0;
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <!-- Welcome Header -->
            <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 class="text-2xl md:text-3xl font-bold text-gray-800">Welcome, ${escapeHtml(userName)}!</h1>
                        <p class="text-gray-600 mt-1">Ready to test your knowledge?</p>
                    </div>
                    <div class="flex gap-3 flex-wrap">
                        <button id="leaderboardBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2">
                            <i class="fas fa-trophy"></i> Leaderboard
                        </button>
                        ${isAdmin ? `
                            <button id="adminBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2">
                                <i class="fas fa-cog"></i> Admin Panel
                            </button>
                        ` : ''}
                        <button id="historyBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                            <i class="fas fa-history"></i> My History
                        </button>
                        <button id="logoutBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm opacity-90">Total Exams Taken</p>
                            <p class="text-3xl font-bold">${totalExams}</p>
                        </div>
                        <i class="fas fa-book-open text-4xl opacity-50"></i>
                    </div>
                </div>
                <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm opacity-90">Average Score</p>
                            <p class="text-3xl font-bold">${avgScore}</p>
                        </div>
                        <i class="fas fa-chart-line text-4xl opacity-50"></i>
                    </div>
                </div>
                <div class="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm opacity-90">Available Exams</p>
                            <p class="text-3xl font-bold">${exams?.length || 0}</p>
                        </div>
                        <i class="fas fa-graduation-cap text-4xl opacity-50"></i>
                    </div>
                </div>
            </div>
            
            <!-- Exams Section -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <i class="fas fa-list-check text-blue-600"></i> Available Exams
                </h2>
                <div id="examsList" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${!exams || exams.length === 0 ? 
                        '<div class="col-span-full text-center py-8 text-gray-500">No exams available at the moment. Check back later!</div>' : 
                        exams.map(exam => `
                            <div class="border rounded-xl p-5 hover:shadow-lg transition-all duration-300">
                                <div class="flex justify-between items-start mb-3">
                                    <h3 class="text-lg font-bold text-gray-800">${escapeHtml(exam.title)}</h3>
                                    ${exam.is_paid ? 
                                        '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-crown mr-1"></i>Premium</span>' : 
                                        '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Free</span>'
                                    }
                                </div>
                                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${escapeHtml(exam.description || 'No description available')}</p>
                                <div class="space-y-1 text-sm text-gray-500">
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-clock w-4"></i>
                                        <span>${exam.duration} minutes</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-calendar w-4"></i>
                                        <span>${formatDate(exam.start_time)}</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-question-circle w-4"></i>
                                        <span>${exam.total_questions_to_show || 'All'} questions</span>
                                    </div>
                                </div>
                                ${completedIds.has(exam.id) ? 
                                    '<div class="mt-4 text-green-600 text-sm flex items-center gap-1"><i class="fas fa-check-circle"></i> Completed</div>' :
                                    `<button onclick="startExam('${exam.id}')" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2">
                                        <i class="fas fa-play"></i> Start Exam
                                    </button>`
                                }
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
        
        // Attach event listeners
        document.getElementById('leaderboardBtn')?.addEventListener('click', () => showLeaderboard());
        document.getElementById('adminBtn')?.addEventListener('click', () => showAdminPanel());
        document.getElementById('historyBtn')?.addEventListener('click', () => showHistory());
        document.getElementById('logoutBtn')?.addEventListener('click', () => logout());
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Show Leaderboard
async function showLeaderboard() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    showLoading(true);
    try {
        const { data, error } = await supabase
            .from('results')
            .select('*, profiles(full_name, email), exams(title)')
            .order('score', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl overflow-hidden">
                <div class="bg-gradient-to-r from-yellow-500 to-orange-600 p-6 text-white">
                    <div class="flex justify-between items-center">
                        <div>
                            <i class="fas fa-trophy text-4xl mb-2"></i>
                            <h1 class="text-2xl font-bold">Leaderboard</h1>
                            <p class="text-sm">Top performers across all exams</p>
                        </div>
                        <button id="backDashboardBtn" class="px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-gray-100 transition flex items-center gap-2">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    ${data && data.length > 0 ? `
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-gray-100">
                                    <tr>
                                        <th class="p-3 text-left">Rank</th>
                                        <th class="p-3 text-left">Student</th>
                                        <th class="p-3 text-left">Exam</th>
                                        <th class="p-3 text-left">Score</th>
                                        <th class="p-3 text-left">Accuracy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map((r, i) => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="p-3 font-semibold ${i < 3 ? 'text-yellow-600' : ''}">
                                                ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}
                                            </td>
                                            <td class="p-3">${escapeHtml(r.profiles?.full_name || r.profiles?.email?.split('@')[0] || 'Anonymous')}</td>
                                            <td class="p-3">${escapeHtml(r.exams?.title || 'Unknown')}</td>
                                            <td class="p-3 font-bold text-blue-600">${r.score || 0}</td>
                                            <td class="p-3">${r.correct_count && r.wrong_count ? 
                                                ((r.correct_count / (r.correct_count + r.wrong_count) * 100)).toFixed(1) : 0}%
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="text-center py-8 text-gray-500">No results yet. Be the first to take an exam!</div>'}
                </div>
            </div>
        `;
        
        document.getElementById('backDashboardBtn')?.addEventListener('click', () => loadDashboard());
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showToast('Error loading leaderboard', 'error');
        loadDashboard();
    } finally {
        showLoading(false);
    }
}

// Show Exam History
async function showHistory() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    showLoading(true);
    try {
        const { data, error } = await supabase
            .from('results')
            .select('*, exams(title)')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h1 class="text-2xl font-bold flex items-center gap-2">
                            <i class="fas fa-history text-blue-600"></i> My Exam History
                        </h1>
                        <p class="text-gray-600 text-sm mt-1">Track your progress and performance</p>
                    </div>
                    <button id="backDashboardBtn" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>
                
                ${data && data.length > 0 ? 
                    `<div class="space-y-4">
                        ${data.map(r => `
                            <div class="border rounded-lg p-4 hover:shadow-md transition">
                                <div class="flex justify-between items-start flex-wrap gap-2">
                                    <div class="flex-1">
                                        <h3 class="font-bold text-lg text-gray-800">${escapeHtml(r.exams?.title || 'Unknown Exam')}</h3>
                                        <p class="text-sm text-gray-500">${formatDate(r.created_at)}</p>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-2xl font-bold text-blue-600">${r.score || 0}</span>
                                        <p class="text-sm text-gray-600">Total Score</p>
                                    </div>
                                </div>
                                <div class="flex gap-4 mt-3 text-sm">
                                    <span class="text-green-600"><i class="fas fa-check-circle mr-1"></i> ${r.correct_count || 0} Correct</span>
                                    <span class="text-red-600"><i class="fas fa-times-circle mr-1"></i> ${r.wrong_count || 0} Wrong</span>
                                    <span class="text-gray-600"><i class="fas fa-clock mr-1"></i> ${formatTime(r.time_taken || 0)}</span>
                                </div>
                                <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-green-500 h-2 rounded-full" style="width: ${r.correct_count && r.wrong_count ? 
                                        (r.correct_count / (r.correct_count + r.wrong_count) * 100) : 0}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>` : 
                    '<div class="text-center py-12 text-gray-500"><i class="fas fa-inbox text-4xl mb-3"></i><p>No exam history yet. Start taking exams to see your progress!</p></div>'
                }
            </div>
        `;
        
        document.getElementById('backDashboardBtn')?.addEventListener('click', () => loadDashboard());
        
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Error loading history', 'error');
        loadDashboard();
    } finally {
        showLoading(false);
    }
}

// Show Auth Screen
function showAuth() {
    window.currentView = 'auth';
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center">
                <i class="fas fa-graduation-cap text-5xl mb-4"></i>
                <h1 class="text-3xl font-bold">Exalyte</h1>
                <p class="text-blue-100 mt-2">Premium Exam Platform</p>
            </div>
            <div class="p-8">
                <div class="flex gap-2 mb-6 border-b">
                    <button id="loginTab" class="flex-1 py-2 font-semibold border-b-2 border-blue-600 text-blue-600">
                        Login
                    </button>
                    <button id="signupTab" class="flex-1 py-2 font-semibold text-gray-500">
                        Sign Up
                    </button>
                </div>
                
                <div id="loginForm">
                    <div class="mb-4">
                        <label class="block text-gray-700 font-semibold mb-2">Email Address</label>
                        <input type="email" id="loginEmail" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="your@email.com">
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">Password</label>
                        <input type="password" id="loginPassword" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••">
                    </div>
                    <button id="loginBtn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition">
                        <i class="fas fa-sign-in-alt mr-2"></i> Login
                    </button>
                    <div class="relative my-6">
                        <div class="absolute inset-0 flex items-center">
                            <div class="w-full border-t border-gray-300"></div>
                        </div>
                        <div class="relative flex justify-center text-sm">
                            <span class="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>
                    <button id="googleLoginBtn" class="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
                        <i class="fab fa-google text-red-500"></i>
                        Sign in with Google
                    </button>
                </div>
                
                <div id="signupForm" class="hidden">
                    <div class="mb-4">
                        <label class="block text-gray-700 font-semibold mb-2">Full Name</label>
                        <input type="text" id="signupName" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe">
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 font-semibold mb-2">Email Address</label>
                        <input type="email" id="signupEmail" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="your@email.com">
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">Password</label>
                        <input type="password" id="signupPassword" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••">
                    </div>
                    <button id="signupBtn" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition">
                        <i class="fas fa-user-plus mr-2"></i> Create Account
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Attach event listeners
    document.getElementById('loginTab')?.addEventListener('click', () => {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginTab').classList.add('border-blue-600', 'text-blue-600');
        document.getElementById('loginTab').classList.remove('text-gray-500');
        document.getElementById('signupTab').classList.add('text-gray-500');
        document.getElementById('signupTab').classList.remove('border-purple-600', 'text-purple-600');
    });
    
    document.getElementById('signupTab')?.addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
        document.getElementById('signupTab').classList.add('border-purple-600', 'text-purple-600');
        document.getElementById('signupTab').classList.remove('text-gray-500');
        document.getElementById('loginTab').classList.add('text-gray-500');
        document.getElementById('loginTab').classList.remove('border-blue-600', 'text-blue-600');
    });
    
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (email && password) {
            login(email, password);
        } else {
            showToast('Please enter email and password', 'error');
        }
    });
    
    document.getElementById('googleLoginBtn')?.addEventListener('click', () => loginWithGoogle());
    
    document.getElementById('signupBtn')?.addEventListener('click', () => {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        if (name && email && password) {
            signup(email, password, name);
        } else {
            showToast('Please fill all fields', 'error');
        }
    });
}

// Add escapeHtml if not exists
if (typeof window.escapeHtml === 'undefined') {
    window.escapeHtml = function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

// Export functions to global scope
window.loadDashboard = loadDashboard;
window.showLeaderboard = showLeaderboard;
window.showHistory = showHistory;
window.showAuth = showAuth;
