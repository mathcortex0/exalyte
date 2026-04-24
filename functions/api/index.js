export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };
    
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // TEST
    if (url.pathname === '/api/test') {
        return new Response(JSON.stringify({ ok: true, db: !!env.DB }), { headers });
    }
    
    // SIGNUP
    if (request.method === 'POST' && url.pathname === '/api/signup') {
        try {
            const { name, email, password } = await request.json();
            const hashed = await hashPassword(password);
            await env.DB.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').bind(name, email, hashed).run();
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400, headers });
        }
    }
    
    // LOGIN
    if (request.method === 'POST' && url.pathname === '/api/login') {
        try {
            const { email, password } = await request.json();
            const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();
            if (user.results.length === 0) return new Response(JSON.stringify({ error: 'User not found' }), { status: 401, headers });
            
            const hashed = await hashPassword(password);
            if (hashed !== user.results[0].password) return new Response(JSON.stringify({ error: 'Wrong password' }), { status: 401, headers });
            
            return new Response(JSON.stringify({ success: true, user: { id: user.results[0].id, name: user.results[0].name, email: user.results[0].email, is_admin: user.results[0].is_admin || 0 } }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }
    
    // GET EXAMS
    if (request.method === 'GET' && url.pathname === '/api/exams') {
        const exams = await env.DB.prepare('SELECT * FROM exams').all();
        return new Response(JSON.stringify(exams.results), { headers });
    }
    
    // GET SINGLE EXAM
    if (request.method === 'GET' && url.pathname.startsWith('/api/exam/')) {
        const id = url.pathname.split('/').pop();
        const exam = await env.DB.prepare('SELECT * FROM exams WHERE id = ?').bind(id).all();
        const questions = await env.DB.prepare('SELECT * FROM questions WHERE exam_id = ?').bind(id).all();
        return new Response(JSON.stringify({ exam: exam.results[0], questions: questions.results }), { headers });
    }
    
    // SUBMIT EXAM
    if (request.method === 'POST' && url.pathname.match(/\/api\/exam\/\d+\/submit/)) {
        const examId = url.pathname.split('/')[3];
        const { user_id, answers } = await request.json();
        const questions = await env.DB.prepare('SELECT id, correct_answer FROM questions WHERE exam_id = ?').bind(examId).all();
        
        let score = 0;
        for (const q of questions.results) {
            if (answers[q.id] === q.correct_answer) score++;
        }
        const percentage = (score / questions.results.length) * 100;
        
        await env.DB.prepare('INSERT INTO exam_attempts (user_id, exam_id, score, total_questions, percentage, answers, submitted_at, is_completed) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)')
            .bind(user_id, examId, score, questions.results.length, percentage, JSON.stringify(answers)).run();
        
        return new Response(JSON.stringify({ score, total: questions.results.length, percentage }), { headers });
    }
    
    // ADMIN CREATE EXAM
    if (request.method === 'POST' && url.pathname === '/api/admin/exam') {
        const { name, description, time_limit, is_premium } = await request.json();
        const result = await env.DB.prepare('INSERT INTO exams (name, description, time_limit, is_premium) VALUES (?, ?, ?, ?)').bind(name, description, time_limit, is_premium).run();
        return new Response(JSON.stringify({ success: true, exam_id: result.meta.last_row_id }), { headers });
    }
    
    // ADMIN UPLOAD CSV
    if (request.method === 'POST' && url.pathname === '/api/admin/upload-csv') {
        const formData = await request.formData();
        const examId = formData.get('exam_id');
        const csvFile = formData.get('csv_file');
        const csvText = await csvFile.text();
        const lines = csvText.trim().split('\n');
        
        let inserted = 0;
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 6) continue;
            await env.DB.prepare('INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(examId, parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6] || '').run();
            inserted++;
        }
        return new Response(JSON.stringify({ success: true, inserted }), { headers });
    }
    
    // ADMIN DELETE EXAM
    if (request.method === 'DELETE' && url.pathname.match(/\/api\/admin\/exam\/\d+/)) {
        const id = url.pathname.split('/').pop();
        await env.DB.prepare('DELETE FROM exam_attempts WHERE exam_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM premium_access WHERE exam_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM questions WHERE exam_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM exams WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}
