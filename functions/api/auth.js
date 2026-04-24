// Supabase auth helper for D1
const SUPABASE_URL = 'https://noekogokjjptosipfile.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TQRMwY2EqtZgAoyMqcSrlw_2TxPE7Lk';

export async function onRequest(context) {
    const { request, env } = context;
    
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
    
    const url = new URL(request.url);
    
    // Get user profile
    if (request.method === 'GET' && url.pathname === '/api/auth/profile') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No token' }), { status: 401 });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        // Verify token with Supabase
        const supabaseRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!supabaseRes.ok) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
        }
        
        const supabaseUser = await supabaseRes.json();
        
        // Get user role from D1
        const roleStmt = await env.DB.prepare(
            "SELECT role FROM user_roles WHERE user_id = ?"
        ).bind(supabaseUser.id).all();
        
        const role = roleStmt.results[0]?.role || 'user';
        
        // Get subscription from D1
        const subStmt = await env.DB.prepare(
            "SELECT plan, status, end_date FROM subscriptions WHERE user_id = ? AND status = 'active'"
        ).bind(supabaseUser.id).all();
        
        const subscription = subStmt.results[0] || null;
        
        // Get profile from D1
        const profileStmt = await env.DB.prepare(
            "SELECT full_name FROM user_profiles WHERE user_id = ?"
        ).bind(supabaseUser.id).all();
        
        return new Response(JSON.stringify({
            id: supabaseUser.id,
            email: supabaseUser.email,
            role: role,
            subscription: subscription,
            full_name: profileStmt.results[0]?.full_name || null
        }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
    
    // Sync user profile after signup
    if (request.method === 'POST' && url.pathname === '/api/auth/sync') {
        const { user_id, email, full_name } = await request.json();
        
        // Check if profile exists
        const checkStmt = await env.DB.prepare(
            "SELECT user_id FROM user_profiles WHERE user_id = ?"
        ).bind(user_id).all();
        
        if (checkStmt.results.length === 0) {
            await env.DB.prepare(
                "INSERT INTO user_profiles (user_id, full_name, email) VALUES (?, ?, ?)"
            ).bind(user_id, full_name, email).run();
            
            await env.DB.prepare(
                "INSERT INTO user_roles (user_id, role) VALUES (?, 'user')"
            ).bind(user_id).run();
        }
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
    
    return new Response('Not found', { status: 404 });
}
