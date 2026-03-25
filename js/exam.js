// Exam Functions

async function startExam(examId) {
    showLoading(true);
    
    try {
        // Check if already taken
        const { data: existing, error: existingError } = await supabase
            .from('results')
            .select('id')
            .eq('user_id', window.currentUser.id)
            .eq('exam_id', examId)
            .single();
        
        if (existing) {
            showToast('You have already taken this exam!', 'error');
            showLoading(false);
            return;
        }
        
        // Get exam details
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();
        
        if (examError || !exam) {
            showToast('Exam not found', 'error');
            showLoading(false);
            return;
        }
        
        // Check paid access
        if (exam.is_paid) {
            const { data: paid, error: paidError } = await supabase
                .from('paid_users')
                .select('*')
                .eq('user_id', window.currentUser.id)
                .eq('exam_id', examId)
                .single();
            
            if (!paid) {
                showToast('This is a premium exam. Please upgrade to access.', 'error');
                showLoading(false);
                return;
            }
        }
        
        // Check exam timing
        const now = new Date();
        const startTime = new Date(exam.start_time);
        const endTime = new Date(exam.end_time);
        
        if (now < startTime) {
            showToast(`Exam starts on ${formatDate(startTime)}`, 'error');
            showLoading(false);
            return;
        }
        
        if (now > endTime) {
            showToast('Exam has ended', 'error');
            showLoading(false);
            return;
        }
        
        // Get questions
        let { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId);
        
        if (questionsError || !questions?.length) {
            showToast('No questions available', 'error');
            showLoading(false);
            return;
        }
        
        // Randomize and limit questions
        questions = questions.sort(() => Math.random() - 0.5);
        if (exam.total_questions_to_show && exam.total_questions_to_show < questions.length) {
            questions = questions.slice(0, exam.total_questions_to_show);
        }
        
        window.currentExam = exam;
        window.currentQuestions = questions;
        window.userAnswers = {};
        window.examStartTime = new Date();
        
        showLoading(false);
        renderExam();
        startExamTimer(exam.duration * 60);
        
    } catch (error) {
        console.error('Error starting exam:', error);
        showToast('Error starting exam: ' + error.message, 'error');
        showLoading(false);
    }
}

function startExamTimer(durationSeconds) {
    if (window.timerInterval) clearInterval(window.timerInterval);
    let timeLeft = durationSeconds;
    
    window.timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(window.timerInterval);
            submitExam();
        } else {
            timeLeft--;
            const timerEl = document.getElementById('exam-timer');
            if (timerEl) {
                timerEl.textContent = formatTime(timeLeft);
                if (timeLeft < 300) {
                    timerEl.classList.add('timer-warning', 'text-red-600');
                }
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
                    <h2 class="text-xl font-bold text-gray-800">${window.currentExam.title}</h2>
                    <p class="text-sm text-gray-600">${window.currentExam.description || ''}</p>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-600">Time Remaining</div>
                    <div id="exam-timer" class="text-3xl font-mono font-bold text-blue-600">${formatTime(window.currentExam.duration * 60)}</div>
                </div>
            </div>
        </div>
        
        <div class="space-y-4 mb-24" id="questions-container">
            ${window.currentQuestions.map((q, idx) => `
                <div class="question-card bg-white rounded-xl shadow-md p-6" data-qid="${q.id}">
                    <div class="mb-4">
                        <h3 class="font-semibold text-gray-800">Question ${idx + 1}</h3>
                        <p class="text-gray-700 mt-2">${q.question_text}</p>
                        ${q.image_url ? `<img src="${q.image_url}" class="mt-3 max-w-full rounded-lg max-h-48 object-contain">` : ''}
                    </div>
                    <div class="space-y-2">
                        ${['a', 'b', 'c', 'd'].map(opt => `
                            <button class="option-btn w-full text-left p-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition" data-opt="${opt}">
                                <span class="font-semibold inline-block w-8">${opt.toUpperCase()}.</span>
                                ${q[`option_${opt}`]}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div class="container mx-auto max-w-7xl flex justify-between items-center">
                <div class="text-sm text-gray-600">
                    Answered: <span id="answered-count">0</span> / ${window.currentQuestions.length}
                </div>
                <button id="submit-exam-btn" class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition">
                    <i class="fas fa-check-circle mr-2"></i>Submit Exam
                </button>
            </div>
        </div>
    `;
    
    // Attach option click handlers
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = btn.closest('[data-qid]');
            const qid = card.dataset.qid;
            const option = btn.dataset.opt;
            
            window.userAnswers[qid] = option;
            
            // Update UI
            card.querySelectorAll('.option-btn').forEach(optBtn => {
                optBtn.classList.remove('selected', 'bg-blue-100', 'border-blue-500');
                if (optBtn.dataset.opt === option) {
                    optBtn.classList.add('selected', 'bg-blue-100', 'border-blue-500');
                }
            });
            
            document.getElementById('answered-count').textContent = Object.keys(window.userAnswers).length;
        });
    });
    
    document.getElementById('submit-exam-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to submit the exam?')) {
            submitExam();
        }
    });
}

async function submitExam() {
    if (window.timerInterval) clearInterval(window.timerInterval);
    showLoading(true);
    
    const timeTaken = Math.floor((new Date() - window.examStartTime) / 1000);
    let correct = 0, wrong = 0, skipped = 0;
    
    window.currentQuestions.forEach(q => {
        const answer = window.userAnswers[q.id];
        if (!answer) {
            skipped++;
        } else if (answer === q.correct_answer) {
            correct++;
        } else {
            wrong++;
        }
    });
    
    const total = window.currentQuestions.length;
    const percentage = (correct / total * 100).toFixed(2);
    const score = (correct * window.currentExam.marks_per_question) + 
                  (wrong * window.currentExam.negative_mark_per_wrong);
    
    try {
        const { error } = await supabase
            .from('results')
            .insert({
                user_id: window.currentUser.id,
                exam_id: window.currentExam.id,
                score: score,
                correct_count: correct,
                wrong_count: wrong,
                time_taken: timeTaken,
                answers: window.userAnswers
            });
        
        if (error) throw error;
        
        showLoading(false);
        showResult({
            score, percentage, correct, wrong, skipped,
            total, timeTaken
        });
        
    } catch (error) {
        showLoading(false);
        showToast('Error submitting exam: ' + error.message, 'error');
        loadDashboard();
    }
}

function showResult(result) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-xl shadow-xl overflow-hidden">
                <div class="bg-gradient-to-r from-green-500 to-blue-600 p-8 text-white text-center">
                    <i class="fas fa-check-circle text-6xl mb-4"></i>
                    <h1 class="text-3xl font-bold">Exam Completed!</h1>
                    <p class="text-lg mt-2">${window.currentExam.title}</p>
                </div>
                <div class="p-8">
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="text-center p-4 bg-gray-50 rounded-lg">
                            <div class="text-3xl font-bold text-blue-600">${result.score}</div>
                            <div class="text-sm text-gray-600">Total Score</div>
                        </div>
                        <div class="text-center p-4 bg-gray-50 rounded-lg">
                            <div class="text-3xl font-bold text-green-600">${result.percentage}%</div>
                            <div class="text-sm text-gray-600">Percentage</div>
                        </div>
                    </div>
                    
                    <div class="space-y-3 mb-6">
                        <div class="flex justify-between p-3 bg-green-50 rounded-lg">
                            <span><i class="fas fa-check-circle text-green-600 mr-2"></i>Correct</span>
                            <span class="font-bold">${result.correct}</span>
                        </div>
                        <div class="flex justify-between p-3 bg-red-50 rounded-lg">
                            <span><i class="fas fa-times-circle text-red-600 mr-2"></i>Wrong</span>
                            <span class="font-bold">${result.wrong}</span>
                        </div>
                        <div class="flex justify-between p-3 bg-yellow-50 rounded-lg">
                            <span><i class="fas fa-question-circle text-yellow-600 mr-2"></i>Skipped</span>
                            <span class="font-bold">${result.skipped}</span>
                        </div>
                        <div class="flex justify-between p-3 bg-gray-50 rounded-lg">
                            <span><i class="fas fa-clock text-gray-600 mr-2"></i>Time Taken</span>
                            <span class="font-bold">${formatTime(result.timeTaken)}</span>
                        </div>
                    </div>
                    
                    <button id="back-dashboard-btn" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition">
                        <i class="fas fa-home mr-2"></i>Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('back-dashboard-btn').addEventListener('click', loadDashboard);
}

// Export functions
window.startExam = startExam;
