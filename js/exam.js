let examData = null;
let questions = [];
let userAnswers = {};
let timerInterval = null;
let startTime = null;

async function checkAuthAndStartExam(examId) {
    showLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    await loadProfile();
    await startExam(examId);
}

async function startExam(examId) {
    showLoading(true);
    
    const { data: existing } = await supabase
        .from('results')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('exam_id', examId)
        .single();
    
    if (existing) {
        showToast('You already took this exam!', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    
    const { data: exam } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();
    
    if (!exam) {
        showToast('Exam not found', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    
    if (exam.is_paid) {
        const { data: paid } = await supabase
            .from('paid_users')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('exam_id', examId)
            .single();
        
        if (!paid) {
            showToast('Premium exam - upgrade required', 'error');
            window.location.href = 'dashboard.html';
            return;
        }
    }
    
    const now = new Date();
    if (now < new Date(exam.start_time)) {
        showToast(`Exam starts on ${formatDate(exam.start_time)}`, 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    if (now > new Date(exam.end_time)) {
        showToast('Exam has ended', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    
    let { data: qs } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId);
    
    if (!qs?.length) {
        showToast('No questions available', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    
    qs = qs.sort(() => Math.random() - 0.5);
    if (exam.total_questions_to_show && exam.total_questions_to_show < qs.length) {
        qs = qs.slice(0, exam.total_questions_to_show);
    }
    
    examData = exam;
    questions = qs;
    userAnswers = {};
    startTime = new Date();
    
    showLoading(false);
    renderExam();
    startTimer(exam.duration * 60);
}

function startTimer(duration) {
    if (timerInterval) clearInterval(timerInterval);
    let timeLeft = duration;
    
    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitExam();
        } else {
            timeLeft--;
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = formatTime(timeLeft);
                if (timeLeft < 300) timerEl.classList.add('timer-warning', 'text-red-600');
            }
        }
    }, 1000);
}

function renderExam() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sticky-timer bg-white shadow-lg rounded-lg mb-6 p-4">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-bold">${escapeHtml(examData.title)}</h2>
                    <p class="text-sm text-gray-600">${escapeHtml(examData.description || '')}</p>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-600">Time Remaining</div>
                    <div id="timer" class="text-3xl font-mono font-bold text-blue-600">${formatTime(examData.duration * 60)}</div>
                </div>
            </div>
        </div>
        
        <div class="space-y-4 mb-24">
            ${questions.map((q, idx) => `
                <div class="question-card bg-white rounded-xl shadow-md p-6" data-qid="${q.id}">
                    <div class="mb-4">
                        <h3 class="font-semibold">Question ${idx + 1}</h3>
                        <p class="mt-2">${escapeHtml(q.question_text)}</p>
                        ${q.image_url ? `<img src="${q.image_url}" class="mt-3 max-w-full rounded-lg max-h-48">` : ''}
                    </div>
                    <div class="space-y-2">
                        ${['a', 'b', 'c', 'd'].map(opt => `
                            <button class="option-btn w-full text-left p-3 rounded-lg border border-gray-300 hover:bg-gray-50" data-opt="${opt}">
                                <span class="font-semibold inline-block w-8">${opt.toUpperCase()}.</span>
                                ${escapeHtml(q[`option_${opt}`])}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div class="container mx-auto max-w-7xl flex justify-between items-center">
                <div class="text-sm text-gray-600">
                    Answered: <span id="answeredCount">0</span> / ${questions.length}
                </div>
                <button id="submitBtn" class="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">
                    <i class="fas fa-check-circle mr-2"></i>Submit Exam
                </button>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = btn.closest('[data-qid]');
            const qid = card.dataset.qid;
            const opt = btn.dataset.opt;
            userAnswers[qid] = opt;
            
            card.querySelectorAll('.option-btn').forEach(ob => {
                ob.classList.remove('selected', 'bg-blue-100', 'border-blue-500');
                if (ob.dataset.opt === opt) {
                    ob.classList.add('selected', 'bg-blue-100', 'border-blue-500');
                }
            });
            
            document.getElementById('answeredCount').textContent = Object.keys(userAnswers).length;
        });
    });
    
    document.getElementById('submitBtn').addEventListener('click', () => {
        if (confirm('Submit exam?')) submitExam();
    });
}

async function submitExam() {
    if (timerInterval) clearInterval(timerInterval);
    showLoading(true);
    
    const timeTaken = Math.floor((new Date() - startTime) / 1000);
    let correct = 0, wrong = 0, skipped = 0;
    
    questions.forEach(q => {
        const answer = userAnswers[q.id];
        if (!answer) skipped++;
        else if (answer === q.correct_answer) correct++;
        else wrong++;
    });
    
    const total = questions.length;
    const percentage = (correct / total * 100).toFixed(2);
    const score = (correct * examData.marks_per_question) + (wrong * examData.negative_mark_per_wrong);
    
    const { error } = await supabase.from('results').insert({
        user_id: currentUser.id,
        exam_id: examData.id,
        score: score,
        correct_count: correct,
        wrong_count: wrong,
        time_taken: timeTaken,
        answers: userAnswers
    });
    
    showLoading(false);
    
    if (error) {
        showToast('Error: ' + error.message, 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-xl shadow-xl overflow-hidden">
                <div class="bg-gradient-to-r from-green-500 to-blue-600 p-8 text-white text-center">
                    <i class="fas fa-check-circle text-6xl mb-4"></i>
                    <h1 class="text-3xl font-bold">Exam Completed!</h1>
                </div>
                <div class="p-8">
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="text-center p-4 bg-gray-50 rounded"><div class="text-3xl font-bold text-blue-600">${score}</div><div class="text-sm">Score</div></div>
                        <div class="text-center p-4 bg-gray-50 rounded"><div class="text-3xl font-bold text-green-600">${percentage}%</div><div class="text-sm">Percentage</div></div>
                    </div>
                    <div class="space-y-3 mb-6">
                        <div class="flex justify-between p-3 bg-green-50 rounded"><span>✅ Correct</span><span class="font-bold">${correct}</span></div>
                        <div class="flex justify-between p-3 bg-red-50 rounded"><span>❌ Wrong</span><span class="font-bold">${wrong}</span></div>
                        <div class="flex justify-between p-3 bg-yellow-50 rounded"><span>⏭️ Skipped</span><span class="font-bold">${skipped}</span></div>
                        <div class="flex justify-between p-3 bg-gray-50 rounded"><span>⏱️ Time</span><span class="font-bold">${formatTime(timeTaken)}</span></div>
                    </div>
                    <button onclick="window.location.href='dashboard.html'" class="w-full bg-blue-600 text-white py-3 rounded-lg">Back to Dashboard</button>
                </div>
            </div>
        </div>
    `;
}

window.checkAuthAndStartExam = checkAuthAndStartExam;
