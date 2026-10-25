import type { HTMLAttributes } from 'react'
import { cx } from './cx.ts'
import styles from './Badge.module.css'

export type BadgeTone = 'success' | 'accent' | 'info' | 'warning' | 'danger' | 'neutral'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx(styles.badge, styles[tone], className)} {...rest} />
}

export type StatusTone = 'waiting' | 'active' | 'completed' | 'failed'

type StatusLabelProps = HTMLAttributes<HTMLSpanElement> & {
  tone: StatusTone
}

export function StatusLabel({ tone, className, ...rest }: StatusLabelProps) {
  return <span className={cx(styles.status, styles[tone], className)} {...rest} />
}
