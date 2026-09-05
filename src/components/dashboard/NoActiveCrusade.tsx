import { useId } from 'react'

export function NoActiveCrusade() {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className="no-active-crusade"
    >
      <p className="no-active-crusade__eyebrow">Crusade Command</p>
      <h1 id={titleId}>No Active Operation</h1>
      <p>Awaiting deployment orders.</p>
    </section>
  )
}
