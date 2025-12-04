import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 检查 ipcRenderer 是否可用
console.log('[Renderer] 检查 window.ipcRenderer:', typeof window !== 'undefined' ? (window as any).ipcRenderer : 'window 未定义')
if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
  console.log('[Renderer] window.ipcRenderer 已可用')
} else {
  console.warn('[Renderer] window.ipcRenderer 不可用，请检查 preload 脚本')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

