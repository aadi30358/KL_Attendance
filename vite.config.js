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
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-generator';
            }
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-icons';
            }
            if (id.includes('recharts')) {
              return 'recharts';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
