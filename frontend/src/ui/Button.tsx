import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Button.module.css'
import { cx } from './cx.ts'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], className)}
      {...rest}
    />
  )
}

type AnchorButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
}

/**
 * A plain anchor that looks like a Button, for a full-page navigation the
 * router must not handle, such as a redirect to another site.
 */
export function AnchorButton({
  variant = 'primary',
  className,
  ...rest
}: AnchorButtonProps) {
  return (
    <a className={cx(styles.button, styles[variant], className)} {...rest} />
  )
}

type LinkButtonProps = LinkProps & {
  variant?: ButtonVariant
}

/** A router link that looks like a Button. */
export function LinkButton({
  variant = 'primary',
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={cx(styles.button, styles[variant], className)} {...rest} />
  )
}
