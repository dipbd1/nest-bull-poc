import { Navigate, Route, Routes } from 'react-router'
import { RedirectIfAuthed, RequireAdmin, RequireAuth } from './guards.tsx'
import { AppLayout } from './screens/AppLayout.tsx'
import { AskPage } from './screens/AskPage.tsx'
import { AuditPage } from './screens/AuditPage.tsx'
import { AuthPage } from './screens/AuthPage.tsx'
import { ConnectionsPage } from './screens/ConnectionsPage.tsx'
import { HomePage } from './screens/HomePage.tsx'
import { InvitePage } from './screens/InvitePage.tsx'
import { NewBatchPage } from './screens/NewBatchPage.tsx'
import { PeoplePage } from './screens/PeoplePage.tsx'
import { ReviewPage } from './screens/ReviewPage.tsx'

/** Route table. A UI replacement points these at new screens. */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <AuthPage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/invite" element={<InvitePage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/batches/new" element={<NewBatchPage />} />
          <Route path="/batches/:batchId" element={<ReviewPage />} />
          <Route
            path="/batches/:batchId/items/:itemId/ask"
            element={<AskPage />}
          />
          <Route element={<RequireAdmin />}>
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
