import type { ReactNode } from 'react'

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="row__track" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card--skeleton" />
      ))}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="visually-hidden">{label}</span>
    </div>
  )
}

export function Message({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="message">
      <h2 className="message__title">{title}</h2>
      {children && <p className="message__body">{children}</p>}
      {action}
    </div>
  )
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const text = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <Message
      title="Couldn't load this"
      action={
        onRetry && (
          <button className="btn btn--secondary" onClick={onRetry}>
            Try again
          </button>
        )
      }
    >
      {text} The Internet Archive can be slow at times — retrying usually works.
    </Message>
  )
}
