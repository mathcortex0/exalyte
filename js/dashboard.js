async function loadDashboard() {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    showLoading(true);
    
    const isAdmin = currentProfile?.role === 'admin';
    const userName = currentProfile?.full_name || currentUser.email.split('@')[0];
    
    const { data: exams } = await supabase
        .from('exams')
        .select('*')
        .gte('end_time', new Date().toISOString())
        .order('created_at', { ascending: false });
    
    const { data: completed } = await supabase
        .from('results')
        .select('exam_id')
        .eq('user_id', currentUser.id);
    
    const completedIds = new Set(completed?.map(c => c.exam_id) || []);
    
    const { data: results } = await supabase
        .from('results')
        .select('score')
        .eq('user_id', currentUser.id);
    
    const totalExams = results?.length || 0;
    const avgScore = results?.length ? 
        (results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length).toFixed(1) : 0;
    
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div class="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 class="text-2xl font-bold">Welcome, ${escapeHtml(userName)}!</h1>
                    <p class="text-gray-600">Ready to test your knowledge?</p>
                </div>
                <div class="flex gap-3">
                    <button id="leaderboardBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <i class="fas fa-trophy mr-2"></i>Leaderboard
                    </button>
                    ${isAdmin ? `
                        <button id="adminBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                            <i class="fas fa-cog mr-2"></i>Admin
                        </button>
                    ` : ''}
                    <button id="historyBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <i class="fas fa-history mr-2"></i>History
                    </button>
                    <button id="logoutBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <p class="text-sm opacity-90">Total Exams Taken</p>
                <p class="text-3xl font-bold">${totalExams}</p>
            </div>
            <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                <p class="text-sm opacity-90">Average Score</p>
                <p class="text-3xl font-bold">${avgScore}</p>
            </div>
            <div class="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <p class="text-sm opacity-90">Available Exams</p>
                <p class="text-3xl font-bold">${exams?.length || 0}</p>
            </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h2 class="text-xl font-bold mb-4">Available Exams</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${!exams?.length ? 
                    '<div class="col-span-full text-center py-8 text-gray-500">No exams available</div>' :
                    exams.map(exam => `
                        <div class="border rounded-xl p-5 hover:shadow-lg transition">
                            <div class="flex justify-between items-start mb-3">
                                <h3 class="text-lg font-bold">${escapeHtml(exam.title)}</h3>
                                ${exam.is_paid ? 
                                    '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-crown"></i> Premium</span>' : 
                                    '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Free</span>'}
                            </div>
                            <p class="text-gray-600 text-sm mb-3">${escapeHtml(exam.description || 'No description')}</p>
                            <div class="text-sm text-gray-500">
                                <div><i class="fas fa-clock mr-2"></i>${exam.duration} minutes</div>
                                <div><i class="fas fa-calendar mr-2"></i>${formatDate(exam.start_time)}</div>
                            </div>
                            ${completedIds.has(exam.id) ? 
                                '<div class="mt-4 text-green-600"><i class="fas fa-check-circle"></i> Completed</div>' :
                                `<button onclick="startExam('${exam.id}')" class="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Start Exam</button>`
                            }
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
    
    document.getElementById('leaderboardBtn')?.addEventListener('click', showLeaderboard);
    document.getElementById('adminBtn')?.addEventListener('click', showAdminPanel);
    document.getElementById('historyBtn')?.addEventListener('click', showHistory);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    showLoading(false);
}

async function showLeaderboard() {
    showLoading(true);
    const { data } = await supabase
        .from('results')
        .select('*, profiles(full_name, email), exams(title)')
        .order('score', { ascending: false })
        .limit(50);
    
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-2xl font-bold">🏆 Leaderboard</h1>
                <button onclick="loadDashboard()" class="px-4 py-2 bg-gray-600 text-white rounded-lg">Back</button>
            </div>
            ${data?.length ? `
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-100">
                            <tr><th class="p-3">Rank</th><th class="p-3">Student</th><th class="p-3">Exam</th><th class="p-3">Score</th></tr>
                        </thead>
                        <tbody>
                            ${data.map((r, i) => `
                                <tr class="border-b">
                                    <td class="p-3 font-semibold">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}</td>
                                    <td class="p-3">${escapeHtml(r.profiles?.full_name || r.profiles?.email?.split('@')[0])}</td>
                                    <td class="p-3">${escapeHtml(r.exams?.title)}</td>
                                    <td class="p-3 font-bold text-blue-600">${r.score}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<div class="text-center py-8">No results yet</div>'}
        </div>
    `;
    showLoading(false);
}

async function showHistory() {
    showLoading(true);
    const { data } = await supabase
        .from('results')
        .select('*, exams(title)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-2xl font-bold">📚 My History</h1>
                <button onclick="loadDashboard()" class="px-4 py-2 bg-gray-600 text-white rounded-lg">Back</button>
            </div>
            ${data?.length ? data.map(r => `
                <div class="border rounded-lg p-4 mb-3">
                    <div class="flex justify-between">
                        <div><h3 class="font-bold">${escapeHtml(r.exams?.title)}</h3><p class="text-sm text-gray-500">${formatDate(r.created_at)}</p></div>
                        <div class="text-right"><span class="text-2xl font-bold text-blue-600">${r.score}</span><p class="text-sm">${r.correct_count}✓ / ${r.wrong_count}✗</p></div>
                    </div>
                    <div class="text-sm text-gray-500">⏱️ ${formatTime(r.time_taken)}</div>
                </div>
            `).join('') : '<div class="text-center py-8">No history yet</div>'}
        </div>
    `;
    showLoading(false);
}

async function showAdminPanel() {
    if (currentProfile?.role !== 'admin') {
        showToast('Unauthorized', 'error');
        loadDashboard();
        return;
    }
    
    showLoading(true);
    const { data: exams } = await supabase.from('exams').select('*');
    
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-2xl font-bold">⚙️ Admin Panel</h1>
                <button onclick="loadDashboard()" class="px-4 py-2 bg-gray-600 text-white rounded-lg">Back</button>
            </div>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="border rounded-lg p-4">
                    <h2 class="text-xl font-bold mb-4">Create Exam</h2>
                    <form id="createExamForm" class="space-y-3">
                        <input type="text" id="title" placeholder="Title" class="w-full p-2 border rounded" required>
                        <textarea id="desc" placeholder="Description" class="w-full p-2 border rounded" rows="2"></textarea>
                        <input type="datetime-local" id="start" class="w-full p-2 border rounded" required>
                        <input type="datetime-local" id="end" class="w-full p-2 border rounded" required>
                        <input type="number" id="duration" placeholder="Duration (minutes)" class="w-full p-2 border rounded" required>
                        <input type="number" id="marks" placeholder="Marks per question" step="0.01" class="w-full p-2 border rounded" required>
                        <input type="number" id="negative" placeholder="Negative marking" step="0.01" class="w-full p-2 border rounded">
                        <label><input type="checkbox" id="isPaid"> Paid Exam</label>
                        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded">Create</button>
                    </form>
                </div>
                <div class="border rounded-lg p-4">
                    <h2 class="text-xl font-bold mb-4">Bulk Upload Questions</h2>
                    <select id="examSelect" class="w-full p-2 border rounded mb-3">
                        <option value="">Select Exam</option>
                        ${exams?.map(e => `<option value="${e.id}">${escapeHtml(e.title)}</option>`).join('')}
                    </select>
                    <textarea id="questionsJson" placeholder='[{"question":"What is 2+2?","a":"3","b":"4","c":"5","d":"6","correct":"b"}]' class="w-full p-2 border rounded font-mono text-sm" rows="6"></textarea>
                    <button id="uploadBtn" class="mt-3 w-full bg-green-600 text-white py-2 rounded">Upload</button>
                </div>
                <div class="border rounded-lg p-4">
                    <h2 class="text-xl font-bold mb-4">Paid Users</h2>
                    <select id="paidExamSelect" class="w-full p-2 border rounded mb-3">
                        <option value="">Select Exam</option>
                        ${exams?.map(e => `<option value="${e.id}">${escapeHtml(e.title)}</option>`).join('')}
                    </select>
                    <div class="flex gap-2 mb-3">
                        <input type="email" id="userEmail" placeholder="User Email" class="flex-1 p-2 border rounded">
                        <button id="addPaidUser" class="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
                    </div>
                    <div id="paidUsersList" class="space-y-2 max-h-48 overflow-y-auto"></div>
                </div>
                <div class="border rounded-lg p-4">
                    <h2 class="text-xl font-bold mb-4">Manage Exams</h2>
                    <select id="deleteExamSelect" class="w-full p-2 border rounded mb-3">
                        <option value="">Select Exam</option>
                        ${exams?.map(e => `<option value="${e.id}">${escapeHtml(e.title)}</option>`).join('')}
                    </select>
                    <button id="deleteExam" class="w-full bg-red-600 text-white py-2 rounded">Delete Exam</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('createExamForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('exams').insert({
            title: document.getElementById('title').value,
            description: document.getElementById('desc').value,
            start_time: document.getElementById('start').value,
            end_time: document.getElementById('end').value,
            duration: parseInt(document.getElementById('duration').value),
            marks_per_question: parseFloat(document.getElementById('marks').value),
            negative_mark_per_wrong: parseFloat(document.getElementById('negative').value) || 0,
            is_paid: document.getElementById('isPaid').checked
        });
        if (error) showToast(error.message, 'error');
        else { showToast('Exam created!'); showAdminPanel(); }
    });
    
    document.getElementById('uploadBtn').addEventListener('click', async () => {
        const examId = document.getElementById('examSelect').value;
        if (!examId) { showToast('Select exam', 'error'); return; }
        try {
            const questions = JSON.parse(document.getElementById('questionsJson').value);
            const toInsert = questions.map(q => ({
                exam_id: examId, question_text: q.question, option_a: q.a, option_b: q.b,
                option_c: q.c, option_d: q.d, correct_answer: q.correct, image_url: q.image_url || null
            }));
            const { error } = await supabase.from('questions').insert(toInsert);
            if (error) throw error;
            showToast(`Uploaded ${questions.length} questions!`);
        } catch (err) { showToast('Invalid JSON', 'error'); }
    });
    
    document.getElementById('addPaidUser').addEventListener('click', async () => {
        const examId = document.getElementById('paidExamSelect').value;
        const email = document.getElementById('userEmail').value;
        if (!examId || !email) { showToast('Select exam and email', 'error'); return; }
        const { data: user } = await supabase.from('profiles').select('id').eq('email', email).single();
        if (!user) { showToast('User not found', 'error'); return; }
        const { error } = await supabase.from('paid_users').insert({ user_id: user.id, exam_id: examId });
        if (error) showToast(error.message, 'error');
        else { showToast('User added!'); loadPaidUsers(examId); }
    });
    
    document.getElementById('paidExamSelect').addEventListener('change', (e) => {
        if (e.target.value) loadPaidUsers(e.target.value);
    });
    
    document.getElementById('deleteExam').addEventListener('click', async () => {
        const examId = document.getElementById('deleteExamSelect').value;
        if (!examId) { showToast('Select exam', 'error'); return; }
        if (confirm('Delete this exam?')) {
            const { error } = await supabase.from('exams').delete().eq('id', examId);
            if (error) showToast(error.message, 'error');
            else { showToast('Exam deleted'); showAdminPanel(); }
        }
    });
    
    showLoading(false);
}

async function loadPaidUsers(examId) {
    const { data } = await supabase.from('paid_users').select('user_id, profiles(email)').eq('exam_id', examId);
    const container = document.getElementById('paidUsersList');
    if (!data?.length) { container.innerHTML = '<p class="text-center py-4 text-gray-500">No paid users</p>'; return; }
    container.innerHTML = data.map(p => `
        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span>${escapeHtml(p.profiles?.email)}</span>
            <button onclick="removePaidUser('${p.user_id}', '${examId}')" class="text-red-600">❌</button>
        </div>
    `).join('');
}

window.removePaidUser = async (userId, examId) => {
    await supabase.from('paid_users').delete().eq('user_id', userId).eq('exam_id', examId);
    loadPaidUsers(examId);
};

window.startExam = (examId) => {
    window.location.href = `exam.html?id=${examId}`;
};

window.loadDashboard = loadDashboard;
window.showLeaderboard = showLeaderboard;
window.showHistory = showHistory;
window.showAdminPanel = showAdminPanel;
