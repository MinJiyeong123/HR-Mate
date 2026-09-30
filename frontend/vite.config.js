import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, normalizePath } from 'vite'

const DEMO_MODE = 'demo'
const API_CLIENT = normalizePath(fileURLToPath(new URL('./src/api/client.js', import.meta.url)))
const DEMO_CLIENT = normalizePath(fileURLToPath(new URL('./src/demo/client.js', import.meta.url)))

// 체험 모드에서만: src/api/client.js(백엔드 요청) 를 불러오는 곳에 src/demo/client.js(브라우저 안 처리) 를 대신 연결한다.
// 화면(pages)과 api/*.js 는 고치지 않는다. 일반 모드 빌드에는 이 플러그인이 없으므로 체험 코드가 들어가지 않는다.
function demoClientSwap() {
  return {
    name: 'hr-mate-demo-client-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.endsWith('client')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved && normalizePath(resolved.id) === API_CLIENT) return DEMO_CLIENT
      return null
    },
  }
}

// 체험 모드 빌드에만 넣는 콘텐츠 보안 정책(CSP).
// - 자기 사이트의 스크립트·스타일·이미지만 허용하고, fetch·XHR·WebSocket 등 모든 네트워크 연결(connect-src)을 막는다.
// - <meta> 방식이라 서버 설정 없이 어떤 정적 호스팅에서도 동작한다. (frame-ancestors 등 일부 지시어는 meta 로는 적용되지 않음)
// - 개발 서버(dev:demo)에는 넣지 않는다. 개발 서버는 화면 자동 새로고침에 WebSocket 을 쓰기 때문이다.
export const DEMO_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ')

function demoCsp() {
  return {
    name: 'hr-mate-demo-csp',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: DEMO_CSP }, injectTo: 'head-prepend' }]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === DEMO_MODE) {
    // 체험 모드: 백엔드 프록시 없음(요청이 백엔드로 나갈 길 자체를 두지 않음), 빌드 결과는 dist-demo 에 따로 둔다.
    return {
      // 상대 경로: 어떤 하위 주소(예: /HR-Mate/)에 올려도 파일을 찾을 수 있다. (주소는 HashRouter 의 # 방식)
      base: './',
      plugins: [react(), demoClientSwap(), demoCsp()],
      build: {
        outDir: 'dist-demo',
        // 모듈 미리 불러오기 보조 코드는 fetch 를 쓰므로 connect-src 'none' 과 부딪힌다. 최신 브라우저는 기본 지원하므로 끈다.
        modulePreload: { polyfill: false },
      },
    }
  }
  return {
    plugins: [react()],
    server: {
      // 개발 중 /api 요청을 Spring Boot 백엔드로 전달한다. (백엔드 CORS 설정 불필요)
      proxy: {
        '/api': 'http://localhost:8080',
      },
    },
  }
})
