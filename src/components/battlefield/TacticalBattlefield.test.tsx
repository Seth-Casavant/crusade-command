import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import {
  resolveBattlefieldDefinition,
  resolveTacticalAsset,
} from '../../data/battlefields'
import { TacticalBattlefield, TacticalOverlayItem } from './index'

const boundaryMocks = vi.hoisted(() => ({
  channel: vi.fn(),
}))

vi.mock('../../data/services/supabase', () => ({
  supabase: { channel: boundaryMocks.channel },
}))

const terminationId = '00000000-0000-4000-8000-000000000101'
const voxLiberatisId = '00000000-0000-4000-8000-000000000102'

function getAsset(container: HTMLElement): HTMLImageElement {
  const asset = container.querySelector<HTMLImageElement>(
    '.tactical-battlefield__asset',
  )

  if (!asset) {
    throw new Error('Expected a tactical battlefield asset.')
  }

  return asset
}

function ExplodingOverlay(): never {
  throw new Error('Expected tactical overlay test failure.')
}

describe('TacticalBattlefield', () => {
  beforeEach(() => {
    boundaryMocks.channel.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the registered ACTIVE battlefield with a stable loading frame', () => {
    const definition = resolveBattlefieldDefinition(terminationId)
    const expectedAsset = resolveTacticalAsset(definition?.tacticalAssetId)
    const { container } = render(
      <TacticalBattlefield
        battlefieldId={terminationId}
        battlefieldName="Termination"
      />,
    )

    const region = screen.getByRole('region', {
      name: 'Tactical Battlefield Termination',
    })
    const viewport = region.querySelector('.tactical-battlefield__viewport')
    const asset = getAsset(container)

    expect(expectedAsset).not.toBeNull()
    expect(region).toBeInTheDocument()
    expect(screen.getByText('Loading Tactical Cartography...')).toHaveRole(
      'status',
    )
    expect(viewport).toHaveAttribute('aria-busy', 'true')
    expect(viewport).toHaveStyle({ aspectRatio: '1600 / 900' })
    expect(asset).toHaveAttribute('src', expectedAsset?.src ?? '')
    expect(asset).toHaveAttribute('width', '1600')
    expect(asset).toHaveAttribute('height', '900')
    expect(asset).toHaveAttribute('aria-hidden', 'true')
    expect(boundaryMocks.channel).not.toHaveBeenCalled()
  })

  it('reveals the asset and aligned overlay after image loading succeeds', () => {
    const { container } = render(
      <TacticalBattlefield
        battlefieldId={terminationId}
        battlefieldName="Termination"
      >
        <TacticalOverlayItem position={{ x: 0.25, y: 0.75 }}>
          <span data-testid="development-coordinate">Reference</span>
        </TacticalOverlayItem>
      </TacticalBattlefield>,
    )

    fireEvent.load(getAsset(container))

    expect(
      screen.getByRole('img', {
        name: 'Tactical schematic for Termination',
      }),
    ).toHaveAttribute('data-status', 'ready')
    expect(
      screen.queryByText('Loading Tactical Cartography...'),
    ).not.toBeInTheDocument()
    const overlay = container.querySelector('.tactical-overlay')
    const item = screen.getByTestId('development-coordinate').parentElement
    expect(overlay).toContainElement(item)
    expect(item).toHaveStyle({ left: '25%', top: '75%' })
  })

  it('fails safely for an unknown authoritative battlefield', () => {
    const { container } = render(
      <TacticalBattlefield
        battlefieldId="00000000-0000-4000-8000-000000000999"
        battlefieldName="Uncharted Bastion"
      />,
    )

    expect(
      screen.getByText('Tactical Cartography Unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('Battlefield: Uncharted Bastion')).toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('fails safely when a registered battlefield has no tactical asset', () => {
    render(
      <TacticalBattlefield
        battlefieldId={voxLiberatisId}
        battlefieldName="Vox Liberatis"
      />,
    )

    expect(
      screen.getByRole('region', {
        name: 'Tactical Battlefield Vox Liberatis',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Battlefield: Vox Liberatis')).toBeInTheDocument()
  })

  it('replaces a failed image without exposing a broken asset icon', () => {
    const { container } = render(
      <TacticalBattlefield
        battlefieldId={terminationId}
        battlefieldName="Termination"
      />,
    )

    fireEvent.error(getAsset(container))

    expect(
      screen.getByText('Tactical Cartography Unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('Battlefield: Termination')).toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('resets image state when the resolved battlefield identity changes', () => {
    const { container, rerender } = render(
      <TacticalBattlefield
        battlefieldId={terminationId}
        battlefieldName="Termination"
      />,
    )
    fireEvent.error(getAsset(container))

    rerender(
      <TacticalBattlefield
        battlefieldId={voxLiberatisId}
        battlefieldName="Vox Liberatis"
      />,
    )
    rerender(
      <TacticalBattlefield
        battlefieldId={terminationId}
        battlefieldName="Termination"
      />,
    )

    expect(getAsset(container)).toHaveAttribute('data-status', 'loading')
    expect(screen.getByText('Loading Tactical Cartography...')).toBeInTheDocument()
  })

  it('contains unexpected overlay rendering failures inside the map', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { container } = render(
      <div>
        <p>Campaign data remains available.</p>
        <TacticalBattlefield
          battlefieldId={terminationId}
          battlefieldName="Termination"
        >
          <ExplodingOverlay />
        </TacticalBattlefield>
        <button type="button">Resync</button>
      </div>,
    )

    fireEvent.load(getAsset(container))

    expect(
      screen.getByText('Tactical Cartography Unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('Campaign data remains available.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resync' })).toBeEnabled()
    consoleError.mockRestore()
  })
})
