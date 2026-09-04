import { useId, type ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  className?: string
  eyebrow?: string
  footer?: ReactNode
  title: string
}

export function Panel({
  children,
  className = '',
  eyebrow,
  footer,
  title,
}: PanelProps) {
  const titleId = useId()
  const classes = ['command-panel', className].filter(Boolean).join(' ')

  return (
    <section className={classes} aria-labelledby={titleId}>
      <header className="command-panel__header">
        {eyebrow ? <p className="command-panel__eyebrow">{eyebrow}</p> : null}
        <h2 className="command-panel__title" id={titleId}>
          {title}
        </h2>
      </header>
      <div className="command-panel__body">{children}</div>
      {footer ? <footer className="command-panel__footer">{footer}</footer> : null}
    </section>
  )
}
