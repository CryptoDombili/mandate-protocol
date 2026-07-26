export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-lockup" aria-label="Mandate">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="mandate-gradient" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="#635BFF" />
              <stop offset="1" stopColor="#9B67FF" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="42" height="42" rx="14" fill="url(#mandate-gradient)" />
          <path
            d="M13.5 32V18.5C13.5 15.46 15.96 13 19 13c2.4 0 4.52 1.56 5.24 3.85L24 17.6l-.24-.75A5.5 5.5 0 0 0 18.52 13H19c-3.04 0-5.5 2.46-5.5 5.5"
            fill="none"
            stroke="rgba(255,255,255,.28)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M13.5 32V18.5A5.5 5.5 0 0 1 24 16.85L24 17.6l.24-.75A5.5 5.5 0 0 1 34.5 18.5V32"
            fill="none"
            stroke="#fff"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="34.5" cy="32" r="2" fill="#FFB46A" />
        </svg>
      </span>
      {!compact && (
        <span className="logo-copy">
          <strong>mandate</strong>
          <small>membership rails</small>
        </span>
      )}
    </div>
  )
}
