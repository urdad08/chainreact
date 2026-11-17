// ChainReact mark: three nodes passing a signal along a chain -- one
// highlighted "reacting" node in the accent, the rest neutral.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="var(--surface-3)" stroke="var(--border-strong)" />
      <path d="M9 21.5L16 10.5L23 21.5" stroke="var(--text-tertiary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21.5H23" stroke="var(--text-tertiary)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <circle cx="9" cy="21.5" r="3" fill="var(--surface)" stroke="var(--text-secondary)" strokeWidth="1.6" />
      <circle cx="23" cy="21.5" r="3" fill="var(--surface)" stroke="var(--text-secondary)" strokeWidth="1.6" />
      <circle cx="16" cy="10.5" r="3.6" fill="var(--accent)" />
      <circle cx="16" cy="10.5" r="6" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1.2" />
    </svg>
  );
}
