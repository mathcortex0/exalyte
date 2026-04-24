export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }
    
    // ========== HELPER: HASH PASSWORD ==========
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // ========== HELPER: CHECK ADMIN ==========
    async function isAdmin(authHeader) {
        if (!authHeader) return false;
        try {
            const userData = JSON.parse(authHeader);
            const user = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(userData.id).all();
            return user.results.length > 0 && user.results[0].is_admin === 1;
        } catch {
            return false;
        }
    }
    
    // ========== SIGNUP ==========
    if (request.method === 'POST' && url.pathname === '/api/signup') {
        try {
            const { name, email, password } = await request.json();
            
            if (!name || !email || !password) {
                return new Response(JSON.stringify({ error: 'All fields required' }), { status: 400, headers });
            }
            
            if (password.length < 4) {
                return new Response(JSON.stringify({ error: 'Password must be at least 4 characters' }), { status: 400, headers });
            }
            
            const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).all();
            if (existing.results.length > 0) {
                return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 400, headers });
            }
            
            const hashedPassword = await hashPassword(password);
            
            await env.DB.prepare(
                'INSERT INTO users (name, email, password, is_admin, is_premium_allowed) VALUES (?, ?, ?, 0, 0)'
            ).bind(name, email, hashedPassword).run();
            
            const user = await env.DB.prepare('SELECT id, name, email, is_admin, is_premium_allowed FROM users WHERE email = ?').bind(email).all();
            
            return new Response(JSON.stringify({ 
                success: true, 
                user: user.results[0]
            }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== LOGIN ==========
    if (request.method === 'POST' && url.pathname === '/api/login') {
        try {
            const { email, password } = await request.json();
            
            const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();
            
            if (user.results.length === 0) {
                return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers });
            }
            
            const userData = user.results[0];
            const hashedInput = await hashPassword(password);
            
            if (hashedInput !== userData.password) {
                return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers });
            }
            
            return new Response(JSON.stringify({ 
                success: true, 
                user: {
                    id: userData.id,
                    name: userData.name,
                    email: userData.email,
                    is_admin: userData.is_admin,
                    is_premium_allowed: userData.is_premium_allowed
                }
            }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== CHANGE PASSWORD ==========
    if (request.method === 'POST' && url.pathname === '/api/change-password') {
        try {
            const { userId, oldPassword, newPassword } = await request.json();
            
            const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).all();
            
            if (user.results.length === 0) {
                return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
            }
            
            const hashedOld = await hashPassword(oldPassword);
            if (hashedOld !== user.results[0].password) {
                return new Response(JSON.stringify({ error: 'Old password is incorrect' }), { status: 401, headers });
            }
            
            const hashedNew = await hashPassword(newPassword);
            await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashedNew, userId).run();
            
            return new Response(JSON.stringify({ success: true }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== GET ALL EXAMS ==========
    if (request.method === 'GET' && url.pathname === '/api/exams') {
        try {
            const authHeader = request.headers.get('X-User-Data');
            let userId = null;
            let isAdminUser = false;
            
            if (authHeader) {
                try {
                    const userData = JSON.parse(authHeader);
                    userId = userData.id;
                    isAdminUser = userData.is_admin === 1;
                } catch (e) {}
            }
            
            let exams;
            
            if (isAdminUser) {
                exams = await env.DB.prepare('SELECT * FROM exams ORDER BY created_at DESC').all();
            } else {
                exams = await env.DB.prepare(`
                    SELECT DISTINCT e.*, 
                        CASE WHEN e.is_premium = 0 THEN 1
                             WHEN pa.user_id IS NOT NULL THEN 1
                             ELSE 0 END as can_access
                    FROM exams e
                    LEFT JOIN premium_access pa ON e.id = pa.exam_id AND pa.user_id = ?
                    WHERE e.is_premium = 0 OR pa.user_id IS NOT NULL
                    ORDER BY e.created_at DESC
                `).bind(userId || 0).all();
            }
            
            return new Response(JSON.stringify(exams.results), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify([]), { headers });
        }
    }
    
    // ========== GET SINGLE EXAM WITH QUESTIONS ==========
    if (request.method === 'GET' && url.pathname.match(/\/api\/exam\/\d+$/)) {
        try {
            const examId = url.pathname.split('/').pop();
            const authHeader = request.headers.get('X-User-Data');
            
            if (!authHeader) {
                return new Response(JSON.stringify({ error: 'Login required' }), { status: 401, headers });
            }
            
            const userData = JSON.parse(authHeader);
            
            const exam = await env.DB.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).all();
            
            if (exam.results.length === 0) {
                return new Response(JSON.stringify({ error: 'Exam not found' }), { status: 404, headers });
            }
            
            const examData = exam.results[0];
            let canAccess = true;
            
            if (examData.is_premium === 1) {
                const access = await env.DB.prepare(
                    'SELECT * FROM premium_access WHERE user_id = ? AND exam_id = ?'
                ).bind(userData.id, examId).all();
                canAccess = access.results.length > 0;
                
                if (!canAccess && userData.is_admin !== 1) {
                    return new Response(JSON.stringify({ error: 'Premium access required. Contact admin.' }), { status: 403, headers });
                }
            }
            
            const questions = await env.DB.prepare(
                'SELECT id, question_text, option_a, option_b, option_c, option_d, image_url FROM questions WHERE exam_id = ? ORDER BY id'
            ).bind(examId).all();
            
            return new Response(JSON.stringify({
                exam: examData,
                questions: questions.results
            }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== SUBMIT EXAM ==========
    if (request.method === 'POST' && url.pathname.match(/\/api\/exam\/\d+\/submit$/)) {
        try {
            const examId = url.pathname.split('/')[3];
            const { user_id, answers } = await request.json();
            
            const questions = await env.DB.prepare('SELECT id, correct_answer FROM questions WHERE exam_id = ?').bind(examId).all();
            
            let score = 0;
            const totalQuestions = questions.results.length;
            
            for (const q of questions.results) {
                if (answers[q.id] && answers[q.id] === q.correct_answer) {
                    score++;
                }
            }
            
            const percentage = (score / totalQuestions) * 100;
            
            await env.DB.prepare(`
                INSERT INTO exam_attempts (user_id, exam_id, score, total_questions, percentage, answers, submitted_at, is_completed)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
            `).bind(user_id, examId, score, totalQuestions, percentage, JSON.stringify(answers)).run();
            
            return new Response(JSON.stringify({
                success: true,
                score: score,
                total: totalQuestions,
                percentage: percentage
            }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== ADMIN: GET ALL USERS ==========
    if (request.method === 'GET' && url.pathname === '/api/admin/users') {
        try {
            const authHeader = request.headers.get('X-Admin-Data');
            if (!await isAdmin(authHeader)) {
                return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
            }
            
            const users = await env.DB.prepare('SELECT id, name, email, is_admin, is_premium_allowed, created_at FROM users').all();
            return new Response(JSON.stringify(users.results), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== ADMIN: GRANT PREMIUM ACCESS ==========
    if (request.method === 'POST' && url.pathname === '/api/admin/grant-premium') {
        try {
            const authHeader = request.headers.get('X-Admin-Data');
            if (!await isAdmin(authHeader)) {
                return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
            }
            
            const { user_id, exam_id } = await request.json();
            const adminData = JSON.parse(authHeader);
            
            // Check if already exists
            const existing = await env.DB.prepare('SELECT id FROM premium_access WHERE user_id = ? AND exam_id = ?').bind(user_id, exam_id).all();
            if (existing.results.length === 0) {
                await env.DB.prepare(
                    'INSERT INTO premium_access (user_id, exam_id, granted_by) VALUES (?, ?, ?)'
                ).bind(user_id, exam_id, adminData.id).run();
            }
            
            return new Response(JSON.stringify({ success: true }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== ADMIN: CREATE EXAM ==========
    if (request.method === 'POST' && url.pathname === '/api/admin/exam') {
        try {
            const authHeader = request.headers.get('X-Admin-Data');
            if (!await isAdmin(authHeader)) {
                return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
            }
            
            const { name, description, time_limit, is_premium } = await request.json();
            
            const result = await env.DB.prepare(
                'INSERT INTO exams (name, description, time_limit, is_premium) VALUES (?, ?, ?, ?)'
            ).bind(name, description || '', time_limit || 1800, is_premium || 0).run();
            
            return new Response(JSON.stringify({ success: true, exam_id: result.meta.last_row_id }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== ADMIN: UPLOAD CSV ==========
    if (request.method === 'POST' && url.pathname === '/api/admin/upload-csv') {
        try {
            const authHeader = request.headers.get('X-Admin-Data');
            if (!await isAdmin(authHeader)) {
                return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
            }
            
            const formData = await request.formData();
            const examId = formData.get('exam_id');
            const csvFile = formData.get('csv_file');
            const csvText = await csvFile.text();
            
            const lines = csvText.trim().split('\n');
            
            let inserted = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = [];
                let inQuote = false;
                let current = '';
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        inQuote = !inQuote;
                    } else if (char === ',' && !inQuote) {
                        values.push(current);
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current);
                
                if (values.length < 6) continue;
                
                const question_text = values[0];
                const option_a = values[1];
                const option_b = values[2];
                const option_c = values[3];
                const option_d = values[4];
                const correct_answer = values[5];
                const image_url = values[6] || '';
                
                if (!question_text) continue;
                
                await env.DB.prepare(`
                    INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(examId, question_text, option_a, option_b, option_c, option_d, correct_answer, image_url).run();
                
                inserted++;
            }
            
            return new Response(JSON.stringify({ success: true, inserted: inserted }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== ADMIN: GET RESULTS ==========
    if (request.method === 'GET' && url.pathname === '/api/admin/results') {
        try {
            const authHeader = request.headers.get('X-Admin-Data');
            if (!await isAdmin(authHeader)) {
                return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
            }
            
            const results = await env.DB.prepare(`
                SELECT a.*, u.name as user_name, u.email, e.name as exam_name
                FROM exam_attempts a
                JOIN users u ON a.user_id = u.id
                JOIN exams e ON a.exam_id = e.id
                ORDER BY a.submitted_at DESC
            `).all();
            
            return new Response(JSON.stringify(results.results), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== ADMIN: DELETE EXAM ==========
    if (request.method === 'DELETE' && url.pathname.match(/\/api\/admin\/exam\/\d+$/)) {
        try {
            const authHeader = request.headers.get('X-Admin-Data');
            if (!await isAdmin(authHeader)) {
                return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
            }
            
            const examId = url.pathname.split('/').pop();
            
            await env.DB.prepare('DELETE FROM exam_attempts WHERE exam_id = ?').bind(examId).run();
            await env.DB.prepare('DELETE FROM premium_access WHERE exam_id = ?').bind(examId).run();
            await env.DB.prepare('DELETE FROM questions WHERE exam_id = ?').bind(examId).run();
            await env.DB.prepare('DELETE FROM exams WHERE id = ?').bind(examId).run();
            
            return new Response(JSON.stringify({ success: true }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // ========== TEST ROUTE ==========
    if (request.method === 'GET' && url.pathname === '/api/test') {
        return new Response(JSON.stringify({ message: 'API is working!', db: !!env.DB }), { headers });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}
