import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: register the minimal service worker (install-prompt requirement).
// Relative URL so the GitHub Pages subpath (vite `base: './'`) resolves;
// skipped in dev where a worker would only get in the way.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[pwa] service worker registration failed', err)
    })
  })
}
