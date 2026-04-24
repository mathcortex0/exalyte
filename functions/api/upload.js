const IMGBB_API_KEY = '5eedf24deee3528bc34e811052972c74';

export async function onRequest(context) {
    const { request } = context;
    
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }
    
    const formData = await request.formData();
    const file = formData.get('image');
    
    if (!file) {
        return new Response(JSON.stringify({ error: 'No file' }), { status: 400 });
    }
    
    const imgBBFormData = new FormData();
    imgBBFormData.append('image', file);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: imgBBFormData
    });
    
    const result = await response.json();
    
    if (result.success) {
        return new Response(JSON.stringify({ url: result.data.url }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } else {
        return new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500 });
    }
}
