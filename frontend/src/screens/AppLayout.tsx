import { Outlet } from 'react-router'
import { useAuth } from '../session/index.ts'
import { AppShell, Button, NavItem, Stack, Text } from '../ui/index.ts'

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth()

  return (
    <AppShell
      brand="Feedback coder"
      nav={
        <>
          <NavItem to="/" end>
            Batches
          </NavItem>
          {isAdmin ? (
            <>
              <NavItem to="/connections">Connections</NavItem>
              <NavItem to="/people">People</NavItem>
              <NavItem to="/audit">Audit</NavItem>
            </>
          ) : null}
        </>
      }
      actions={
        <Stack direction="row" gap="md" align="center" wrap>
          <Text tone="hint">{user?.email}</Text>
          <Button variant="secondary" onClick={() => void logout()}>
            Sign out
          </Button>
        </Stack>
      }
    >
      <Outlet />
    </AppShell>
  )
}
