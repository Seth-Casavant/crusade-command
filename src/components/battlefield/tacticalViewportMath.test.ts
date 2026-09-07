import {
  TACTICAL_VIEWPORT_MAX_ZOOM,
  TACTICAL_VIEWPORT_MIN_ZOOM,
  calculateTacticalViewportTransform,
  clampTacticalViewportZoom,
} from './tacticalViewportMath'

describe('tactical viewport transform math', () => {
  it('fits a landscape asset without changing its native proportions', () => {
    const transform = calculateTacticalViewportTransform(
      { width: 800, height: 600 },
      { width: 1600, height: 900 },
      1,
      { x: 0, y: 0 },
    )

    expect(transform.fitScale).toBe(0.5)
    expect(transform.effectiveScale).toBe(0.5)
    expect(transform.translate).toEqual({ x: 0, y: 75 })
    expect(transform.pan).toEqual({ x: 0, y: 0 })
  })

  it('fits portrait and very tall assets without stretching them', () => {
    const portrait = calculateTacticalViewportTransform(
      { width: 800, height: 600 },
      { width: 1179, height: 1546 },
      1,
      { x: 0, y: 0 },
    )
    const veryTall = calculateTacticalViewportTransform(
      { width: 390, height: 480 },
      { width: 1179, height: 2556 },
      1,
      { x: 0, y: 0 },
    )

    expect(1179 * portrait.effectiveScale).toBeLessThan(800)
    expect(1546 * portrait.effectiveScale).toBeCloseTo(600)
    expect(portrait.translate.x).toBeGreaterThan(0)
    expect(portrait.translate.y).toBeCloseTo(0)

    expect(1179 * veryTall.effectiveScale).toBeLessThan(390)
    expect(2556 * veryTall.effectiveScale).toBeCloseTo(480)
    expect(veryTall.translate.x).toBeGreaterThan(0)
    expect(veryTall.translate.y).toBeCloseTo(0)
  })

  it('clamps zoom and pan to finite controlled bounds', () => {
    expect(clampTacticalViewportZoom(Number.NaN)).toBe(
      TACTICAL_VIEWPORT_MIN_ZOOM,
    )
    expect(clampTacticalViewportZoom(-100)).toBe(
      TACTICAL_VIEWPORT_MIN_ZOOM,
    )
    expect(clampTacticalViewportZoom(100)).toBe(
      TACTICAL_VIEWPORT_MAX_ZOOM,
    )

    const transform = calculateTacticalViewportTransform(
      { width: 800, height: 600 },
      { width: 1600, height: 900 },
      100,
      { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY },
    )

    expect(transform.zoom).toBe(TACTICAL_VIEWPORT_MAX_ZOOM)
    expect(transform.maxPan).toEqual({ x: 1200, y: 600 })
    expect(transform.pan).toEqual({ x: 1200, y: -600 })
    expect(Object.values(transform.translate).every(Number.isFinite)).toBe(true)
  })

  it('returns a safe finite transform while the viewport is not measurable', () => {
    const transform = calculateTacticalViewportTransform(
      { width: 0, height: Number.NaN },
      { width: 1179, height: 1546 },
      2,
      { x: Number.POSITIVE_INFINITY, y: 10 },
    )

    expect(transform).toEqual({
      effectiveScale: 1,
      fitScale: 1,
      maxPan: { x: 0, y: 0 },
      pan: { x: 0, y: 0 },
      translate: { x: 0, y: 0 },
      zoom: 2,
    })
  })
})
