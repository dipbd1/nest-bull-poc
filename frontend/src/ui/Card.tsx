import type { HTMLAttributes } from 'react'
import { cx } from './cx.ts'
import styles from './Card.module.css'

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx(styles.card, className)} {...rest} />
}
