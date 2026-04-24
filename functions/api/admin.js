async function isAdmin(env, userId) {
    const stmt = await env.DB.prepare(
        "SELECT role FROM user_roles WHERE user_id = ?"
    ).bind(userId).all();
    
    return stmt.results[0]?.role === 'admin';
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Verify admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    
    const SUPABASE_URL = 'https://noekogokjjptosipfile.supabase.co';
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!supabaseRes.ok) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    }
    
    const user = await supabaseRes.json();
    const admin = await isAdmin(env, user.id);
    
    if (!admin) {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 });
    }
    
    // GET - Stats
    if (request.method === 'GET' && url.pathname === '/api/admin/stats') {
        const articlesTotal = await env.DB.prepare("SELECT COUNT(*) as count FROM articles").all();
        const articlesPublished = await env.DB.prepare("SELECT COUNT(*) as count FROM articles WHERE is_published = 1").all();
        const usersTotal = await env.DB.prepare("SELECT COUNT(*) as count FROM user_profiles").all();
        const activeSubs = await env.DB.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").all();
        
        return new Response(JSON.stringify({
            total_articles: articlesTotal.results[0].count,
            published_articles: articlesPublished.results[0].count,
            total_users: usersTotal.results[0].count,
            active_subscriptions: activeSubs.results[0].count
        }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // GET - All articles
    if (request.method === 'GET' && url.pathname === '/api/admin/articles') {
        const stmt = await env.DB.prepare(
            "SELECT * FROM articles ORDER BY created_at DESC"
        ).all();
        
        return new Response(JSON.stringify(stmt.results), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // POST - Create/Update article
    if (request.method === 'POST' && url.pathname === '/api/admin/articles') {
        const { id, title, slug, content, excerpt, image_url, is_free, is_published } = await request.json();
        
        const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        if (id) {
            // Update
            await env.DB.prepare(
                `UPDATE articles SET title = ?, slug = ?, content = ?, excerpt = ?, 
                 image_url = ?, is_free = ?, is_published = ? WHERE id = ?`
            ).bind(title, finalSlug, content, excerpt, image_url, is_free ? 1 : 0, is_published ? 1 : 0, id).run();
        } else {
            // Insert
            await env.DB.prepare(
                `INSERT INTO articles (title, slug, content, excerpt, image_url, is_free, is_published) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(title, finalSlug, content, excerpt, image_url, is_free ? 1 : 0, is_published ? 1 : 0).run();
        }
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // DELETE - Article
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/admin/articles/')) {
        const id = url.pathname.split('/').pop();
        await env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // GET - All users
    if (request.method === 'GET' && url.pathname === '/api/admin/users') {
        const profiles = await env.DB.prepare("SELECT * FROM user_profiles").all();
        const roles = await env.DB.prepare("SELECT * FROM user_roles").all();
        const subs = await env.DB.prepare("SELECT user_id, status FROM subscriptions WHERE status = 'active'").all();
        
        const roleMap = {};
        roles.results.forEach(r => { roleMap[r.user_id] = r.role; });
        const subMap = {};
        subs.results.forEach(s => { subMap[s.user_id] = true; });
        
        const users = profiles.results.map(p => ({
            ...p,
            role: roleMap[p.user_id] || 'user',
            is_premium: !!subMap[p.user_id]
        }));
        
        return new Response(JSON.stringify(users), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // POST - Make admin
    if (request.method === 'POST' && url.pathname === '/api/admin/make-admin') {
        const { user_id } = await request.json();
        
        await env.DB.prepare(
            "INSERT OR REPLACE INTO user_roles (user_id, role) VALUES (?, 'admin')"
        ).bind(user_id).run();
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // GET - All subscriptions
    if (request.method === 'GET' && url.pathname === '/api/admin/subscriptions') {
        const stmt = await env.DB.prepare(
            "SELECT s.*, p.full_name FROM subscriptions s LEFT JOIN user_profiles p ON s.user_id = p.user_id ORDER BY s.created_at DESC"
        ).all();
        
        return new Response(JSON.stringify(stmt.results), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // POST - Create/Update subscription
    if (request.method === 'POST' && url.pathname === '/api/admin/subscriptions') {
        const { id, user_id, plan, amount, status, end_date, notes } = await request.json();
        
        if (id) {
            await env.DB.prepare(
                `UPDATE subscriptions SET plan = ?, amount = ?, status = ?, end_date = ?, notes = ? WHERE id = ?`
            ).bind(plan, amount, status, end_date, notes, id).run();
        } else {
            await env.DB.prepare(
                `INSERT INTO subscriptions (user_id, plan, amount, status, end_date, notes) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(user_id, plan, amount, status, end_date, notes).run();
        }
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // DELETE - Subscription
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/admin/subscriptions/')) {
        const id = url.pathname.split('/').pop();
        await env.DB.prepare("DELETE FROM subscriptions WHERE id = ?").bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response('Not found', { status: 404 });
}
