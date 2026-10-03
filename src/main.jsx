import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './fonts/fonts.css'
import './styles.css'
import { applyTheme, storedTheme } from './theme.js'

// Put the remembered time-of-day theme on before the first paint (recruiter mode resets it in App).
applyTheme(storedTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
