import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// 체험 모드(vite --mode demo)는 어느 정적 호스팅에서도 새로고침이 되도록 HashRouter(주소에 #)를 쓴다.
// 일반 모드는 기존대로 BrowserRouter.
const Router = import.meta.env.MODE === 'demo' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
