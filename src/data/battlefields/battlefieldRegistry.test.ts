import {
  battlefieldDefinitions,
  battlefieldSlugs,
  findBattlefieldDefinitionBySlug,
  resolveBattlefieldAssetCandidates,
  resolveBattlefieldDefinition,
  resolveTacticalAsset,
  tacticalAssetDefinitions,
} from './index'

const terminationId = '00000000-0000-4000-8000-000000000101'

describe('battlefield registry', () => {
  it('registers every approved Phase 5C battlefield slug exactly once', () => {
    const authoritativeIds = battlefieldDefinitions.flatMap(
      ({ authoritativeIds: ids }) => ids,
    )

    expect(battlefieldDefinitions.map(({ slug }) => slug)).toEqual(
      battlefieldSlugs,
    )
    expect(new Set(battlefieldDefinitions.map(({ id }) => id)).size).toBe(
      battlefieldDefinitions.length,
    )
    expect(new Set(authoritativeIds).size).toBe(authoritativeIds.length)
  })

  it('resolves the seeded authoritative Termination identity', () => {
    const definition = resolveBattlefieldDefinition(terminationId)

    expect(definition).toMatchObject({
      id: 'termination',
      slug: 'termination',
      displayName: 'Termination',
      tacticalAssetId: 'kimber-prime-termination-local',
      fallbackTacticalAssetIds: ['termination-development'],
      dimensions: { width: 1179, height: 1546 },
      aspectRatio: 1179 / 1546,
      orientation: 'portrait',
      coordinateModel: {
        units: 'normalized',
        origin: 'top-left',
        xRange: [0, 1],
        yRange: [0, 1],
      },
      overlayMetadata: { coordinatePlane: 'full-asset' },
      attribution: {
        creator: 'Kimber Prime',
        sourceReference: 'Kimber Prime / kimberprime.com',
        redistributionStatus: 'permission-required',
      },
    })
    expect(findBattlefieldDefinitionBySlug('termination')).toBe(definition)
  })

  it('keeps reusable definitions separate from campaign-specific state', () => {
    for (const definition of battlefieldDefinitions) {
      expect(definition).not.toHaveProperty('campaignId')
      expect(definition).not.toHaveProperty('missionId')
      expect(definition).not.toHaveProperty('progress')
      expect(definition).not.toHaveProperty('objectives')
      expect(definition.aspectRatio).toBe(
        definition.dimensions.width / definition.dimensions.height,
      )
      expect(definition.orientation).toBe(
        definition.dimensions.width > definition.dimensions.height
          ? 'landscape'
          : definition.dimensions.width < definition.dimensions.height
            ? 'portrait'
            : 'square',
      )
    }
  })

  it('records portrait, very-tall, and landscape fixture dimensions explicitly', () => {
    expect(findBattlefieldDefinitionBySlug('inferno')).toMatchObject({
      dimensions: { width: 1179, height: 1533 },
      orientation: 'portrait',
    })
    expect(findBattlefieldDefinitionBySlug('exfiltration')).toMatchObject({
      dimensions: { width: 1179, height: 2556 },
      orientation: 'portrait',
    })

    const developmentFixture = resolveTacticalAsset('termination-development')
    expect(developmentFixture).toMatchObject({
      dimensions: { width: 1600, height: 900 },
      aspectRatio: 1600 / 900,
      orientation: 'landscape',
      distribution: 'tracked',
    })
  })

  it('resolves every reviewed local-clean battlefield at its native dimensions', () => {
    const expectedLocalAssets = [
      ['purgation', 'purgation.png', 3990, 5000],
      ['reclamation', 'reclamation.png', 1179, 1414],
      ['inferno', 'inferno.png', 1179, 1533],
      ['reliquary', 'reliquary.png', 1179, 1573],
      ['decapitation', 'decapitation.png', 1179, 1631],
      ['fall-of-atreus', 'fall-of-atreus.png', 1179, 1225],
      ['termination', 'termination.png', 1179, 1546],
      ['vox-liberatis', 'vox-liberatis.png', 1179, 1545],
      ['ballistic-engine', 'ballistic-engine.png', 1179, 1542],
      ['obelisk', 'obelisk.png', 1179, 1652],
      ['vortex', 'vortex.png', 1179, 1294],
      ['disruption', 'disruption.png', 1179, 1846],
      ['exfiltration', 'exfiltration.png', 1179, 2556],
    ] as const

    expect(expectedLocalAssets).toHaveLength(13)

    for (const [slug, filename, width, height] of expectedLocalAssets) {
      const definition = findBattlefieldDefinitionBySlug(slug)

      expect(definition).not.toBeNull()
      expect(definition?.dimensions).toEqual({ width, height })
      expect(definition?.aspectRatio).toBe(width / height)

      const asset = resolveTacticalAsset(definition?.tacticalAssetId)

      expect(asset).toMatchObject({
        id: `kimber-prime-${slug}-local`,
        src: `/src/assets/battlefields/local-clean/${filename}`,
        dimensions: { width, height },
        aspectRatio: width / height,
        distribution: 'local-development',
      })
    }
  })

  it.each([
    '00000000-0000-4000-8000-000000000999',
    'termination',
    '../../termination',
    '..\\..\\termination',
    '\\\\server\\share\\termination.png',
    '//example.test/map.svg',
    'https://example.test/map.svg',
    'javascript:alert(1)',
    'data:image/svg+xml,unsafe',
    '<svg onload=alert(1)>',
  ])('rejects an unregistered authoritative identity: %s', (identity) => {
    expect(resolveBattlefieldDefinition(identity)).toBeNull()
  })

  it('resolves tactical assets only through the exact local asset whitelist', () => {
    const asset = resolveTacticalAsset('termination-development')
    const localAsset = resolveTacticalAsset('kimber-prime-termination-local')

    expect(asset).toBe(tacticalAssetDefinitions[0])
    expect(asset).toMatchObject({
      id: 'termination-development',
      dimensions: { width: 1600, height: 900 },
    })
    expect(asset?.src).toBeTruthy()
    expect(localAsset).toMatchObject({
      id: 'kimber-prime-termination-local',
      src: '/src/assets/battlefields/local-clean/termination.png',
      dimensions: { width: 1179, height: 1546 },
      orientation: 'portrait',
      distribution: 'local-development',
      attribution: { redistributionStatus: 'permission-required' },
    })
    expect(
      tacticalAssetDefinitions.every(
        ({ aspectRatio, dimensions }) =>
          aspectRatio === dimensions.width / dimensions.height,
      ),
    ).toBe(true)
  })

  it.each([
    'https://example.test/map.svg',
    'http://example.test/map.svg',
    '//example.test/map.svg',
    'javascript:alert(1)',
    'data:image/svg+xml,unsafe',
    'blob:https://example.test/unsafe',
    '../../local-clean/termination.png',
    '..\\..\\local-clean\\termination.png',
    'C:\\maps\\termination.png',
    '\\\\server\\share\\termination.png',
    '__proto__',
    'constructor',
    '<svg onload=alert(1)>',
  ])('rejects an unregistered tactical asset identity: %s', (assetId) => {
    expect(resolveTacticalAsset(assetId)).toBeNull()
  })

  it('orders the local Termination asset before its tracked safe fixture', () => {
    const definition = resolveBattlefieldDefinition(terminationId)

    expect(definition).not.toBeNull()
    const candidates = resolveBattlefieldAssetCandidates(definition!)

    expect(candidates.map(({ id }) => id)).toEqual([
      'kimber-prime-termination-local',
      'termination-development',
    ])
    expect(candidates.map(({ dimensions }) => dimensions)).toEqual([
      { width: 1179, height: 1546 },
      { width: 1600, height: 900 },
    ])
    expect(resolveTacticalAsset(null)).toBeNull()
  })
})
