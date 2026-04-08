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
        let rawBody = undefined;
        if (!['GET', 'HEAD'].includes(req.method)) {
            if (req.body && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
                // If Vercel parsed the body despite bodyParser: false
                if (typeof req.body === 'string') {
                    rawBody = req.body;
                } else {
                    rawBody = new URLSearchParams(req.body).toString();
                }
            } else if (req.body && Buffer.isBuffer(req.body)) {
                rawBody = req.body;
            } else {
                rawBody = await getRawBody(req);
            }
        }

        const allowedHeaders = [
            'cookie', 'user-agent', 'accept', 'accept-language', 
            'content-type', 'content-length', 'x-csrf-token', 'x-requested-with'
        ];
        
        const cleanHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (allowedHeaders.includes(key.toLowerCase())) {
                cleanHeaders[key.toLowerCase()] = value;
            }
        }

        cleanHeaders['host'] = 'newerp.kluniversity.in';
        cleanHeaders['origin'] = 'https://newerp.kluniversity.in';
        cleanHeaders['referer'] = 'https://newerp.kluniversity.in/';
        
        // Retain client IP cleanly without appending multiple
        const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '192.168.1.1';
        cleanHeaders['x-forwarded-for'] = clientIp.split(',')[0].trim();

        const fetchOptions = {
            method: req.method,
            headers: cleanHeaders,
            body: rawBody,
            redirect: 'manual'
        };

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
            } else if (lowerKey === 'location') {
                // Prevent routing to http://newerp... by converting absolute ERP urls to relative paths
                const rewrittenLocation = value.replace(/^https?:\/\/newerp\.kluniversity\.in/i, '');
                res.setHeader('Location', rewrittenLocation.replace(/^http:/i, 'https:'));
            } else {
                const safeValue = typeof value === 'string' ? value.replace(/^http:/i, 'https:') : value;
                res.setHeader(key, safeValue);
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
