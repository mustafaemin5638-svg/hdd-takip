import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('root elementi bulunamadı')
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  rootEl.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#b91c1c">
    <h1>Uygulama açılamadı</h1>
    <p>${message}</p>
    <p>Adres: <strong>http://localhost:5173</strong> olmalı. Dosyayı doğrudan Chrome ile açma.</p>
  </div>`
  console.error(err)
}
