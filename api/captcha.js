import svgCaptcha from 'svg-captcha';

// Simple in-memory store for captcha answers
const captchaStore = new Map();

export default function handler(req, res) {
  try {
    const captcha = svgCaptcha.create({
      size: 5,
      noise: 2,
      color: true,
      background: '#f5f5f5'
    });
    
    // Generate a unique ID for this captcha
    const captchaId = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the captcha answer (expire after 5 minutes)
    captchaStore.set(captchaId, captcha.text.toLowerCase());
    setTimeout(() => captchaStore.delete(captchaId), 5 * 60 * 1000);
    
    // Send SVG with proper content type
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('X-Captcha-ID', captchaId);
    res.status(200).send(captcha.data);
  } catch (error) {
    console.error('Captcha generation error:', error);
    res.status(500).json({ error: 'Failed to generate captcha' });
  }
}
