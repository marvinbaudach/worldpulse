import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { isMobileView } from './hooks/useIsMobile.ts'

// Warm the experience chunk for this device right away: App lazy-loads it on
// first render, and without this the fetch would serialize behind the main
// bundle's eval + React boot — one extra roundtrip on a phone's cold start.
// The browser dedupes the dynamic import, so App's lazy() reuses this fetch.
void (isMobileView() ? import('./mobile/MobileApp.tsx') : import('./desktop/DesktopApp.tsx'))

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
