export const ASSET_MANIFEST = {
  version: 'mvp-assets-0.2-sex-variants-pending',
  models: {
    newborn: {
      male: {
        ready: false,
        high: '/assets/models/newborn-boy.glb',
        low: '/assets/models/newborn-boy-low.glb',
        nodes: { surface: null, leftSclera: null, rightSclera: null, diaper: null },
      },
      female: {
        ready: false,
        high: '/assets/models/newborn-girl.glb',
        low: '/assets/models/newborn-girl-low.glb',
        nodes: { surface: null, leftSclera: null, rightSclera: null, diaper: null },
      },
    },
    liver: {
      ready: false,
      high: '/assets/models/liver.glb',
      nodes: { organ: null },
    },
  },
  images: {
    newbornFallback: {
      male: { ready: false, src: '/assets/images/newborn-stage-fallback-boy.png' },
      female: { ready: false, src: '/assets/images/newborn-stage-fallback-girl.png' },
    },
    feeding: {
      male: { ready: false, src: '/assets/images/feeding-observation-boy.png' },
      female: { ready: false, src: '/assets/images/feeding-observation-girl.png' },
    },
    elimination: { ready: false, src: '/assets/images/elimination-record.png' },
    safeSleep: {
      male: { ready: false, src: '/assets/images/safe-sleep-boy.png' },
      female: { ready: false, src: '/assets/images/safe-sleep-girl.png' },
    },
    jaundiceLocation: {
      male: { ready: false, src: '/assets/images/jaundice-body-location-boy.png' },
      female: { ready: false, src: '/assets/images/jaundice-body-location-girl.png' },
    },
    jaundiceMechanism: {
      male: { ready: false, src: '/assets/images/jaundice-mechanism-boy.png' },
      female: { ready: false, src: '/assets/images/jaundice-mechanism-girl.png' },
    },
  },
}

export function resolveSexAsset(asset, sex) {
  if (!asset) return null
  if (!('male' in asset) && !('female' in asset)) return asset
  if (sex !== 'male' && sex !== 'female') return null
  return asset[sex] || null
}
