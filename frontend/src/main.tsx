import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes.tsx'
import { SessionProvider } from './session/index.ts'
import './ui/tokens.css'
import './ui/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
)
