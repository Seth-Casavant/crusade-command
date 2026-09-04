import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  isLoading?: boolean
  loadingLabel?: string
  variant?: ButtonVariant
}

export function Button({
  children,
  className = '',
  disabled = false,
  isLoading = false,
  loadingLabel = 'Processing',
  type = 'button',
  variant = 'primary',
  ...buttonProps
}: ButtonProps) {
  const classes = ['command-button', `command-button--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...buttonProps}
      aria-busy={isLoading || undefined}
      className={classes}
      disabled={disabled || isLoading}
      type={type}
    >
      {isLoading ? (
        <>
          <span className="command-button__spinner" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
}
