const fastify = require('fastify')({ logger: true });
const { chromium } = require('playwright');

// DEFINA SUA CHAVE DE SEGURANÇA AQUI
const MINHA_API_KEY = "SuaChaveSuperSecreta123"; 

fastify.post('/extract', async (request, reply) => {
    // Verifica se a chave enviada no Header 'x-api-key' é válida
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== MINHA_API_KEY) {
        return reply.status(401).send({ error: 'Não autorizado: API Key inválida ou ausente.' });
    }

    const { keyword, city, limit = 10 } = request.body;
    
    if (!keyword || !city) {
        return reply.status(400).send({ error: 'Parâmetros "keyword" e "city" são obrigatórios.' });
    }

    const searchQuery = `${keyword} em ${city}`;
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    
    try {
        const page = await browser.newPage();
        // User Agent para evitar detecção básica
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        await page.goto(url, { waitUntil: 'networkidle' });

        let results = [];
        
        // Loop de extração
        while (results.length < limit) {
            const cards = await page.$$('.Nv2Yp'); 
            
            for (let card of cards) {
                if (results.length >= limit) break;
                
                const data = await card.evaluate(node => {
                    const name = node.querySelector('.qBF1Pd')?.innerText;
                    const rating = node.querySelector('.MW4T7d')?.innerText;
                    const reviews = node.querySelector('.UY7F9')?.innerText?.replace(/\(|\)/g, '');
                    const address = node.querySelector('.W4Efsd:last-child')?.innerText;
                    
                    return { name, rating, reviews, address };
                });
                
                if (data.name && !results.find(r => r.name === data.name)) {
                    results.push(data);
                }
            }
            
            // Scroll suave para carregar mais
            await page.mouse.wheel(0, 2000);
            await page.waitForTimeout(1500);
            
            const endMessage = await page.$('.HlvSq');
            if (endMessage) break;
        }

        await browser.close();
        return { status: 'success', total: results.length, data: results };

    } catch (error) {
        await browser.close();
        return reply.status(500).send({ error: 'Erro na extração', details: error.message });
    }
});

fastify.listen({ port: 3005, host: '0.0.0.0' }, (err) => {
    if (err) throw err;
    console.log('Servidor de Extração Protegido rodando na porta 3005');
});