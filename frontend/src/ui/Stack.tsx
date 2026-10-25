import type { HTMLAttributes } from 'react'
import { cx } from './cx.ts'
import styles from './Stack.module.css'

export type StackGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const GAP_CLASS: Record<StackGap, string> = {
  xs: styles.gapXs,
  sm: styles.gapSm,
  md: styles.gapMd,
  lg: styles.gapLg,
  xl: styles.gapXl,
}

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: StackGap
  direction?: 'column' | 'row'
  wrap?: boolean
  align?: 'start' | 'center' | 'end'
  justify?: 'start' | 'between'
}

export function Stack({
  gap = 'lg',
  direction = 'column',
  wrap = false,
  align,
  justify,
  className,
  ...rest
}: StackProps) {
  return (
    <div
      className={cx(
        styles.stack,
        direction === 'row' ? styles.row : styles.column,
        GAP_CLASS[gap],
        wrap && styles.wrap,
        align === 'center' && styles.alignCenter,
        align === 'start' && styles.alignStart,
        align === 'end' && styles.alignEnd,
        justify === 'between' && styles.justifyBetween,
        className,
      )}
      {...rest}
    />
  )
}
