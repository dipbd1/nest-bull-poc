import type { HTMLAttributes, LiHTMLAttributes } from 'react'
import { cx } from './cx.ts'
import styles from './RowList.module.css'

export function RowList({
  className,
  ...rest
}: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cx(styles.list, className)} {...rest} />
}

export function RowListItem({
  className,
  ...rest
}: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cx(styles.item, className)} {...rest} />
}
