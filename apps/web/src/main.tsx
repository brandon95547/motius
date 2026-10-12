// First, before anything that reads what the browser has saved.
import './state/renamed-storage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Motius could not find its mount point (#root).')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
