import type { InputHTMLAttributes } from 'react'
import { cx } from './cx.ts'
import field from './field.module.css'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function TextField({ label, className, ...rest }: TextFieldProps) {
  return (
    <label className={field.label}>
      {label}
      <input className={cx(field.control, className)} {...rest} />
    </label>
  )
}
