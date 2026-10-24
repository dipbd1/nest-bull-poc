import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { App } from './App.tsx'
import { AuthProvider, RedirectIfAuthed, RequireAuth } from './auth.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { ConsumersPage } from './pages/ConsumersPage.tsx'
import { ProducerPage } from './pages/ProducerPage.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <AuthPage />
              </RedirectIfAuthed>
            }
          />
          <Route element={<RequireAuth />}>
            <Route element={<App />}>
              <Route path="/" element={<ProducerPage />} />
              <Route path="/consumers" element={<ConsumersPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
