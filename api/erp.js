export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    const searchParams = req.url.split('?')[1] || '';
    const erpUrl = 'https://newerp.kluniversity.in/index.php' + (searchParams ? '?' + searchParams : '');

    try {
        const rawBody = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRawBody(req);

        const fetchOptions = {
            method: req.method,
            headers: {
                ...req.headers,
                host: 'newerp.kluniversity.in',
                origin: 'https://newerp.kluniversity.in',
                referer: 'https://newerp.kluniversity.in/',
            },
            body: rawBody,
            redirect: 'manual'
        };

        // Retain client IP to stabilize KL ERP's PHP session tracker and prevent forced logouts
        const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '192.168.1.1';
        fetchOptions.headers['x-forwarded-for'] = clientIp;

        // Remove headers that cause issues
        delete fetchOptions.headers['connection'];
        delete fetchOptions.headers['content-length'];
        delete fetchOptions.headers['accept-encoding'];
        delete fetchOptions.headers['x-forwarded-host'];
        delete fetchOptions.headers['x-forwarded-proto'];

        const response = await fetch(erpUrl, fetchOptions);

        res.status(response.status);

        const headersArray = Array.from(response.headers.entries());
        for (const [key, value] of headersArray) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'content-encoding' || lowerKey === 'content-length') {
                continue; // fetch already decompresses the body, let Vercel handle recompressing and length
            }
            if (lowerKey === 'set-cookie') {
                const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [value];
                const rewrittenCookies = setCookies.map(cookie => {
                    let newCookie = cookie.replace(/Domain=[^;]+;?/gi, '');
                    // Force rigorous SameSite and Secure to bypass Chrome's strict privacy drops
                    if (!newCookie.includes('SameSite')) newCookie += '; SameSite=None';
                    if (!newCookie.includes('Secure')) newCookie += '; Secure';
                    return newCookie;
                });
                res.setHeader('Set-Cookie', rewrittenCookies);
            } else {
                res.setHeader(key, value);
            }
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);

    } catch (error) {
        console.error('ERP Proxy Error:', error);
        res.status(500).json({ error: 'Failed to communicate with ERP', details: error.message });
    }
}
