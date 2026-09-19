// @vitest-environment node

import { webcrypto } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { verifyDiscordRequestSignature } from './signature.ts'

function hex(bytes: ArrayBuffer) {
  return Buffer.from(bytes).toString('hex')
}

describe('Discord request signatures', () => {
  it('accepts a valid Ed25519 signature over timestamp plus raw body', async () => {
    const keyPair = (await webcrypto.subtle.generateKey(
      'Ed25519',
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const publicKey = await webcrypto.subtle.exportKey('raw', keyPair.publicKey)
    const timestamp = '1789650000'
    const body = '{"type":1}'
    const signature = await webcrypto.subtle.sign(
      'Ed25519',
      keyPair.privateKey,
      new TextEncoder().encode(`${timestamp}${body}`),
    )

    await expect(
      verifyDiscordRequestSignature(
        hex(publicKey),
        hex(signature),
        timestamp,
        body,
        webcrypto.subtle as SubtleCrypto,
      ),
    ).resolves.toBe(true)
  })

  it('rejects a signature when the signed body changes', async () => {
    const keyPair = (await webcrypto.subtle.generateKey(
      'Ed25519',
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const publicKey = await webcrypto.subtle.exportKey('raw', keyPair.publicKey)
    const timestamp = '1789650000'
    const signature = await webcrypto.subtle.sign(
      'Ed25519',
      keyPair.privateKey,
      new TextEncoder().encode(`${timestamp}{"type":1}`),
    )

    await expect(
      verifyDiscordRequestSignature(
        hex(publicKey),
        hex(signature),
        timestamp,
        '{"type":2}',
        webcrypto.subtle as SubtleCrypto,
      ),
    ).resolves.toBe(false)
  })

  it('rejects malformed key and signature encodings', async () => {
    await expect(
      verifyDiscordRequestSignature('not-a-key', 'not-a-signature', '1', '{}'),
    ).resolves.toBe(false)
  })
})
