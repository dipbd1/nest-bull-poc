import type { SelectHTMLAttributes } from 'react'
import { cx } from './cx.ts'
import field from './field.module.css'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: SelectOption[]
}

export function Select({ label, options, className, ...rest }: SelectProps) {
  return (
    <label className={field.label}>
      {label}
      <select className={cx(field.control, className)} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
