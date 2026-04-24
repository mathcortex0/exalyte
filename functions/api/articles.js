export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // GET /api/articles?filter=all&search=xxx
    if (request.method === 'GET') {
        const filter = url.searchParams.get('filter') || 'all';
        const search = url.searchParams.get('search') || '';
        
        let query = "SELECT * FROM articles WHERE is_published = 1";
        
        if (filter === 'free') {
            query += " AND is_free = 1";
        } else if (filter === 'premium') {
            query += " AND is_free = 0";
        }
        
        if (search) {
            query += ` AND title LIKE '%${search}%'`;
        }
        
        query += " ORDER BY created_at DESC";
        
        const stmt = await env.DB.prepare(query).all();
        
        return new Response(JSON.stringify(stmt.results), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
    
    // GET /api/articles?slug=xxx (single article)
    if (request.method === 'GET' && url.searchParams.get('slug')) {
        const slug = url.searchParams.get('slug');
        
        const stmt = await env.DB.prepare(
            "SELECT * FROM articles WHERE slug = ? AND is_published = 1"
        ).bind(slug).all();
        
        if (stmt.results.length === 0) {
            return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        }
        
        const article = stmt.results[0];
        
        // Increment view count
        await env.DB.prepare(
            "UPDATE articles SET view_count = view_count + 1 WHERE id = ?"
        ).bind(article.id).run();
        
        article.view_count = (article.view_count || 0) + 1;
        
        return new Response(JSON.stringify(article), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
    
    return new Response('Method not allowed', { status: 405 });
}
