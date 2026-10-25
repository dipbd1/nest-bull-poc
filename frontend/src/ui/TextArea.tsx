import type { TextareaHTMLAttributes } from 'react'
import { cx } from './cx.ts'
import field from './field.module.css'

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
}

export function TextArea({ label, className, ...rest }: TextAreaProps) {
  return (
    <label className={field.label}>
      {label}
      <textarea className={cx(field.control, className)} {...rest} />
    </label>
  )
}
