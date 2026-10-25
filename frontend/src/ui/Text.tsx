import type { HTMLAttributes } from 'react'
import { cx } from './cx.ts'
import styles from './Text.module.css'

export type TextTone = 'default' | 'muted' | 'error' | 'hint' | 'strong'

type TextProps = HTMLAttributes<HTMLElement> & {
  tone?: TextTone
  as?: 'p' | 'span'
}

export function Text({
  tone = 'default',
  as: Tag = 'p',
  className,
  ...rest
}: TextProps) {
  return <Tag className={cx(styles[tone], className)} {...rest} />
}

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2
}

export function Heading({ level = 2, ...rest }: HeadingProps) {
  return level === 1 ? <h1 {...rest} /> : <h2 {...rest} />
}
