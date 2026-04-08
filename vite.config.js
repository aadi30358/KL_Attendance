import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/index.php': {
        target: 'https://newerp.kluniversity.in',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { "*": "" }, // Crucial for session cookies to be saved locally regardless of IP/localhost
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('origin', 'https://newerp.kluniversity.in');
            proxyReq.setHeader('referer', 'https://newerp.kluniversity.in/');
            // Forward IP to simulate real requester
            const clientIp = req.socket?.remoteAddress || '192.168.1.1';
            proxyReq.setHeader('x-forwarded-for', clientIp);
          });
        }
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
