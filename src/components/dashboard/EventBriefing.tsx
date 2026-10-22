import type { EventBriefing as Briefing } from '../../data/services/eventBriefing'

export function EventBriefing({ briefing, headingLevel = 1 }: {
  briefing: Briefing
  headingLevel?: 1 | 2
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section className="event-briefing" aria-label="Published event briefing">
      <p className="event-briefing__eyebrow">NIGHT LORDS // EVENT BRIEFING</p>
      <Heading>{briefing.title}</Heading>
      <p>{briefing.description}</p>
      <h3>Eligible modes</h3>
      <p>{briefing.modes.join(' // ')}</p>
      <h3>Hunt targets</h3>
      <ul>{briefing.targets.map((target) => <li key={target}>{target}</li>)}</ul>
      <h3>Orders of the hunt</h3>
      <ul>{briefing.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      <p className="event-briefing__note">Published briefing // Live scores appear when the operation is activated.</p>
    </section>
  )
}
