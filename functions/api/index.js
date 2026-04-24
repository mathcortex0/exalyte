export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };
    
    // TEST ROUTE - put this FIRST
    if (url.pathname === '/api/test') {
        return new Response(JSON.stringify({ 
            message: 'API is working!', 
            db: !!env.DB 
        }), { headers });
    }
    
    // SIMPLE LOGIN FOR TESTING
    if (request.method === 'POST' && url.pathname === '/api/login') {
        try {
            const { email, password } = await request.json();
            
            const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();
            
            if (user.results.length === 0) {
                return new Response(JSON.stringify({ error: 'User not found' }), { status: 401, headers });
            }
            
            const userData = user.results[0];
            
            // Simple hash for testing
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest('SHA-256', data);
            const hashedInput = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
            
            if (hashedInput !== userData.password) {
                return new Response(JSON.stringify({ error: 'Wrong password' }), { status: 401, headers });
            }
            
            return new Response(JSON.stringify({ 
                success: true, 
                user: {
                    id: userData.id,
                    name: userData.name,
                    email: userData.email,
                    is_admin: userData.is_admin
                }
            }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    // SIMPLE SIGNUP
    if (request.method === 'POST' && url.pathname === '/api/signup') {
        try {
            const { name, email, password } = await request.json();
            
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest('SHA-256', data);
            const hashedPassword = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
            
            await env.DB.prepare(
                'INSERT INTO users (name, email, password, is_admin, is_premium_allowed) VALUES (?, ?, ?, 0, 0)'
            ).bind(name, email, hashedPassword).run();
            
            return new Response(JSON.stringify({ success: true }), { headers });
            
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}
