export const PHOTO_VARIANTS = new Set(['thumb', 'display'])

export function photoVariantUrls(contentUrl) {
  return {
    thumbnailUrl: `${contentUrl}?variant=thumb`,
    displayUrl: `${contentUrl}?variant=display`,
  }
}

export function photoVariantKey(objectKey, variant) {
  return `${objectKey}/${variant}.webp`
}

export function photoObjectKeys(objectKey) {
  return [objectKey, photoVariantKey(objectKey, 'thumb'), photoVariantKey(objectKey, 'display')]
}

export async function readPhotoAsset({ env, objectKey, contentType, variant = '' }) {
  if (!variant) return env.BABY_PHOTOS.get(objectKey)
  if (!PHOTO_VARIANTS.has(variant)) throw new Error('UNKNOWN_PHOTO_VARIANT')

  const derivedKey = photoVariantKey(objectKey, variant)
  const cached = await env.BABY_PHOTOS.get(derivedKey)
  if (cached) return cached

  const original = await env.BABY_PHOTOS.get(objectKey)
  if (!original) return null
  if (!env.PHOTO_TRANSFORMER) throw new Error('PHOTO_TRANSFORMER_UNAVAILABLE')

  const transformed = await env.PHOTO_TRANSFORMER.fetch(`https://photo-transformer.internal/transform?variant=${variant}`, {
    method: 'POST',
    headers: { 'content-type': contentType || 'application/octet-stream' },
    body: original.body,
  })
  if (!transformed.ok) throw new Error('PHOTO_TRANSFORM_FAILED')

  const bytes = await transformed.arrayBuffer()
  try {
    await env.BABY_PHOTOS.put(derivedKey, bytes, {
      httpMetadata: { contentType: 'image/webp', contentDisposition: 'inline' },
      customMetadata: { sourceKey: objectKey, variant },
    })
  } catch {
    // The transformed image is still usable; a later request can retry the cache write.
  }
  return { body: bytes, httpEtag: '', writeHttpMetadata: (headers) => headers.set('content-type', 'image/webp') }
}
