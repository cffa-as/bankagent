export function VaultlineMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'} aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <path d="M24 6 40 15v18L24 42 8 33V15L24 6Z" className="mark-frame" />
        <path d="M15 17h18M15 24h18M15 31h10" className="mark-line" />
        <path d="M29 31h4" className="mark-accent" />
      </svg>
      {!compact && <span className="brand-word">VAULTLINE</span>}
    </span>
  )
}
