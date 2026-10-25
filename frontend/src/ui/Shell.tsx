import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cx } from './cx.ts'
import styles from './Shell.module.css'

type AppShellProps = {
  brand: string
  nav: ReactNode
  actions?: ReactNode
  banner?: ReactNode
  children: ReactNode
}

export function AppShell({ brand, nav, actions, banner, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <p className={styles.brand}>{brand}</p>
        <div className={styles.topbarEnd}>
          <nav className={styles.nav}>{nav}</nav>
          {actions}
        </div>
      </header>
      {banner}
      <main>{children}</main>
    </div>
  )
}

type NavItemProps = {
  to: string
  end?: boolean
  children: ReactNode
}

export function NavItem({ to, end, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cx(styles.navItem, isActive && styles.navItemActive)}
    >
      {children}
    </NavLink>
  )
}

type AuthShellProps = {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return <div className={styles.auth}>{children}</div>
}

export function PageMessage({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <p>{children}</p>
    </div>
  )
}

export function BrandLabel({ children }: { children: ReactNode }) {
  return <p className={styles.brand}>{children}</p>
}
