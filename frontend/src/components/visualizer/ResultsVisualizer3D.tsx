import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Line,
  Sphere,
  Cone,
  Edges,
  Html,
  Environment,
  PerspectiveCamera,
} from '@react-three/drei'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import type { LiftingAnalysis } from '@/types'

// Set Three.js default UP to Z axis to align with engineering coords
THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

interface ResultsVisualizer3DProps {
  analysis: LiftingAnalysis
  height?: number
  bulwark_height?: number | null
}

type Node3D = {
  id: number
  /** Position in Three.js coordinate space (X, Y, Z) */
  position: [number, number, number]
  z: number
}

function getAbsoluteGeometry(analysis: LiftingAnalysis) {
  const { configuration, lifting_points_qty } = analysis

  // 1. Check if absolute points are directly provided in datum_geometry_input
  if (configuration.datum_geometry_input) {
    const qty = Math.max(1, Math.min(4, lifting_points_qty ?? configuration.datum_geometry_input.points.length))
    return {
      cog: configuration.datum_geometry_input.cog,
      points: configuration.datum_geometry_input.points,
      hMax: configuration.h_max ?? 1,
      liftingPointsQty: qty,
    }
  }

  // 2. Fallback: convert legacy relative L/B/h values to absolute coordinates
  // placing CoG at (0, 0, 0)
  const Ls = [configuration.L1, configuration.L2, configuration.L3, configuration.L4].map(v => typeof v === 'number' ? v : null)
  const Bs = [configuration.B1, configuration.B2, configuration.B3, configuration.B4].map(v => typeof v === 'number' ? v : null)
  const Hs = [configuration.h1, configuration.h2, configuration.h3, configuration.h4].map(v => typeof v === 'number' ? v : null)

  const lpq = Math.max(1, Math.min(4, lifting_points_qty ?? 2))
  const hMax = configuration.h_max ?? 1
  const quadrant = (configuration.quadrant ?? 'left').toLowerCase()

  const cog = { x: 0, y: 0, z: 0 }
  const points: Array<{ x: number; y: number; z: number }> = []

  const addPoint = (x: number, y: number, z: number) => {
    points.push({ x, y, z })
  }

  const nonNeg = (v: number | null, fallback = 0) => (v === null || v < 0 ? fallback : v)

  if (lpq === 1) {
    addPoint(0, 0, 0)
  } else if (lpq === 2) {
    const L1 = nonNeg(Ls[0])
    const L2 = nonNeg(Ls[1], L1)
    const h1 = nonNeg(Hs[0])
    const h2 = nonNeg(Hs[1])
    addPoint(-L1, 0, h1)
    addPoint(L2, 0, h2)
  } else if (lpq === 3) {
    const L1 = nonNeg(Ls[0])
    const L2 = nonNeg(Ls[1])
    const L3 = nonNeg(Ls[2])
    const B1 = nonNeg(Bs[0])
    const B2 = nonNeg(Bs[1])
    const B3 = nonNeg(Bs[2])
    const h1 = nonNeg(Hs[0])
    const h2 = nonNeg(Hs[1])
    const h3 = nonNeg(Hs[2])
    const y1 = quadrant === 'right' ? -B1 : B1
    addPoint(-L1, y1, h1)
    addPoint(L2, B2, h2)
    addPoint(L3, -B3, h3)
  } else if (lpq === 4) {
    const L1 = nonNeg(Ls[0])
    const L2 = nonNeg(Ls[1])
    const L3 = nonNeg(Ls[2], L1)
    const L4 = nonNeg(Ls[3], L2)
    const B1 = nonNeg(Bs[0])
    const B2 = nonNeg(Bs[1])
    const B3 = nonNeg(Bs[2], B1)
    const B4 = nonNeg(Bs[3], B2)
    const h1 = nonNeg(Hs[0])
    const h2 = nonNeg(Hs[1])
    const h3 = nonNeg(Hs[2])
    const h4 = nonNeg(Hs[3])
    addPoint(-L1, -B1, h1)
    addPoint(L2, -B2, h2)
    addPoint(L3, B3, h3)
    addPoint(-L4, B4, h4)
  }

  return {
    cog,
    points,
    hMax,
    liftingPointsQty: lpq,
  }
}

export function ResultsVisualizer3D({
  analysis,
  height = 320,
  bulwark_height,
}: ResultsVisualizer3DProps) {
  const [showDynamic, setShowDynamic] = useState(false)
  const [displayLabels, setDisplayLabels] = useState(true)

  // Translate geometry coordinates
  const geom = useMemo(() => getAbsoluteGeometry(analysis), [analysis])
  const { cog, points, hMax, liftingPointsQty } = geom
  const activePoints = useMemo(() => points.slice(0, liftingPointsQty), [points, liftingPointsQty])

  // Extract static and dynamic result loads
  const staticHookLoad = analysis.results?.static_results?.hook_load ?? 0
  const staticSlingLoads = analysis.results?.static_results?.static_sling_loads ?? []
  const dynamicHookLoad = analysis.results?.dynamic_results?.hook_load ?? 0
  const dynamicSlingLoads = analysis.results?.dynamic_results?.dynamic_sling_loads ?? []

  // Build ThreeJS coordinates
  const nodes = useMemo<Node3D[]>(() => {
    return activePoints.map((p, idx) => ({
      id: idx + 1,
      position: [p.x, p.y, p.z],
      z: p.z,
    }))
  }, [activePoints])

  const hookPos = useMemo<[number, number, number]>(() => {
    return [cog.x, cog.y, cog.z + hMax]
  }, [cog, hMax])

  // Calculate dynamic bounding box of the active structure
  const bounds = useMemo(() => {
    if (nodes.length === 0) return null
    const xs = [cog.x, ...activePoints.map((p) => p.x)]
    const ys = [cog.y, ...activePoints.map((p) => p.y)]
    const zs = [cog.z, ...activePoints.map((p) => p.z)]

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const minZ = Math.min(...zs)
    const maxZ = Math.max(...zs)

    const pad = 0.4
    const sizeX = Math.max(0.8, (maxX - minX) + pad * 2)
    const sizeY = Math.max(0.8, (maxY - minY) + pad * 2)
    const sizeZ = Math.max(0.8, (maxZ - minZ) + pad * 2)

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2

    const center: [number, number, number] = [cx, cy, cz]
    const size: [number, number, number] = [sizeX, sizeY, sizeZ]

    return {
      center,
      size,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
    }
  }, [nodes, activePoints, cog])

  if (nodes.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-card/40 grid place-items-center text-xs text-muted-foreground"
        style={{ height }}
      >
        No geometry coordinates found to render the results visualization.
      </div>
    )
  }

  const bulwarkHeight = (typeof bulwark_height === 'number' && isFinite(bulwark_height)) ? bulwark_height : 0
  const zElevation = bulwarkHeight > 0 ? Math.max(0, bulwarkHeight - 0.5) : 0

  const span = bounds
    ? Math.max(bounds.size[0], bounds.size[1], hMax + bounds.size[2] + zElevation)
    : 4
  const camDist = Math.max(6, span * 1.8)
  const cameraPos: [number, number, number] = [
    cog.x + camDist,
    cog.y + camDist,
    cog.z + zElevation + camDist * 0.7,
  ]

  const lowestZ = bounds ? bounds.minZ : 0

  return (
    <div
      className="relative rounded-xl border border-border bg-card overflow-hidden shadow-inset-soft"
      style={{ height }}
    >
      {/* Dynamic Toggle between Static and Dynamic Loads */}
      <div className="absolute top-2 left-2 z-10 flex bg-card/90 border border-border p-0.5 rounded-lg shadow-sm backdrop-blur-sm select-none pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowDynamic(false)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 cursor-pointer",
            !showDynamic
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Static Loads
        </button>
        <button
          type="button"
          onClick={() => setShowDynamic(true)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 cursor-pointer",
            showDynamic
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Dynamic Loads
        </button>
      </div>

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
        aria-label="3D results load visualizer"
      >
        <PerspectiveCamera makeDefault position={cameraPos} up={[0, 0, 1]} fov={42} near={0.1} far={500} />

        {/* Lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[cog.x + 8, cog.y + 6, cog.z + 14]}
          intensity={1.1}
          castShadow
        />
        <directionalLight position={[cog.x - 6, cog.y - 4, cog.z + 4]} intensity={0.35} />
        <Environment preset="warehouse" />

        {/* Ground Reference Grid */}
        <Grid
          position={[cog.x, cog.y, lowestZ - 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
          args={[Math.max(20, span * 4), Math.max(20, span * 4)]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#94a3b8"
          sectionSize={2}
          sectionThickness={1.2}
          sectionColor="#475569"
          fadeDistance={Math.max(40, span * 6)}
          fadeStrength={1.2}
          infiniteGrid
          followCamera={false}
        />

        {/* Bulwark Wall — rendered at deck level, outside the elevation group */}
        {bulwarkHeight > 0 && bounds && (() => {
          const pad = 2.0
          const wallT = 0.15
          const bW = (bounds.maxX - bounds.minX) + pad * 2
          const bD = (bounds.maxY - bounds.minY) + pad * 2
          const deckZ = lowestZ - 0.5
          const cx = (bounds.minX + bounds.maxX) / 2
          const cy = (bounds.minY + bounds.maxY) / 2
          return (
            <group position={[cx, cy, deckZ + bulwarkHeight / 2]}>
              <mesh position={[0, bD / 2, 0]}>
                <boxGeometry args={[bW + wallT * 2, wallT, bulwarkHeight]} />
                <meshStandardMaterial color="#64748b" transparent opacity={0.35} roughness={0.7} metalness={0.1} />
              </mesh>
              <mesh position={[0, -bD / 2, 0]}>
                <boxGeometry args={[bW + wallT * 2, wallT, bulwarkHeight]} />
                <meshStandardMaterial color="#64748b" transparent opacity={0.35} roughness={0.7} metalness={0.1} />
              </mesh>
              <mesh position={[-bW / 2, 0, 0]}>
                <boxGeometry args={[wallT, bD, bulwarkHeight]} />
                <meshStandardMaterial color="#64748b" transparent opacity={0.35} roughness={0.7} metalness={0.1} />
              </mesh>
              <mesh position={[bW / 2, 0, 0]}>
                <boxGeometry args={[wallT, bD, bulwarkHeight]} />
                <meshStandardMaterial color="#64748b" transparent opacity={0.35} roughness={0.7} metalness={0.1} />
              </mesh>
              {displayLabels && (
                <Html position={[0, 0, bulwarkHeight / 2 + 0.2]} center style={{ pointerEvents: 'none' }}>
                  <div className="font-mono text-[9px] text-muted-foreground bg-card/60 px-1 rounded backdrop-blur-sm">
                    Bulwark {bulwarkHeight.toFixed(1)} m
                  </div>
                </Html>
              )}
            </group>
          )
        })()}

        {/* Elevation group — lifts all scene objects above the bulwark */}
        <group position={[0, 0, zElevation]}>

        {/* Dynamic Bounding Box around the structure (Load object) */}
        {bounds && (
          <mesh position={bounds.center} castShadow receiveShadow>
            <boxGeometry args={bounds.size} />
            <meshStandardMaterial
              color={showDynamic ? "#f97316" : "#22c55e"}
              transparent
              opacity={0.08}
              roughness={0.7}
              metalness={0.05}
            />
            <Edges color={showDynamic ? "#f97316" : "#22c55e"} linewidth={1.5} />
          </mesh>
        )}

        {/* Hook with dynamic/static weight labels */}
        <group position={hookPos}>
          <Cone args={[0.18, 0.36, 16]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.35} />
          </Cone>
          <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09, 0.025, 12, 24]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.35} />
          </mesh>
          {displayLabels && (
            <Html position={[0, 0, 0.45]} center style={{ pointerEvents: 'none' }}>
              <div className={cn(
                "border text-white font-mono text-[10px] px-2 py-0.5 rounded shadow-md whitespace-nowrap",
                showDynamic ? "bg-orange-600 border-orange-500" : "bg-green-600 border-green-500"
              )}>
                {showDynamic ? 'Dyn Hook: ' : 'Stat Hook: '}
                <span className="font-bold">
                  {(showDynamic ? dynamicHookLoad : staticHookLoad).toFixed(2)} Te
                </span>
              </div>
            </Html>
          )}
        </group>

        {/* Slings with dynamic/static load labels */}
        {nodes.map((node, idx) => {
          const slingLoad = showDynamic 
            ? (dynamicSlingLoads[idx] ?? 0) 
            : (staticSlingLoads[idx] ?? 0)

          const mid: [number, number, number] = [
            (node.position[0] + hookPos[0]) / 2,
            (node.position[1] + hookPos[1]) / 2,
            (node.position[2] + hookPos[2]) / 2,
          ]

          return (
            <group key={`sling-${node.id}`}>
              <Line
                points={[new THREE.Vector3(...hookPos), new THREE.Vector3(...node.position)]}
                color="#0f172a"
                lineWidth={2}
                dashed={false}
              />
              {displayLabels && (
                <Html
                  position={mid}
                  center
                  distanceFactor={10}
                  occlude={false}
                  zIndexRange={[10, 0]}
                  style={{ pointerEvents: 'none' }}
                >
                  <div
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-tight shadow-sm backdrop-blur",
                      showDynamic 
                        ? "border-orange-200 bg-orange-50/95 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/90 dark:text-orange-300"
                        : "border-green-200 bg-green-50/90 text-green-800 dark:border-green-900/50 dark:bg-green-950/90 dark:text-green-300"
                    )}
                  >
                    <span className="opacity-70">S{node.id}: </span>
                    <span className="font-bold tabular-nums">{slingLoad.toFixed(2)} Te</span>
                  </div>
                </Html>
              )}
            </group>
          )
        })}

        {/* Lugs / Lifting points */}
        {nodes.map((node) => (
          <group key={`node-${node.id}`} position={node.position}>
            <Sphere args={[0.13, 32, 32]} castShadow>
              <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
            </Sphere>
            {displayLabels && (
              <Html
                position={[0, 0, 0.26]}
                center
                distanceFactor={10}
                occlude={false}
                style={{ pointerEvents: 'none' }}
              >
                <div className="rounded-full bg-primary/95 px-1.5 py-0 font-mono text-[10px] font-semibold text-primary-foreground shadow">
                  {node.id}
                </div>
              </Html>
            )}
          </group>
        ))}

        </group>{/* end elevation group */}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={Math.max(40, span * 8)}
          target={bounds
            ? [bounds.center[0], bounds.center[1], bounds.center[2] + zElevation]
            : [cog.x, cog.y, cog.z + zElevation]}
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
  )
}

export default ResultsVisualizer3D
