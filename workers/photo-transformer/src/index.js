const VARIANTS = {
  thumb: { transform: { width: 240, height: 240, fit: 'cover' }, quality: 72 },
  display: { transform: { width: 1600, height: 1600, fit: 'scale-down' }, quality: 82 },
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const variant = VARIANTS[url.searchParams.get('variant')]
    if (request.method !== 'POST' || url.pathname !== '/transform' || !variant || !request.body) {
      return new Response('Not found', { status: 404 })
    }

    try {
      const output = await env.IMAGES
        .input(request.body)
        .transform(variant.transform)
        .output({ format: 'image/webp', quality: variant.quality, anim: false })
      const response = output.response()
      return new Response(response.body, {
        status: response.status,
        headers: {
          'content-type': 'image/webp',
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        },
      })
    } catch {
      return new Response('Image transform failed', { status: 422 })
    }
  },
}
