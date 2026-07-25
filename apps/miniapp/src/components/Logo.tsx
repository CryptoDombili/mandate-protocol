export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-lockup" aria-label="Mandate">
      <span className="logo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && <span className="logo-word">MANDATE</span>}
    </div>
  )
}
