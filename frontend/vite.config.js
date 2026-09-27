import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 /api 요청을 Spring Boot 백엔드로 전달한다. (백엔드 CORS 설정 불필요)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
