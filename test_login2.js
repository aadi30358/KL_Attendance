import fetch from 'node-fetch';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

async function test() {
    const r1 = await fetch('https://newerp.kluniversity.in/index.php');
    const h1 = await r1.text();
    const d1 = new JSDOM(h1).window.document;

    // Try to find the captcha image or input
    const captchaImg = d1.querySelector('#loginform-captcha-image');
    const captchaInput = d1.querySelector('#loginform-captcha');
    console.log('Captcha Image exists:', !!captchaImg);
    console.log('Captcha Input exists:', !!captchaInput);

    const csrf = d1.querySelector('meta[name="csrf-token"]').getAttribute('content');
    const cookies = r1.headers.raw()['set-cookie'] || [];

    console.log('Submitting login without captcha...');
    const fd = new URLSearchParams();
    fd.append('_csrf', csrf);
    fd.append('LoginForm[username]', '2300030000');
    fd.append('LoginForm[password]', 'WrongPassword123');
    fd.append('LoginForm[rememberMe]', '0');
    fd.append('login-button', '');

    const r2 = await fetch('https://newerp.kluniversity.in/index.php?r=site%2Flogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies.map(c => c.split(';')[0]).join('; ') },
        body: fd
    });
    const h2 = await r2.text();
    const d2 = new JSDOM(h2).window.document;

    const cErr = d2.querySelector('.field-loginFormCaptcha .help-block');
    console.log('Captcha Error:', cErr ? cErr.textContent.trim() : 'NONE');

    const pwdErr = d2.querySelector('.field-loginform-password .help-block');
    console.log('Pwd Error:', pwdErr ? pwdErr.textContent.trim() : 'NONE');
}
test();
