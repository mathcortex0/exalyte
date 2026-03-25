// Admin Panel Functions

async function showAdminPanel() {
    if (window.currentProfile?.role !== 'admin') {
        showToast('Unauthorized access', 'error');
        loadDashboard();
        return;
    }
    
    showLoading(true);
    
    try {
        // Get exams for dropdowns
        const { data: exams, error: examsError } = await supabase
            .from('exams')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (examsError) throw examsError;
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold">⚙️ Admin Panel</h1>
                    <button id="back-dashboard" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                    </button>
                </div>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- Create Exam Section -->
                    <div class="border rounded-lg p-4">
                        <h2 class="text-xl font-bold mb-4">Create New Exam</h2>
                        <form id="create-exam-form" class="space-y-3">
                            <input type="text" id="exam-title" placeholder="Exam Title" class="w-full px-3 py-2 border rounded-lg" required>
                            <textarea id="exam-description" placeholder="Description" class="w-full px-3 py-2 border rounded-lg" rows="2"></textarea>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="datetime-local" id="exam-start-time" class="px-3 py-2 border rounded-lg" required>
                                <input type="datetime-local" id="exam-end-time" class="px-3 py-2 border rounded-lg" required>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="number" id="exam-duration" placeholder="Duration (minutes)" class="px-3 py-2 border rounded-lg" required>
                                <input type="number" id="exam-total-questions" placeholder="Total Questions (optional)" class="px-3 py-2 border rounded-lg">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="number" id="exam-marks" placeholder="Marks per Question" step="0.01" class="px-3 py-2 border rounded-lg" required>
                                <input type="number" id="exam-negative" placeholder="Negative Marking" step="0.01" class="px-3 py-2 border rounded-lg">
                            </div>
                            <label class="flex items-center">
                                <input type="checkbox" id="exam-is-paid" class="mr-2">
                                <span>Paid Exam</span>
                            </label>
                            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                                Create Exam
                            </button>
                        </form>
                    </div>
                    
                    <!-- Bulk Upload Section -->
                    <div class="border rounded-lg p-4">
                        <h2 class="text-xl font-bold mb-4">Bulk Upload Questions</h2>
                        <select id="upload-exam-select" class="w-full px-3 py-2 border rounded-lg mb-3">
                            <option value="">Select Exam</option>
                            ${exams?.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                        </select>
                        <textarea id="bulk-questions-json" placeholder='[{"question":"What is 2+2?","a":"3","b":"4","c":"5","d":"6","correct":"b","image_url":""}]' class="w-full px-3 py-2 border rounded-lg font-mono text-sm" rows="6"></textarea>
                        <button id="bulk-upload-btn" class="mt-3 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            Upload Questions
                        </button>
                    </div>
                    
                    <!-- Paid Users Management -->
                    <div class="border rounded-lg p-4">
                        <h2 class="text-xl font-bold mb-4">Manage Paid Users</h2>
                        <select id="paid-exam-select" class="w-full px-3 py-2 border rounded-lg mb-3">
                            <option value="">Select Exam</option>
                            ${exams?.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                        </select>
                        <div class="flex gap-2 mb-3">
                            <input type="email" id="user-email" placeholder="User Email" class="flex-1 px-3 py-2 border rounded-lg">
                            <button id="add-paid-user" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                Add
                            </button>
                        </div>
                        <div id="paid-users-list" class="space-y-2 max-h-48 overflow-y-auto">
                            <!-- Paid users will be loaded here -->
                        </div>
                    </div>
                    
                    <!-- Manage Exams -->
                    <div class="border rounded-lg p-4">
                        <h2 class="text-xl font-bold mb-4">Manage Exams</h2>
                        <select id="manage-exam-select" class="w-full px-3 py-2 border rounded-lg mb-3">
                            <option value="">Select Exam</option>
                            ${exams?.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
                        </select>
                        <button id="delete-exam-btn" class="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                            Delete Exam
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Create Exam Handler
        document.getElementById('create-exam-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const examData = {
                title: document.getElementById('exam-title').value,
                description: document.getElementById('exam-description').value,
                start_time: document.getElementById('exam-start-time').value,
                end_time: document.getElementById('exam-end-time').value,
                duration: parseInt(document.getElementById('exam-duration').value),
                total_questions_to_show: parseInt(document.getElementById('exam-total-questions').value) || null,
                marks_per_question: parseFloat(document.getElementById('exam-marks').value),
                negative_mark_per_wrong: parseFloat(document.getElementById('exam-negative').value) || 0,
                is_paid: document.getElementById('exam-is-paid').checked
            };
            
            const { error } = await supabase.from('exams').insert(examData);
            if (error) {
                showToast('Error creating exam: ' + error.message, 'error');
            } else {
                showToast('Exam created successfully!', 'success');
                showAdminPanel();
            }
        });
        
        // Bulk Upload Handler
        document.getElementById('bulk-upload-btn').addEventListener('click', async () => {
            const examId = document.getElementById('upload-exam-select').value;
            if (!examId) {
                showToast('Please select an exam', 'error');
                return;
            }
            
            try {
                const questions = JSON.parse(document.getElementById('bulk-questions-json').value);
                const questionsToInsert = questions.map(q => ({
                    exam_id: examId,
                    question_text: q.question,
                    option_a: q.a,
                    option_b: q.b,
                    option_c: q.c,
                    option_d: q.d,
                    correct_answer: q.correct,
                    image_url: q.image_url || null
                }));
                
                const { error } = await supabase.from('questions').insert(questionsToInsert);
                if (error) throw error;
                showToast(`Successfully uploaded ${questions.length} questions!`, 'success');
                document.getElementById('bulk-questions-json').value = '';
            } catch (error) {
                showToast('Invalid JSON format: ' + error.message, 'error');
            }
        });
        
        // Add Paid User Handler
        document.getElementById('add-paid-user').addEventListener('click', async () => {
            const examId = document.getElementById('paid-exam-select').value;
            const userEmail = document.getElementById('user-email').value;
            
            if (!examId || !userEmail) {
                showToast('Please select exam and enter user email', 'error');
                return;
            }
            
            // Get user ID from email
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', userEmail)
                .single();
            
            if (userError || !userData) {
                showToast('User not found', 'error');
                return;
            }
            
            const { error } = await supabase
                .from('paid_users')
                .insert({
                    user_id: userData.id,
                    exam_id: examId
                });
            
            if (error) {
                showToast('Error adding user: ' + error.message, 'error');
            } else {
                showToast('User added successfully!', 'success');
                loadPaidUsers(examId);
                document.getElementById('user-email').value = '';
            }
        });
        
        // Load paid users when exam selected
        document.getElementById('paid-exam-select').addEventListener('change', (e) => {
            if (e.target.value) {
                loadPaidUsers(e.target.value);
            }
        });
        
        // Delete Exam Handler
        document.getElementById('delete-exam-btn').addEventListener('click', async () => {
            const examId = document.getElementById('manage-exam-select').value;
            if (!examId) {
                showToast('Please select an exam', 'error');
                return;
            }
            
            if (confirm('Are you sure you want to delete this exam? All questions and results will be deleted.')) {
                const { error } = await supabase
                    .from('exams')
                    .delete()
                    .eq('id', examId);
                
                if (error) {
                    showToast('Error deleting exam: ' + error.message, 'error');
                } else {
                    showToast('Exam deleted successfully!', 'success');
                    showAdminPanel();
                }
            }
        });
        
        document.getElementById('back-dashboard').addEventListener('click', loadDashboard);
        
    } catch (error) {
        console.error('Error loading admin panel:', error);
        showToast('Error loading admin panel', 'error');
        loadDashboard();
    } finally {
        showLoading(false);
    }
}

async function loadPaidUsers(examId) {
    const { data, error } = await supabase
        .from('paid_users')
        .select('user_id, profiles(email)')
        .eq('exam_id', examId);
    
    const container = document.getElementById('paid-users-list');
    if (!data?.length) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No paid users for this exam</p>';
        return;
    }
    
    container.innerHTML = data.map(pu => `
        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span>${pu.profiles?.email || pu.user_id}</span>
            <button onclick="window.removePaidUser('${pu.user_id}', '${examId}')" class="text-red-600 hover:text-red-800">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

window.removePaidUser = async (userId, examId) => {
    const { error } = await supabase
        .from('paid_users')
        .delete()
        .eq('user_id', userId)
        .eq('exam_id', examId);
    
    if (error) {
        showToast('Error removing user: ' + error.message, 'error');
    } else {
        showToast('User removed successfully!', 'success');
        loadPaidUsers(examId);
    }
};

// Export functions
window.showAdminPanel = showAdminPanel;
