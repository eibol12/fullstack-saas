import { useMemo, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Line,
  Sphere,
  Html,
  Environment,
  PerspectiveCamera,
  useGLTF,
  Clone,
} from '@react-three/drei'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

// Set Three.js default UP to Z axis to align with engineering coords
THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

export interface VisualizerItem {
  component_type?: 'Shackle' | 'Masterlink' | 'MasterlinkAssembly' | 'WireRope' | string | null
  capacity?: string | number | null
  manufacturer?: string | null
  model?: string | null
  eye_type?: string | null
  termination?: string | null
  configuration?: string | null
  position?: number // optional, fallback to index
}

interface DesignVisualizer3DProps {
  items: VisualizerItem[]
  height?: number
  className?: string
}

// Sub-component to load the high-fidelity Green Pin shackle model.
// Scaled down by 0.001 to convert from millimeters (CAD standard) to meters.
function ShackleModel({ position, zRotation = 0 }: { position: [number, number, number]; zRotation?: number }) {
  const { scene } = useGLTF('/models/shackle.glb')

  // Traverse the loaded model scene graph to find white/light-grey shackle body parts
  // and recolor them to a steel grey, while leaving the pin color (typically green) untouched.
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat) => {
            if ('color' in mat && mat.color instanceof THREE.Color) {
              const col = mat.color
              // If the color is white/off-white/light-grey (not green), override it to steel grey
              if (col.r > 0.65 && col.g > 0.65 && col.b > 0.65) {
                col.set('#788896') // steel grey
                if ('metalness' in mat) (mat as any).metalness = 0.85
                if ('roughness' in mat) (mat as any).roughness = 0.25
              }
            }
          })
        }
      }
    })
  }, [scene])

  return (
    <group position={position} rotation={[0, 0, zRotation]}>
      <Clone
        object={scene}
        position={[0, 0, 0]}
        scale={[0.001, 0.001, 0.001]}
        rotation={[Math.PI / 2, 0, 0]} // align up with Z-axis
        castShadow
        receiveShadow
      />
    </group>
  )
}

// Sub-component to load the high-fidelity Green Pin masterlink model.
// Scaled down by 0.001 to convert from millimeters (CAD standard) to meters.
function MasterlinkModel({ position, zRotation = 0 }: { position: [number, number, number]; zRotation?: number }) {
  const { scene } = useGLTF('/models/masterlink.glb')

  // Traverse the loaded model scene graph to find white/light-grey parts
  // and recolor them to a vibrant warning golden yellow/amber.
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat) => {
            if ('color' in mat && mat.color instanceof THREE.Color) {
              const col = mat.color
              // If the color is white/off-white/light-grey, override it to a warning golden yellow
              if (col.r > 0.65 && col.g > 0.65 && col.b > 0.65) {
                col.set('#d97706') // golden warning color
                if ('metalness' in mat) (mat as any).metalness = 0.8
                if ('roughness' in mat) (mat as any).roughness = 0.2
              }
            }
          })
        }
      }
    })
  }, [scene])

  return (
    <group position={position} rotation={[0, 0, zRotation]}>
      <Clone
        object={scene}
        position={[0, 0, 0]}
        scale={[0.001, 0.001, 0.001]}
        rotation={[Math.PI / 2, 0, 0]} // align vertically with Z-axis
        castShadow
        receiveShadow
      />
    </group>
  )
}

// Sub-component to load the high-fidelity Green Pin masterlink assembly model.
// Scaled down by 0.001 to convert from millimeters (CAD standard) to meters.
function MasterlinkAssemblyModel({ position, zRotation = 0 }: { position: [number, number, number]; zRotation?: number }) {
  const { scene } = useGLTF('/models/masterlinkassembly.glb')

  // Traverse the loaded model scene graph to find white/light-grey parts
  // and recolor them to a vibrant warning golden yellow/amber.
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat) => {
            if ('color' in mat && mat.color instanceof THREE.Color) {
              const col = mat.color
              // If the color is white/off-white/light-grey, override it to a warning golden yellow
              if (col.r > 0.65 && col.g > 0.65 && col.b > 0.65) {
                col.set('#d97706') // golden warning color
                if ('metalness' in mat) (mat as any).metalness = 0.8
                if ('roughness' in mat) (mat as any).roughness = 0.2
              }
            }
          })
        }
      }
    })
  }, [scene])

  return (
    <group position={position} rotation={[0, 0, zRotation]}>
      <Clone
        object={scene}
        position={[0, 0, 0]}
        scale={[0.001, 0.001, 0.001]}
        rotation={[Math.PI / 2, 0, 0]} // align vertically with Z-axis
        castShadow
        receiveShadow
      />
    </group>
  )
}

// Sub-component to load the high-fidelity Green Pin hook model.
// Scaled down by 0.001 to convert from millimeters (CAD standard) to meters.
function HookModel({ position, zRotation = 0 }: { position: [number, number, number]; zRotation?: number }) {
  const { scene } = useGLTF('/models/hook.glb')

  // Traverse the loaded model scene graph to find white/light-grey parts
  // and recolor them to warning yellow/amber.
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat) => {
            if ('color' in mat && mat.color instanceof THREE.Color) {
              const col = mat.color
              // If the color is white/off-white/light-grey, override it to warning yellow
              if (col.r > 0.65 && col.g > 0.65 && col.b > 0.65) {
                col.set('#d97706') // safety warning color
                if ('metalness' in mat) (mat as any).metalness = 0.8
                if ('roughness' in mat) (mat as any).roughness = 0.2
              }
            }
          })
        }
      }
    })
  }, [scene])

  return (
    <group position={position} rotation={[0, 0, zRotation]}>
      <Clone
        object={scene}
        position={[0, 0, 0]}
        scale={[0.001, 0.001, 0.001]}
        rotation={[Math.PI / 2, 0, 0]} // align vertically with Z-axis
        castShadow
        receiveShadow
      />
    </group>
  )
}

// Sub-component to load the Blender wire rope sling model.
// Model is in Blender meters: rope axis along Y (−0.024 → 2.024 m), eye loops at each end.
// Raw Y extent = 2047.96 mm.  Real tip-to-tip length = 2000 mm.
// Shackle real height = 201 mm → ratio 2000/201 = 9.95×.
// Scale = 2000 / 2047.96 = 0.9766 so the rope renders at exactly 2000 mm,
// matching the 0.001-scaled shackle (201 mm) at the correct 9.95× proportion.
// Centroid Y = 0.99954 m → offset = −(0.99954 × 0.9766) = −0.9762 m.
function WireRopeModel({ position, zRotation = 0 }: { position: [number, number, number]; zRotation?: number }) {
  const { scene } = useGLTF('/models/wire-rope.glb')

  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((mat) => {
          if ('color' in mat && mat.color instanceof THREE.Color) {
            mat.color.set('#4e5c6a') // galvanised steel grey
            if ('metalness' in mat) (mat as any).metalness = 0.80
            if ('roughness' in mat) (mat as any).roughness = 0.30
          }
        })
      }
    })
  }, [scene])

  return (
    <group position={position} rotation={[0, 0, zRotation]}>
      {/* Base 90° offset so wire rope eye plane is perpendicular to other components at the same rotation step */}
      <group rotation={[0, 0, Math.PI / 2]}>
        {/* Rotate rope Y-axis → world Z-axis (vertical stack direction) */}
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Shift by scaled centroid so rope centre lands at the slot origin */}
          <group position={[0, -0.9762, 0]}>
            <Clone
              object={scene}
              scale={[0.9766, 0.9766, 0.9766]}
              castShadow
              receiveShadow
            />
          </group>
        </group>
      </group>
    </group>
  )
}

// Pre-load the assets to speed up rendering (fires at module-import time)
useGLTF.preload('/models/shackle.glb')
useGLTF.preload('/models/masterlink.glb')
useGLTF.preload('/models/masterlinkassembly.glb')
useGLTF.preload('/models/hook.glb')
useGLTF.preload('/models/wire-rope.glb')

// Gate component rendered OUTSIDE the Canvas inside an outer Suspense boundary.
// Calling useGLTF here (R3F v9 supports it outside Canvas) suspends this
// component — and therefore the entire Canvas — until all five GLBs are in the
// useGLTF cache. Once resolved, every useGLTF call inside the Canvas reads from
// cache synchronously, eliminating the Suspense-inside-Canvas timing race that
// caused models to stay stuck on procedural fallbacks after a page reload.
function ModelCache() {
  useGLTF('/models/shackle.glb')
  useGLTF('/models/masterlink.glb')
  useGLTF('/models/masterlinkassembly.glb')
  useGLTF('/models/hook.glb')
  useGLTF('/models/wire-rope.glb')
  return null
}

export function DesignVisualizer3D({
  items = [],
  height = 360,
  className,
}: DesignVisualizer3DProps) {
  const [displayLabels, setDisplayLabels] = useState(true)

  // Normalize items to ensure we have a valid array
  const activeItems = useMemo(() => {
    return Array.isArray(items) ? items : []
  }, [items])

  const N = activeItems.length

  // Mating/anchor points of components (relative to their local origin)
  const MATING_POINTS = useMemo(() => {
    return {
      Hook: { top: 0.22, bottom: -0.06 },
      Masterlink: { top: 0.094, bottom: -0.094 },
      MasterlinkAssembly: { top: 0.129, bottom: -0.320 },
      Shackle: { top: 0.140, bottom: 0.016 },
      WireRope: { top: 0.95, bottom: -0.95 },
      Placeholder: { top: 0.10, bottom: -0.10 }
    }
  }, [])

  // Calculate connected stack positions working backwards from the load point
  const stackLayout = useMemo(() => {
    const layout: { id: number; z: number; pos: [number, number, number]; zRotation: number }[] = []
    if (N === 0) {
      return {
        layout,
        hookZ: 1.5,
        hookZRotation: 0,
        loadZ: 0,
        midZ: 0.75,
        cameraPos: [2.5, 2.5, 0.75] as [number, number, number]
      }
    }

    const loadMatingZ = 0.10 // padeye pin height
    let currentTopZ = loadMatingZ

    // Traverse the active items in reverse (from load to hook)
    for (let i = N - 1; i >= 0; i--) {
      const item = activeItems[i]
      const type = item.component_type || 'Placeholder'
      const points = MATING_POINTS[type as keyof typeof MATING_POINTS] || MATING_POINTS.Placeholder

      // The center position of this component
      const z = currentTopZ - points.bottom

      // Alternating Z-rotation: even index → 0°, odd index → 90° for perpendicular stacking
      const zRotation = (i % 2 === 0) ? 0 : Math.PI / 2

      layout[i] = {
        id: i + 1,
        z,
        pos: [0, 0, z],
        zRotation
      }

      // The top mating point of this component becomes the base for the component above
      currentTopZ = z + points.top
    }

    // Connect Crane Hook to the top mating point of the first component
    const hookZ = currentTopZ - MATING_POINTS.Hook.bottom
    // Hook rotation is perpendicular to the first stack item
    const hookZRotation = N > 0 ? ((layout[0].zRotation + Math.PI / 2) % Math.PI) : 0
    const midZ = hookZ / 2
    const camDist = Math.max(2.0, hookZ * 1.1)
    const cameraPos: [number, number, number] = [camDist * 0.9, camDist * 0.9, midZ + camDist * 0.1]

    return {
      layout,
      hookZ,
      hookZRotation,
      loadZ: 0,
      midZ,
      cameraPos
    }
  }, [activeItems, N, MATING_POINTS])

  const { layout: positions, hookZ, hookZRotation, loadZ, midZ, cameraPos } = stackLayout

  const hookPos: [number, number, number] = [0, 0, hookZ]
  const loadPos: [number, number, number] = [0, 0, loadZ]
  const target: [number, number, number] = [0, 0, midZ]

  const hasItems = N > 0

  return (
    <div className="flex flex-col gap-2">
      {/*
        Outer Suspense gates Canvas mounting: ModelCache suspends until all five
        GLBs are in the useGLTF cache. The Canvas only mounts once the cache is
        warm, so every useGLTF call inside renders synchronously — no inner
        Suspense fallbacks needed and no risk of them getting stuck.
      */}
      <Suspense
        fallback={
          <div
            className={cn(
              'relative rounded-xl border border-border bg-card overflow-hidden shadow-inset-soft w-full flex items-center justify-center',
              className
            )}
            style={{ height }}
          >
            <span className="text-xs text-muted-foreground">Loading models…</span>
          </div>
        }
      >
        <ModelCache />

        <div
          className={cn(
            'relative rounded-xl border border-border bg-card overflow-hidden shadow-inset-soft w-full',
            className
          )}
          style={{ height }}
        >
          {/* Show/Hide Labels toggle */}
          <button
            type="button"
            onClick={() => setDisplayLabels((prev) => !prev)}
            className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card/90 border border-border text-[10px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-250 shadow-sm cursor-pointer select-none backdrop-blur-sm pointer-events-auto"
          >
            {displayLabels ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Hide Labels</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Show Labels</span>
              </>
            )}
          </button>

          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
            aria-label="3D rigging design visualizer"
          >
            <PerspectiveCamera makeDefault position={cameraPos} up={[0, 0, 1]} fov={40} near={0.1} far={100} />

            {/* Lighting */}
            <ambientLight intensity={0.65} />
            <directionalLight
              position={[5, 4, 10]}
              intensity={1.2}
              castShadow
            />
            <directionalLight position={[-4, -3, 3]} intensity={0.4} />
            <Environment preset="warehouse" />

            {/* Ground Grid */}
            <Grid
              position={[0, 0, -0.01]}
              rotation={[Math.PI / 2, 0, 0]}
              args={[20, 20]}
              cellSize={0.5}
              cellThickness={0.5}
              cellColor="#cbd5e1"
              sectionSize={2}
              sectionThickness={1.0}
              sectionColor="#94a3b8"
              fadeDistance={25}
              fadeStrength={1.2}
              infiniteGrid
              followCamera={false}
            />

            {/* Crane Hook — no Suspense needed; model is in cache */}
            <group>
              <HookModel position={hookPos} zRotation={hookZRotation} />
              {displayLabels && (
                <Html position={[0, 0.25, hookPos[2] + 0.1]} center style={{ pointerEvents: 'none' }}>
                  <div className="rounded bg-slate-800/90 text-white font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap shadow border border-slate-700">
                    Crane Hook
                  </div>
                </Html>
              )}
            </group>

            {/* Main central structural wire connecting hook to bottom load */}
            {hasItems && (
              <Line
                points={[new THREE.Vector3(...hookPos), new THREE.Vector3(...loadPos)]}
                color="#cbd5e1"
                lineWidth={0.5}
                dashed={true}
                dashSize={0.1}
                gapSize={0.08}
              />
            )}

            {/* Stack Components — no individual Suspense needed; all models in cache */}
            {positions.map((node, idx) => {
              const item = activeItems[idx]
              const type = item.component_type

              // Label text builder
              const labelContent = (() => {
                if (!type) return 'Unspecified Component'
                const parts = [type]
                if (item.manufacturer) parts.push(item.manufacturer)
                if (item.model) parts.push(item.model)
                if (item.capacity) {
                  const unit = type === 'WireRope' ? 'Te (MBL)' : 'Te (WLL)'
                  parts.push(`${item.capacity}${unit}`)
                }
                return parts.join(' - ')
              })()

              if (type === 'Masterlink') {
                return (
                  <group key={`comp-${node.id}`}>
                    <MasterlinkModel position={node.pos} zRotation={node.zRotation} />

                    {displayLabels && (
                      <Html position={[0.22, 0, node.z]} style={{ pointerEvents: 'none', transform: 'translateY(-50%)' }}>
                        <div className="rounded border border-amber-200 bg-amber-50/95 px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow whitespace-nowrap dark:border-amber-900/50 dark:bg-amber-950/90 dark:text-amber-300">
                          <span className="opacity-75">Pos {node.id}: </span>
                          <span className="font-bold">{labelContent}</span>
                        </div>
                      </Html>
                    )}
                  </group>
                )
              }

              if (type === 'MasterlinkAssembly') {
                return (
                  <group key={`comp-${node.id}`}>
                    <MasterlinkAssemblyModel position={node.pos} zRotation={node.zRotation} />

                    {displayLabels && (
                      <Html position={[0.22, 0, node.z]} style={{ pointerEvents: 'none', transform: 'translateY(-50%)' }}>
                        <div className="rounded border border-amber-200 bg-amber-50/95 px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow whitespace-nowrap dark:border-amber-900/50 dark:bg-amber-950/90 dark:text-amber-300">
                          <span className="opacity-75">Pos {node.id}: </span>
                          <span className="font-bold">{labelContent}</span>
                        </div>
                      </Html>
                    )}
                  </group>
                )
              }

              if (type === 'Shackle') {
                return (
                  <group key={`comp-${node.id}`}>
                    <ShackleModel position={node.pos} zRotation={node.zRotation} />

                    {displayLabels && (
                      <Html position={[0.22, 0, node.z]} style={{ pointerEvents: 'none', transform: 'translateY(-50%)' }}>
                        <div className="rounded border border-slate-200 bg-slate-50/95 px-2 py-0.5 text-[10px] font-medium text-slate-800 shadow whitespace-nowrap dark:border-slate-800/50 dark:bg-slate-900/90 dark:text-slate-300">
                          <span className="opacity-75">Pos {node.id}: </span>
                          <span className="font-bold">{labelContent}</span>
                        </div>
                      </Html>
                    )}
                  </group>
                )
              }

              if (type === 'WireRope') {
                const ropeLabel = (() => {
                  const parts = ['Wire Rope']
                  if (item.capacity) parts.push(`${item.capacity}Te (MBL)`)
                  if (item.eye_type) parts.push(`${item.eye_type} eye`)
                  if (item.termination) parts.push(`${item.termination}`)
                  return parts.join(' - ')
                })()

                const slingMidZ = node.z

                return (
                  <group key={`comp-${node.id}`}>
                    <WireRopeModel position={[0, 0, slingMidZ]} zRotation={node.zRotation} />

                    {displayLabels && (
                      <Html position={[0.22, 0, slingMidZ]} style={{ pointerEvents: 'none', transform: 'translateY(-50%)' }}>
                        <div className="rounded border border-blue-200 bg-blue-50/95 px-2 py-0.5 text-[10px] font-medium text-blue-800 shadow whitespace-nowrap dark:border-blue-900/50 dark:bg-blue-950/90 dark:text-blue-300">
                          <span className="opacity-75">Pos {node.id}: </span>
                          <span className="font-bold">{ropeLabel}</span>
                        </div>
                      </Html>
                    )}
                  </group>
                )
              }

              // Unspecified / Placeholder Component
              return (
                <group key={`comp-${node.id}`} position={node.pos}>
                  <Sphere args={[0.08, 16, 16]} castShadow>
                    <meshStandardMaterial
                      color="#94a3b8"
                      transparent
                      opacity={0.25}
                      wireframe
                    />
                  </Sphere>
                  {displayLabels && (
                    <Html position={[0.22, 0, 0]} style={{ pointerEvents: 'none', transform: 'translateY(-50%)' }}>
                      <div className="rounded border border-dashed border-slate-300 bg-slate-50/60 px-2 py-0.5 text-[10px] font-medium text-slate-400 shadow whitespace-nowrap backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
                        <span className="opacity-70">Pos {node.id}: </span>
                        <span>Unspecified Component</span>
                      </div>
                    </Html>
                  )}
                </group>
              )
            })}

            {/* Bottom Load Anchor point */}
            <group position={loadPos}>
              {/* TODO: Add generic padeye/lifting lug model here */}
              {displayLabels && (
                <Html position={[0, -0.2, 0]} center style={{ pointerEvents: 'none' }}>
                  <div className="rounded bg-slate-800/90 text-white font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap shadow border border-slate-700">
                    Lifting Point / Padeye
                  </div>
                </Html>
              )}
            </group>

            {/* Empty state visual guides */}
            {!hasItems && (
              <group position={[0, 0, 1.0]}>
                <Html center style={{ pointerEvents: 'none' }}>
                  <div className="rounded-lg border border-dashed border-slate-300 bg-card/65 px-4 py-3 text-center text-xs text-muted-foreground shadow-sm whitespace-nowrap backdrop-blur-sm">
                    Add component rows to visualize arrangement stack
                  </div>
                </Html>
              </group>
            )}

            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              minDistance={1}
              maxDistance={30}
              target={target}
            />

            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewport
                axisColors={['#ef4444', '#22c55e', '#3b82f6']}
                labelColor="#0f172a"
              />
            </GizmoHelper>
          </Canvas>

          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-card/85 px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground backdrop-blur">
            drag · scroll · right-click pan
          </div>
        </div>
      </Suspense>
      <div className="text-xs text-muted-foreground italic px-1">
        * Note: This is a representative view of a single sling rigging arrangement.
      </div>
    </div>
  )
}

export default DesignVisualizer3D
