import styles from './ProgressLine.module.css'

type ProgressLineProps = {
  value: number
  max: number
  label: string
}

export function ProgressLine({ value, max, label }: ProgressLineProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className={styles.fill} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
