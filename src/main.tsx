import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import OwnerDesktopApp from './OwnerDesktopApp.tsx'

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('root elementi bulunamadı')
}

const isOwnerPanel =
  window.location.hash === '#owner' ||
  new URLSearchParams(window.location.search).get('mode') === 'owner'

try {
  createRoot(rootEl).render(
    <StrictMode>{isOwnerPanel ? <OwnerDesktopApp /> : <App />}</StrictMode>,
  )
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  rootEl.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#b91c1c">
    <h1>Uygulama açılamadı</h1>
    <p>${message}</p>
  </div>`
  console.error(err)
}
