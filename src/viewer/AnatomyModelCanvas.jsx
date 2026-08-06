import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'

function AnatomyHotspots({ hotspots, markerScale, selectedHotspotId, onSelectHotspot, locale }) {
  return hotspots.map((hotspot) => {
    const selected = hotspot.id === selectedHotspotId
    const position = hotspot.position.map((value) => value * markerScale)
    const label = locale === 'en-US' ? hotspot.label.en : hotspot.label.zh
    const detail = locale === 'en-US' ? hotspot.detail.en : hotspot.detail.zh
    return <group key={hotspot.id} position={position} onClick={(event) => { event.stopPropagation(); onSelectHotspot(selected ? null : hotspot) }}>
      <mesh renderOrder={20} scale={selected ? 1.14 : 1}>
        <sphereGeometry args={[0.1, 18, 12]} />
        <meshBasicMaterial color={hotspot.color} transparent opacity={0.98} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh renderOrder={19} scale={selected ? 1.8 : 1.5}>
        <sphereGeometry args={[0.1, 18, 12]} />
        <meshBasicMaterial color={hotspot.color} transparent opacity={selected ? 0.28 : 0.18} depthTest={false} depthWrite={false} />
      </mesh>
      {selected && <Html position={[0, 0.18, 0]} center distanceFactor={8} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}><div className="pediatric-hotspot-3d-callout"><strong>{label}</strong><small>{detail}</small></div></Html>}
    </group>
  })
}

function AnatomyModel({ resource, hotspots, selectedHotspotId, onSelectHotspot, locale, settings }) {
  const { scene } = useGLTF(resource.model)
  const controlsRef = useRef(null)
  const fitted = useMemo(() => {
    const source = scene.clone(true)
    const clone = new THREE.Group()
    clone.name = `${resource.id}-model-root`
    source.children.forEach((child) => clone.add(child))
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        // GLTFLoader caches scene geometry. Deep-clone geometry before R3F
        // mounts/unmounts the specimen so StrictMode cannot dispose the cache.
        node.geometry = node.geometry.clone()
        node.frustumCulled = false
        node.castShadow = false
        node.receiveShadow = false
        node.material = Array.isArray(node.material)
          ? node.material.map((material) => material.clone())
          : node.material.clone()
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        materials.forEach((material) => {
          material.transparent = false
          material.opacity = 1
          material.depthWrite = true
          material.depthTest = true
          // Generated anatomy meshes may contain mixed/inward-facing normals.
          // DoubleSide prevents the model from disappearing after the material
          // normalization pass while keeping the 2D fallback available.
          material.side = THREE.DoubleSide
          if (material.isMeshStandardMaterial) {
            material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.5, 0.42, 0.62)
            material.metalness = 0
            material.envMapIntensity = 0.32
            if (material.map) material.map.colorSpace = THREE.SRGBColorSpace
            material.transmission = 0
            material.thickness = 0
          }
          material.needsUpdate = true
        })
      }
    })
    clone.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const largestAxis = Math.max(size.x, size.y, size.z) || 1
    const fittedScale = 3.8 / largestAxis
    clone.scale.setScalar(fittedScale)
    clone.position.copy(center.multiplyScalar(-fittedScale))

    // Fit after Anatomy Atelier's presentation rotation too. The eye model is
    // wide in its source axis, so fitting before rotation can crop its edge.
    const preview = new THREE.Group()
    preview.rotation.set(0.05, -0.28, 0)
    preview.add(clone)
    preview.updateMatrixWorld(true)
    const rotatedBounds = new THREE.Box3().setFromObject(preview)
    const rotatedSize = rotatedBounds.getSize(new THREE.Vector3())
    const rotatedAxis = Math.max(rotatedSize.x, rotatedSize.y, rotatedSize.z) || 1
    const safetyScale = Math.min(1, 3.25 / rotatedAxis)
    clone.scale.multiplyScalar(safetyScale)
    clone.position.multiplyScalar(safetyScale)
    preview.updateMatrixWorld(true)
    const finalBounds = new THREE.Box3().setFromObject(preview)
    return { model: clone, plinthY: finalBounds.min.y - 0.2, markerScale: safetyScale }
  }, [resource.id, scene])

  const { model, plinthY, markerScale } = fitted

  useEffect(() => {
    const plane = settings.crossSection ? new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.08) : null
    model.traverse((node) => {
      if (!node.isMesh || !node.material) return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      materials.forEach((material) => {
        material.wireframe = settings.wireframe
        material.clippingPlanes = plane ? [plane] : null
        material.clipShadows = false
        material.needsUpdate = true
      })
    })
  }, [model, settings.crossSection, settings.wireframe])

  useEffect(() => {
    if (!controlsRef.current || !settings.zoomToken) return
    controlsRef.current.dollyIn(1.18)
    controlsRef.current.update()
  }, [settings.zoomToken])

  useEffect(() => {
    if (!controlsRef.current || !settings.resetToken) return
    controlsRef.current.reset()
    controlsRef.current.update()
  }, [settings.resetToken])

  return (
    <>
      <group scale={settings.isolate ? 1.12 : 1} rotation={[0.05, -0.28, 0]}>
        <primitive object={model} dispose={null} />
        <AnatomyHotspots hotspots={hotspots} markerScale={markerScale} selectedHotspotId={selectedHotspotId} onSelectHotspot={onSelectHotspot} locale={locale} />
      </group>
      <mesh position={[0, plinthY * (settings.isolate ? 1.12 : 1), 0]}>
        <cylinderGeometry args={[2.3, 2.48, 0.34, 56]} />
        <meshStandardMaterial color="#ead7c1" roughness={0.78} />
      </mesh>
      <OrbitControls ref={controlsRef} enablePan={false} minDistance={4.2} maxDistance={10} autoRotate={settings.autoRotate} autoRotateSpeed={0.65} />
    </>
  )
}

export function AnatomyModelCanvas({ resource, hotspots = [], selectedHotspotId = null, onSelectHotspot = () => {}, locale = 'zh-CN', settings }) {
  return (
    <Canvas
      dpr={settings.performanceMode === 'low' ? 1 : [1, 1.6]}
      camera={{ position: [0, 1.05, 8.2], fov: 34 }}
      gl={{ antialias: settings.performanceMode !== 'low', alpha: true, localClippingEnabled: settings.crossSection, preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={1.55} />
      <hemisphereLight args={['#fff8ee', '#33252d', 0.72]} />
      <directionalLight position={[4.8, 6.5, 6.8]} intensity={2.35} color="#fff3e7" />
      <directionalLight position={[-4.5, 1.2, 5.2]} intensity={1.05} color="#e6ecff" />
      <directionalLight position={[-4, 3.5, -5.5]} intensity={1.18} color="#ffb7a5" />
      <pointLight position={[-3, -1.4, 3.5]} intensity={0.5} color="#ff8d70" />
      <AnatomyModel key={resource.id} resource={resource} hotspots={hotspots} selectedHotspotId={selectedHotspotId} onSelectHotspot={onSelectHotspot} locale={locale} settings={settings} />
    </Canvas>
  )
}
