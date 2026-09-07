import {
  battlefieldDefinitions,
  battlefieldSlugs,
  findBattlefieldDefinitionBySlug,
  resolveBattlefieldDefinition,
  resolveTacticalAsset,
  tacticalAssetDefinitions,
} from './index'

const terminationId = '00000000-0000-4000-8000-000000000101'

describe('battlefield registry', () => {
  it('registers every approved Phase 5B battlefield slug exactly once', () => {
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
      tacticalAssetId: 'termination-development',
      dimensions: { width: 1600, height: 900 },
      coordinateModel: {
        units: 'normalized',
        origin: 'top-left',
        xRange: [0, 1],
        yRange: [0, 1],
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
    }
  })

  it.each([
    '00000000-0000-4000-8000-000000000999',
    'termination',
    '../../termination',
    'https://example.test/map.svg',
    'javascript:alert(1)',
    'data:image/svg+xml,unsafe',
    '<svg onload=alert(1)>',
  ])('rejects an unregistered authoritative identity: %s', (identity) => {
    expect(resolveBattlefieldDefinition(identity)).toBeNull()
  })

  it('resolves tactical assets only through the local asset whitelist', () => {
    const asset = resolveTacticalAsset('termination-development')

    expect(asset).toBe(tacticalAssetDefinitions[0])
    expect(asset).toMatchObject({
      id: 'termination-development',
      dimensions: { width: 1600, height: 900 },
    })
    expect(asset?.dimensions).toEqual(
      resolveBattlefieldDefinition(terminationId)?.dimensions,
    )
    expect(asset?.src).toBeTruthy()
    expect(resolveTacticalAsset('https://example.test/map.svg')).toBeNull()
    expect(resolveTacticalAsset('javascript:alert(1)')).toBeNull()
    expect(resolveTacticalAsset(null)).toBeNull()
  })
})
