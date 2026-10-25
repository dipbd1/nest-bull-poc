import { Link, type LinkProps } from 'react-router'
import { cx } from './cx.ts'
import styles from './TextLink.module.css'

/** Inline navigation, for example a back link above a page heading. */
export function TextLink({ className, ...rest }: LinkProps) {
  return <Link className={cx(styles.link, className)} {...rest} />
}
