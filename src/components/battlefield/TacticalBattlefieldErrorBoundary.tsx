import { Component, type ReactNode } from 'react'

import type { TacticalDimensions } from '../../data/battlefields'
import { TacticalBattlefieldFallback } from './TacticalBattlefieldFallback'

export type TacticalBattlefieldErrorBoundaryProps = {
  battlefieldName: string
  children: ReactNode
  dimensions?: TacticalDimensions
  resetKey: string
}

type TacticalBattlefieldErrorBoundaryState = {
  failed: boolean
  resetKey: string
}

export class TacticalBattlefieldErrorBoundary extends Component<
  TacticalBattlefieldErrorBoundaryProps,
  TacticalBattlefieldErrorBoundaryState
> {
  constructor(props: TacticalBattlefieldErrorBoundaryProps) {
    super(props)
    this.state = { failed: false, resetKey: props.resetKey }
  }

  static getDerivedStateFromProps(
    props: TacticalBattlefieldErrorBoundaryProps,
    state: TacticalBattlefieldErrorBoundaryState,
  ): Partial<TacticalBattlefieldErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { failed: false, resetKey: props.resetKey }
    }

    return null
  }

  static getDerivedStateFromError(): Partial<TacticalBattlefieldErrorBoundaryState> {
    return { failed: true }
  }

  componentDidCatch() {
    // The public fallback is intentionally generic; implementation details and
    // potentially sensitive error payloads must not be rendered or logged here.
  }

  render() {
    if (this.state.failed) {
      return (
        <TacticalBattlefieldFallback
          battlefieldName={this.props.battlefieldName}
          dimensions={this.props.dimensions}
        />
      )
    }

    return this.props.children
  }
}
