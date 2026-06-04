import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service worker: register ONLY in production builds. In dev it must never
// run — its cache-first handler intercepts Vite's dependency chunks and HMR
// client, which can serve stale/duplicate React copies ("Invalid hook call")
// and break HMR. In dev we instead actively tear down any SW + caches left
// over from a previous session.
if (import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('Service worker registration failed:', err))
    })
  }
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    let hadController = false
    for (const reg of regs) {
      hadController = true
      reg.unregister()
    }
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
    }
    // If a SW was controlling this page, its cached chunks are already loaded —
    // reload once to pull everything fresh from the dev server.
    if (hadController || navigator.serviceWorker.controller) {
      window.location.reload()
    }
  })
}
