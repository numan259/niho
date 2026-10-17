export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }} aria-label="Niho">
      <span aria-hidden="true">niho</span>
      <span className="logo__dot" aria-hidden="true" />
    </span>
  )
}
