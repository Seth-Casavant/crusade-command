const textEncoder = new TextEncoder()

function decodeHex(
  value: string,
  expectedBytes: number,
): Uint8Array<ArrayBuffer> | null {
  if (
    value.length !== expectedBytes * 2 ||
    !/^[0-9a-f]+$/i.test(value)
  ) {
    return null
  }

  const bytes = new Uint8Array(expectedBytes)
  for (let index = 0; index < expectedBytes; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }

  return bytes
}

export async function verifyDiscordRequestSignature(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  rawBody: string,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<boolean> {
  const publicKey = decodeHex(publicKeyHex, 32)
  const signature = decodeHex(signatureHex, 64)

  if (!publicKey || !signature || timestamp.length === 0) {
    return false
  }

  try {
    const key = await subtle.importKey(
      'raw',
      publicKey,
      { name: 'Ed25519' },
      false,
      ['verify'],
    )

    return await subtle.verify(
      { name: 'Ed25519' },
      key,
      signature,
      textEncoder.encode(`${timestamp}${rawBody}`),
    )
  } catch {
    return false
  }
}
