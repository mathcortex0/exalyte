// Dashboard Functions

async function loadDashboard() {
    window.currentView = 'dashboard';
    const isAdmin = window.currentProfile?.role === 'admin';
    const userName = window.currentProfile?.full_name || window.currentUser.email.split('@')[0];
    
    showLoading(true);
    
    try {
        // Get exams
        const { data: exams, error: examsError } = await supabase
            .from('exams')
            .select('*')
            .gte('end_time', new Date().toISOString())
            .order('created_at', { ascending: false });
        
        // Get user's completed exams
        const { data: completed, error: completedError } = await supabase
            .from('results')
            .select('exam_id')
            .eq('user_id', window.currentUser.id);
        
        const completedIds = new Set(completed?.map(c => c.exam_id) || []);
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 class="text-2xl md:text-3xl font-bold text-gray-800">Welcome, ${userName}!</h1>
                        <p class="text-gray-600 mt-1">Ready to test your knowledge?</p>
                    </div>
                    <div class="flex gap-3 flex-wrap">
                        <button id="leaderboard-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-trophy mr-2"></i>Leaderboard
                        </button>
                        ${isAdmin ? `
                            <button id="admin-btn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                                <i class="fas fa-cog mr-2"></i>Admin Panel
                            </button>
                        ` : ''}
                        <button id="history-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-history mr-2"></i>My History
                        </button>
                        <button id="logout-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                            <i class="fas fa-sign-out-alt mr-2"></i>Logout
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${exams?.length ? exams.map(exam => `
                    <div class="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-all duration-300">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="text-lg font-bold text-gray-800">${exam.title}</h3>
                            ${exam.is_paid ? 
                                '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-crown mr-1"></i>Premium</span>' : 
                                '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Free</span>'
                            }
                        </div>
                        <p class="text-gray-600 text-sm mb-3">${exam.description || 'No description'}</p>
                        <div class="space-y-1 text-sm text-gray-500">
                            <div><i class="fas fa-clock mr-2"></i>${exam.duration} minutes</div>
                            <div><i class="fas fa-calendar mr-2"></i>${formatDate(exam.start_time)}</div>
                        </div>
                        ${completedIds.has(exam.id) ? 
                            '<div class="mt-4 text-green-600 text-sm"><i class="fas fa-check-circle mr-1"></i>Completed</div>' :
                            `<button onclick="startExam('${exam.id}')" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition">
                                Start Exam
                            </button>`
                        }
                    </div>
                `).join('') : '<div class="col-span-full text-center py-8 text-gray-500">No exams available at the moment.</div>'}
            </div>
        `;
        
        // Attach event listeners
        document.getElementById('leaderboard-btn')?.addEventListener('click', showLeaderboard);
        document.getElementById('admin-btn')?.addEventListener('click', showAdminPanel);
        document.getElementById('history-btn')?.addEventListener('click', showHistory);
        document.getElementById('logout-btn')?.addEventListener('click', logout);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard', 'error');
    } finally {
        showLoading(false);
    }
}

async function showLeaderboard() {
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
                        <button id="back-dashboard" class="px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-gray-100 transition">
                            <i class="fas fa-arrow-left mr-2"></i>Back
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    ${data?.length ? `
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-gray-100">
                                    <tr>
                                        <th class="p-3 text-left">Rank</th>
                                        <th class="p-3 text-left">Student</th>
                                        <th class="p-3 text-left">Exam</th>
                                        <th class="p-3 text-left">Score</th>
                                        <th class="p-3 text-left">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map((r, i) => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="p-3 font-semibold ${i < 3 ? 'text-yellow-600' : ''}">
                                                ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}
                                            </td>
                                            <td class="p-3">${r.profiles?.full_name || r.profiles?.email?.split('@')[0]}</td>
                                            <td class="p-3">${r.exams?.title}</td>
                                            <td class="p-3 font-bold text-blue-600">${r.score}</td>
                                            <td class="p-3">${((r.correct_count / (r.correct_count + r.wrong_count) * 100) || 0).toFixed(1)}%</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="text-center py-8 text-gray-500">No results yet</div>'}
                </div>
            </div>
        `;
        
        document.getElementById('back-dashboard')?.addEventListener('click', loadDashboard);
        
    } catch (error) {
        showToast('Error loading leaderboard', 'error');
        loadDashboard();
    } finally {
        showLoading(false);
    }
}

async function showHistory() {
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
                    <h1 class="text-2xl font-bold">📚 My Exam History</h1>
                    <button id="back-dashboard" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        <i class="fas fa-arrow-left mr-2"></i>Back
                    </button>
                </div>
                ${data?.length ? data.map(r => `
                    <div class="border rounded-lg p-4 mb-3 hover:shadow-md transition">
                        <div class="flex justify-between items-start flex-wrap gap-2">
                            <div>
                                <h3 class="font-bold text-lg">${r.exams?.title}</h3>
                                <p class="text-sm text-gray-500">${formatDate(r.created_at)}</p>
                            </div>
                            <div class="text-right">
                                <span class="text-2xl font-bold text-blue-600">${r.score}</span>
                                <p class="text-sm text-gray-600">${r.correct_count} correct / ${r.wrong_count} wrong</p>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500 mt-2">
                            <i class="fas fa-clock mr-1"></i>Time taken: ${formatTime(r.time_taken)}
                        </div>
                    </div>
                `).join('') : '<div class="text-center py-8 text-gray-500">No exam history yet</div>'}
            </div>
        `;
        
        document.getElementById('back-dashboard')?.addEventListener('click', loadDashboard);
        
    } catch (error) {
        showToast('Error loading history', 'error');
        loadDashboard();
    } finally {
        showLoading(false);
    }
}

function showAuth() {
    window.currentView = 'auth';
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center">
                <i class="fas fa-graduation-cap text-5xl mb-4"></i>
                <h1 class="text-3xl font-bold">Exalyte</h1>
                <p class="text-blue-100 mt-2">Premium Exam Platform</p>
            </div>
            <div class="p-8">
                <div class="flex gap-2 mb-6 border-b">
                    <button id="login-tab" class="flex-1 py-2 font-semibold border-b-2 border-blue-600 text-blue-600">
                        Login
                    </button>
                    <button id="signup-tab" class="flex-1 py-2 font-semibold text-gray-500">
                        Sign Up
                    </button>
                </div>
                
                <div id="login-form">
                    <div class="mb-4">
                        <label class="block text-gray-700 font-semibold mb-2">Email</label>
                        <input type="email" id="login-email" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="your@email.com">
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">Password</label>
                        <input type="password" id="login-password" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••">
                    </div>
                    <button id="login-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition">
                        <i class="fas fa-sign-in-alt mr-2"></i>Login
                    </button>
                    <div class="relative my-6">
                        <div class="absolute inset-0 flex items-center">
                            <div class="w-full border-t border-gray-300"></div>
                        </div>
                        <div class="relative flex justify-center text-sm">
                            <span class="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>
                    <button id="google-login-btn" class="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
                        <i class="fab fa-google text-red-500"></i>
                        Sign in with Google
                    </button>
                </div>
                
                <div id="signup-form" class="hidden">
                    <div class="mb-4">
                        <label class="block text-gray-700 font-semibold mb-2">Full Name</label>
                        <input type="text" id="signup-name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe">
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 font-semibold mb-2">Email</label>
                        <input type="email" id="signup-email" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="your@email.com">
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 font-semibold mb-2">Password</label>
                        <input type="password" id="signup-password" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••">
                    </div>
                    <button id="signup-btn" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition">
                        <i class="fas fa-user-plus mr-2"></i>Create Account
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Attach event listeners
    document.getElementById('login-tab')?.addEventListener('click', () => {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('login-tab').classList.add('border-blue-600', 'text-blue-600');
        document.getElementById('login-tab').classList.remove('text-gray-500');
        document.getElementById('signup-tab').classList.add('text-gray-500');
        document.getElementById('signup-tab').classList.remove('border-purple-600', 'text-purple-600');
    });
    
    document.getElementById('signup-tab')?.addEventListener('click', () => {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
        document.getElementById('signup-tab').classList.add('border-purple-600', 'text-purple-600');
        document.getElementById('signup-tab').classList.remove('text-gray-500');
        document.getElementById('login-tab').classList.add('text-gray-500');
        document.getElementById('login-tab').classList.remove('border-blue-600', 'text-blue-600');
    });
    
    document.getElementById('login-btn')?.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        login(email, password);
    });
    
    document.getElementById('google-login-btn')?.addEventListener('click', loginWithGoogle);
    
    document.getElementById('signup-btn')?.addEventListener('click', () => {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        signup(email, password, name);
    });
}

// Export functions
window.loadDashboard = loadDashboard;
window.showAuth = showAuth;
window.showLeaderboard = showLeaderboard;
window.showHistory = showHistory;
