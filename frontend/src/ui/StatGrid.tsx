import styles from './StatGrid.module.css'

export type StatItem = {
  label: string
  value: number | string
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <ul className={styles.grid}>
      {items.map((item) => (
        <li key={item.label} className={styles.item}>
          <span className={styles.label}>{item.label}</span>
          <span className={styles.value}>{item.value}</span>
        </li>
      ))}
    </ul>
  )
}
