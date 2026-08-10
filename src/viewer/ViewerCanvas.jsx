import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, OrbitControls, RoundedBox, useGLTF } from '@react-three/drei'
import { ASSET_MANIFEST, resolveSexAsset } from '../content/assets.js'
import { getSexLabel } from '../domain/baby.js'
import { useReducedViewerQuality } from './webglSupport.js'

function SoftBabyPreview({ stepIndex }) {
  const group = useRef(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    const breath = 1 + Math.sin(clock.elapsedTime * 1.7) * 0.004
    group.current.scale.set(1, breath, 1)
  })

  const skin = stepIndex >= 1 ? '#f5c276' : '#f3b7a5'
  return (
    <group ref={group} rotation={[-0.04, 0.18, -0.05]}>
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.58, 48, 32]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <RoundedBox args={[1.3, 1.65, 0.62]} radius={0.42} smoothness={6} position={[0, 0.05, 0]} castShadow>
        <meshStandardMaterial color={skin} roughness={0.78} />
      </RoundedBox>
      <RoundedBox args={[1.18, 0.5, 0.68]} radius={0.2} smoothness={6} position={[0, -0.55, 0.02]}>
        <meshStandardMaterial color="#f7f3eb" roughness={0.9} />
      </RoundedBox>
      {[[-0.72, 0.38, -0.42], [0.72, 0.38, 0.42], [-0.42, -0.98, -0.08], [0.42, -0.98, 0.08]].map((position, index) => (
        <RoundedBox key={index} args={[0.35, 1.1, 0.34]} radius={0.16} smoothness={5} position={position} rotation={[0, 0, index % 2 ? -0.4 : 0.4]}>
          <meshStandardMaterial color={skin} roughness={0.8} />
        </RoundedBox>
      ))}
      {stepIndex >= 1 && (
        <group position={[0, 1.32, 0.53]}>
          <mesh position={[-0.2, 0.02, 0]}><sphereGeometry args={[0.07, 20, 12]} /><meshStandardMaterial color="#fff8da" emissive="#f3c44e" emissiveIntensity={0.4} /></mesh>
          <mesh position={[0.2, 0.02, 0]}><sphereGeometry args={[0.07, 20, 12]} /><meshStandardMaterial color="#fff8da" emissive="#f3c44e" emissiveIntensity={0.4} /></mesh>
        </group>
      )}
      {stepIndex >= 2 && (
        <Float speed={1.2} floatIntensity={0.08}>
          <mesh position={[0.24, 0.18, 0.48]} rotation={[0.1, 0, -0.25]}>
            <sphereGeometry args={[0.28, 32, 18]} />
            <meshStandardMaterial color="#c65b58" roughness={0.58} emissive="#7f2927" emissiveIntensity={0.12} />
          </mesh>
        </Float>
      )}
      {stepIndex >= 3 && Array.from({ length: 12 }, (_, index) => (
        <Float key={index} speed={1 + index * 0.04} floatIntensity={0.16}>
          <mesh position={[-0.35 + (index % 4) * 0.23, -0.1 + Math.floor(index / 4) * 0.28, 0.64]}>
            <sphereGeometry args={[0.035 + (index % 3) * 0.008, 14, 10]} />
            <meshStandardMaterial color="#f2c84b" emissive="#eab838" emissiveIntensity={0.7} />
          </mesh>
        </Float>
      ))}
    </group>
  )
}

function GeneratedNewborn({ asset, url, stepIndex }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((node) => {
      if (node.isMesh && node.material) node.material = node.material.clone()
    })
    return clone
  }, [scene])

  useEffect(() => {
    const { surface, leftSclera, rightSclera } = asset.nodes
    model.traverse((node) => {
      if (!node.isMesh || !node.material) return
      if (stepIndex >= 1 && node.name === surface) node.material.color.set('#f2bf79')
      if (stepIndex >= 1 && (node.name === leftSclera || node.name === rightSclera)) {
        node.material.color.set('#fff2b5')
        node.material.emissive?.set('#dba82d')
        node.material.emissiveIntensity = 0.16
      }
    })
  }, [asset.nodes, model, stepIndex])

  return <primitive object={model} scale={1.4} />
}

function GeneratedLiver() {
  const { scene } = useGLTF(ASSET_MANIFEST.models.liver.high)
  const model = useMemo(() => scene.clone(true), [scene])
  return <primitive object={model} position={[0.25, 0.1, 0.45]} scale={0.42} />
}

// eslint-disable-next-line react-refresh/only-export-components
export function clearViewerModelCache({ performanceMode = 'balanced', sex = null } = {}) {
  const newbornAsset = resolveSexAsset(ASSET_MANIFEST.models.newborn, sex)
  const newbornUrl = performanceMode === 'low' ? newbornAsset?.low : newbornAsset?.high
  for (const url of [newbornUrl, ASSET_MANIFEST.models.liver.high]) {
    if (url) useGLTF.clear(url)
  }
}

export default function ViewerCanvas({ stepIndex = 0, performanceMode = 'balanced', sex = null, viewerAction = null, onContextLost }) {
  const controlsRef = useRef(null)
  const contextCleanupRef = useRef(() => {})
  const reducedQuality = useReducedViewerQuality(performanceMode)
  const newbornAsset = resolveSexAsset(ASSET_MANIFEST.models.newborn, sex)
  const newbornUrl = performanceMode === 'low'
    ? newbornAsset?.low
    : newbornAsset?.high
  const generatedReady = Boolean(newbornAsset?.ready && newbornUrl)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !viewerAction) return
    if (viewerAction.type === 'toggle-rotate') controls.autoRotate = !controls.autoRotate
    if (viewerAction.type === 'zoom-in') controls.dollyIn(1.2)
    if (viewerAction.type === 'reset') controls.reset()
    controls.update()
  }, [viewerAction])

  const handleCreated = useCallback(({ gl }) => {
    contextCleanupRef.current()
    const canvas = gl.domElement
    const handleLost = (event) => {
      event.preventDefault()
      onContextLost?.()
    }
    canvas.addEventListener('webglcontextlost', handleLost, false)
    contextCleanupRef.current = () => canvas.removeEventListener('webglcontextlost', handleLost, false)
  }, [onContextLost])

  useEffect(() => () => contextCleanupRef.current(), [])

  return (
    <div className="viewer-canvas-wrap" data-asset-state={generatedReady ? 'ready' : 'pending'} data-baby-sex={sex || 'unset'}>
      <Canvas
        dpr={reducedQuality ? 1 : [1, 1.5]}
        frameloop={reducedQuality ? 'demand' : 'always'}
        camera={{ position: [0, 0.35, 6], fov: 36 }}
        gl={{ antialias: !reducedQuality, alpha: true, powerPreference: reducedQuality ? 'low-power' : 'high-performance' }}
        onCreated={handleCreated}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[4, 5, 7]} intensity={2.4} color="#fff4d8" />
        <directionalLight position={[-4, 1, 3]} intensity={1.4} color="#72d9d0" />
        {generatedReady
          ? <GeneratedNewborn asset={newbornAsset} url={newbornUrl} stepIndex={stepIndex} />
          : <SoftBabyPreview stepIndex={stepIndex} />}
        {stepIndex >= 2 && ASSET_MANIFEST.models.liver.ready && <GeneratedLiver />}
        <OrbitControls ref={controlsRef} enablePan={false} minDistance={4.4} maxDistance={8} autoRotate={false} autoRotateSpeed={0.8} />
      </Canvas>
      {!generatedReady && <span className="asset-pending-label">{getSexLabel(sex)}结构占位 · 等待混元 GLB</span>}
    </div>
  )
}
