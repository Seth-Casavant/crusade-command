import { EventBriefing } from '../components/dashboard/EventBriefing'
import { useEventBriefing } from '../state/useEventBriefing'
import { navigateTo, PUBLIC_DASHBOARD_PATH, staffLoginPath } from '../navigation'

function HolographicTable() {
  return (
    <div className="welcome-hologram" aria-hidden="true">
      <svg viewBox="0 0 800 800" fill="none">
        <defs>
          <radialGradient id="holo-light"><stop stopColor="#83ffac" stopOpacity=".2"/><stop offset="1" stopColor="#83ffac" stopOpacity="0"/></radialGradient>
          <pattern id="holo-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" stroke="currentColor" strokeOpacity=".2"/></pattern>
          <clipPath id="holo-disc"><ellipse cx="400" cy="535" rx="335" ry="165"/></clipPath>
        </defs>
        <circle cx="400" cy="430" r="350" fill="url(#holo-light)"/>
        <g className="welcome-hologram__table">
          <ellipse cx="400" cy="550" rx="350" ry="180" stroke="currentColor" strokeOpacity=".12" strokeWidth="16"/>
          <ellipse cx="400" cy="535" rx="335" ry="165" stroke="currentColor" strokeOpacity=".6"/>
          <rect x="65" y="360" width="670" height="350" fill="url(#holo-grid)" clipPath="url(#holo-disc)"/>
          <ellipse cx="400" cy="535" rx="260" ry="128" stroke="currentColor" strokeOpacity=".4"/>
          <ellipse cx="400" cy="535" rx="180" ry="88" stroke="currentColor" strokeOpacity=".35"/>
          <path d="M65 535H735M400 370V700" stroke="currentColor" strokeOpacity=".5"/>
        </g>
        <g stroke="currentColor" className="welcome-hologram__world">
          <circle cx="400" cy="340" r="160" strokeOpacity=".8"/>
          <ellipse cx="400" cy="340" rx="80" ry="160" strokeOpacity=".45"/>
          <ellipse cx="400" cy="340" rx="130" ry="160" strokeOpacity=".3"/>
          <ellipse cx="400" cy="340" rx="160" ry="55" strokeOpacity=".45"/>
          <ellipse cx="400" cy="340" rx="160" ry="110" strokeOpacity=".3"/>
          <path d="M240 340H560M400 180V500" strokeOpacity=".4"/>
          <path d="M287 248L327 222 348 239 355 273 392 280 414 325 390 361 345 348 310 306ZM438 363L469 343 497 374 479 421 455 445 442 413Z" fill="currentColor" fillOpacity=".08" strokeOpacity=".65"/>
          <ellipse cx="400" cy="340" rx="225" ry="68" transform="rotate(-28 400 340)" strokeOpacity=".7" strokeDasharray="4 7"/>
        </g>
        <path d="M300 467L230 586M500 467L570 586M400 500V600" stroke="currentColor" strokeOpacity=".2"/>
        <g fill="currentColor"><circle cx="295" cy="303" r="5"/><circle cx="495" cy="379" r="4"/><circle cx="355" cy="200" r="3"/></g>
        <path d="M295 303H178L140 270H90M495 379H615L650 345H715" stroke="currentColor" strokeOpacity=".7"/>
        <g fill="currentColor" fontFamily="monospace" fontSize="11" letterSpacing="2"><text x="87" y="258">MIDNIGHT</text><text x="645" y="333">WAR ZONE</text><text x="295" y="742">TACTICAL PROJECTION</text></g>
      </svg>
    </div>
  )
}

export function WelcomePage() {
  const { briefing, status, retry } = useEventBriefing()
  return (
    <main className="welcome-screen">
      <div className="welcome-screen__frame">
        <header className="welcome-screen__header">
          <a href="/" className="welcome-screen__brand">NL <span>NIGHT LORDS<br/>CRUSADE COMMAND</span></a>
          <button type="button" onClick={() => navigateTo(staffLoginPath())}>COMMAND STAFF <span aria-hidden="true">↗</span></button>
        </header>
        <div className="welcome-screen__hero">
          <div className="welcome-screen__copy">
            <p className="welcome-screen__eyebrow">NIGHT LORDS // CRUSADE COMMAND</p>
            <h1>CRUSADE <br/><span>COMMAND</span></h1>
            <p className="welcome-screen__subtitle">{briefing?.title ?? 'AWAITING DEPLOYMENT ORDERS'}</p>
            <p className="welcome-screen__description">Ave Dominus Nox.<br/>Let the hunt begin.</p>
            <button className="welcome-screen__enter" type="button" onClick={() => navigateTo(PUBLIC_DASHBOARD_PATH)}>
              COMMENCE CRUSADE <span aria-hidden="true">→</span>
            </button>
            <p className="welcome-screen__hint">ENTER THE LIVE BATTLEFIELD OVERVIEW</p>
          </div>
          <HolographicTable />
        </div>
        {briefing ? <EventBriefing briefing={briefing} headingLevel={2} /> : null}
        {status === 'loading' ? <p role="status">Receiving event briefing...</p> : null}
        {status === 'error' ? <p role="status">Event briefing unavailable. <button onClick={retry}>Retry briefing</button></p> : null}
        <footer className="welcome-screen__footer"><span>CRUSADE TACTICAL DISPLAY</span><span>AVE DOMINUS NOX.</span><span>NIGHT LORDS // THE MIDNIGHT HUNT</span></footer>
      </div>
    </main>
  )
}
