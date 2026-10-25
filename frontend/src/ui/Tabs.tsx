import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { cx } from './cx.ts'
import styles from './Tabs.module.css'

export function TabList({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cx(styles.list, className)} {...rest} />
}

type TabProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean
  count?: number
}

export function Tab({ selected, count, children, className, ...rest }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cx(styles.tab, className)}
      {...rest}
    >
      {children}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </button>
  )
}
