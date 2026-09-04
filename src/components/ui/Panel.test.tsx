import { render, screen } from '@testing-library/react'

import { Panel } from './Panel'

describe('Panel', () => {
  it('labels its region with the panel heading', () => {
    render(
      <Panel title="Mission information" eyebrow="Command docket">
        Awaiting orders
      </Panel>,
    )

    expect(
      screen.getByRole('region', { name: 'Mission information' }),
    ).toBeInTheDocument()
  })
})
