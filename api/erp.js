process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
                // If Vercel parsed the body despite bodyParser: false, rebuild the application/x-www-form-urlencoded
                // string robustly even if it nested objects (e.g. DynamicModel: { academicyear: '19' })
                if (typeof req.body === 'string') {
                    rawBody = req.body;
                } else {
                    const flattenObj = (obj, prefix = '') => {
                        return Object.keys(obj).reduce((acc, k) => {
                            const pre = prefix.length ? prefix + '[' + k + ']' : k;
                            if (typeof obj[k] === 'object' && obj[k] !== null) {
                                Object.assign(acc, flattenObj(obj[k], pre));
                            } else {
                                acc[pre] = obj[k];
                            }
                            return acc;
                        }, {});
                    };
                    const flat = flattenObj(req.body);
                    rawBody = new URLSearchParams(flat).toString();
                }
            } else if (req.body && Buffer.isBuffer(req.body)) {
                rawBody = req.body;
            } else {
                rawBody = await getRawBody(req);
            }
        }

        const allowedHeaders = [
            'cookie', 'user-agent', 'accept', 'accept-language', 
            'content-type', 'x-csrf-token', 'x-requested-with'
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

        // Print debug to terminal to track what Vercel sees before sending
        console.log('Sending ERP Request =', erpUrl);
        console.log('Final Headers =', JSON.stringify(cleanHeaders));
        console.log('Final Body =', Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody);

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
                let setCookies = [];
                if (typeof response.headers.getSetCookie === 'function') {
                    setCookies = response.headers.getSetCookie();
                } else if (response.headers.raw && typeof response.headers.raw === 'function') {
                    setCookies = response.headers.raw()['set-cookie'] || [value];
                } else {
                    // Fallback to split if multiple cookies are joined by comma, ignoring commas inside Expires dates
                    setCookies = value.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
                }

                const rewrittenCookies = setCookies.map(cookie => {
                    let newCookie = cookie.replace(/Domain=[^;]+;?/gi, '');     
                    // Force rigorous SameSite and Secure to bypass Chrome's strict privacy drops
                    if (!newCookie.includes('SameSite')) newCookie += '; SameSite=None';
                    if (!newCookie.includes('Secure')) newCookie += '; Secure'; 
                    return newCookie.trim();
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
