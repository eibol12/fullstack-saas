import { useMemo, useState, Suspense } from 'react'
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
  useGLTF,
} from '@react-three/drei'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

// Set Three.js default UP to Z axis to align with engineering coords
THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

/**
 * Input shape for the geometry visualizer.
 * Supports BOTH legacy relative L/h/B parameters AND new absolute Visual Datum coordinates.
 */
export interface GeometryVisualizerInput {
  // Legacy relative parameters
  L1?: number | string | null
  L2?: number | string | null
  L3?: number | string | null
  L4?: number | string | null
  h1?: number | string | null
  h2?: number | string | null
  h3?: number | string | null
  h4?: number | string | null
  B1?: number | string | null
  B2?: number | string | null
  B3?: number | string | null
  B4?: number | string | null
  quadrant?: 'center' | 'left' | 'right' | null
  crane_height?: number | string | null

  // New absolute coordinates
  cog?: { x: number; y: number; z: number } | null
  points?: Array<{ x: number; y: number; z: number }> | null
  h_max?: number | null
  datum_geometry_input?: {
    cog: { x: number; y: number; z: number }
    points: Array<{ x: number; y: number; z: number }>
    same_height?: boolean
  } | null

  // Common properties
  lifting_points_qty?: number | string | null
  load_label?: string | null
  sling_tensions?: Partial<Record<'1' | '2' | '3' | '4', number>>
  bulwark_height?: number | null
}

interface GeometryVisualizer3DProps extends GeometryVisualizerInput {
  className?: string
  height?: number
  showLabels?: boolean
}

type Node3D = {
  id: number
  /** Position in Three.js coordinate space (X, Y=elevation, Z=depth) */
  position: [number, number, number]
  /** Absolute height */
  z: number
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function nonNeg(v: number | null, fallback = 0): number {
  if (v === null || v < 0) return fallback
  return v
}

/**
 * Translates props (either absolute coordinates or legacy relative ones)
 * into a single unified Absolute Coordinate representation.
 */
function getAbsoluteGeometry(input: GeometryVisualizer3DProps) {
  // 1. Check if absolute points are directly provided
  if (input.cog && input.points) {
    const qty = Math.max(1, Math.min(4, toNum(input.lifting_points_qty) ?? input.points.length))
    return {
      cog: input.cog,
      points: input.points,
      hMax: input.h_max ?? toNum(input.crane_height) ?? 1,
      liftingPointsQty: qty,
    }
  }

  // 2. Check if configuration has datum_geometry_input
  if (input.datum_geometry_input) {
    const qty = Math.max(1, Math.min(4, toNum(input.lifting_points_qty) ?? input.datum_geometry_input.points.length))
    return {
      cog: input.datum_geometry_input.cog,
      points: input.datum_geometry_input.points,
      hMax: input.h_max ?? toNum(input.crane_height) ?? 1,
      liftingPointsQty: qty,
    }
  }

  // 3. Fallback: convert legacy relative L/B/h values to absolute coordinates
  // placing CoG at (0, 0, 0)
  const Ls = [toNum(input.L1), toNum(input.L2), toNum(input.L3), toNum(input.L4)]
  const Bs = [toNum(input.B1), toNum(input.B2), toNum(input.B3), toNum(input.B4)]
  const Hs = [toNum(input.h1), toNum(input.h2), toNum(input.h3), toNum(input.h4)]

  const lpqRaw = toNum(input.lifting_points_qty)
  const inferred = Ls.filter((L) => L !== null && L >= 0).length
  const lpq = Math.max(1, Math.min(4, lpqRaw ?? (inferred || 2)))
  const hMax = toNum(input.crane_height) ?? toNum(input.h_max) ?? 1
  const quadrant = (input.quadrant ?? 'left').toLowerCase()

  const cog = { x: 0, y: 0, z: 0 }
  const points: Array<{ x: number; y: number; z: number }> = []

  const addPoint = (x: number, y: number, z: number) => {
    points.push({ x, y, z })
  }

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

function WireRopeMesh({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const { scene } = useGLTF('/models/wire-rope.glb')

  const { clonedScene, boxMinY, originalLength } = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((mat: any) => {
          if (mat.color instanceof THREE.Color) {
            mat.color.set('#4e5c6a')
            mat.metalness = 0.80
            mat.roughness = 0.30
          }
        })
      }
    })
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    box.getSize(size)
    return {
      clonedScene: clone,
      boxMinY: box.min.y,
      originalLength: size.y > 0.1 ? size.y : Math.max(size.x, size.y, size.z),
    }
  }, [scene])

  const distance = start.distanceTo(end)
  if (distance < 0.001) return null

  const scaleY = distance / originalLength
  const direction = end.clone().sub(start).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

  return (
    <group position={start.toArray()} quaternion={quaternion}>
      <primitive
        object={clonedScene}
        position={[0, -scaleY * boxMinY, 0]}
        scale={[1, scaleY, 1]}
      />
    </group>
  )
}

useGLTF.preload('/models/wire-rope.glb')

export function GeometryVisualizer3D({
  className,
  height = 320,
  showLabels = true,
  ...input
}: GeometryVisualizer3DProps) {
  const [displayLabels, setDisplayLabels] = useState(showLabels)

  // Translate input geometry to absolute terms
  const geom = useMemo(() => getAbsoluteGeometry(input), [
    input.L1, input.L2, input.L3, input.L4,
    input.B1, input.B2, input.B3, input.B4,
    input.h1, input.h2, input.h3, input.h4,
    input.cog, input.points, input.h_max, input.datum_geometry_input,
    input.lifting_points_qty, input.quadrant, input.crane_height,
  ])

  const { cog, points, hMax, liftingPointsQty } = geom
  const activePoints = useMemo(() => points.slice(0, liftingPointsQty), [points, liftingPointsQty])

  // Build three-js coordinate structures
  // React Coordinate mapping to Three.js coordinates (Z-up system):
  // - React X (longitudinal) -> Three X
  // - React Y (transverse) -> Three Y
  // - React Z (elevation/vertical) -> Three Z
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
    const sizeY = Math.max(0.8, (maxY - minY) + pad * 2) // depth/transverse in ThreeJS
    const sizeZ = Math.max(0.8, (maxZ - minZ) + pad * 2) // height/vertical in ThreeJS

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2

    // Bounding Box Center in ThreeJS space [X, Y, Z]
    const center: [number, number, number] = [cx, cy, cz]
    // Bounding Box Size in ThreeJS space [width (X), transverse (Y), height (Z)]
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

  // Empty-state placeholder
  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-border bg-card/40 grid place-items-center text-xs text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        Enter coordinates to render the 3D structure visualization.
      </div>
    )
  }

  const bulwarkHeight = toNum(input.bulwark_height) ?? 0
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
      className={cn(
        'relative rounded-xl border border-border bg-card overflow-hidden shadow-inset-soft',
        className,
      )}
      style={{ height }}
    >
      {/* Dynamic toggle button for showing/hiding labels */}
      <button
        type="button"
        onClick={() => setDisplayLabels((prev) => !prev)}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-card/90 border border-border text-[10px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-250 shadow-sm cursor-pointer select-none backdrop-blur-sm pointer-events-auto"
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
        aria-label="3D lifting geometry visualizer"
      >
        <PerspectiveCamera makeDefault position={cameraPos} up={[0, 0, 1]} fov={42} near={0.1} far={500} />

        {/* Lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[cog.x + 8, cog.y + 6, cog.z + 14]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[cog.x - 6, cog.y - 4, cog.z + 4]} intensity={0.35} />
        <Environment preset="warehouse" />

        {/* Ground reference grid below the lowest point on the XY plane */}
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

        {/* Dynamic Bounding Box around the structure */}
        {bounds && (
          <mesh position={bounds.center} castShadow receiveShadow>
            <boxGeometry args={bounds.size} />
            <meshStandardMaterial
              color="#3b82f6"
              transparent
              opacity={0.12}
              roughness={0.7}
              metalness={0.05}
            />
            <Edges color="#475569" linewidth={1.5} />
          </mesh>
        )}

        {/* Datum Reference: Thicker, shorter custom Axes Helper at absolute (0,0,0) */}
        <group position={[0, 0, 0]}>
          {/* X Axis (Red) */}
          <mesh position={[0.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          {/* Y Axis (Green) */}
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
          {/* Z Axis (Blue) */}
          <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
          {displayLabels && (
            <Html position={[0.1, 0.1, 0.1]} style={{ pointerEvents: 'none' }}>
              <div className="bg-primary/95 text-primary-foreground font-mono text-[9px] px-1 py-0.2 rounded border shadow-sm">
                Datum (0,0,0)
              </div>
            </Html>
          )}
        </group>

        {/* CoG Reference Point */}
        <group position={[cog.x, cog.y, cog.z]}>
          <Sphere args={[0.16, 32, 32]} castShadow>
            <meshStandardMaterial color="#ef4444" metalness={0.7} roughness={0.3} />
          </Sphere>
          {displayLabels && (
            <Html position={[0, 0, 0.3]} center style={{ pointerEvents: 'none' }}>
              <div className="bg-destructive text-destructive-foreground font-mono text-[9px] px-1 py-0.2 rounded border shadow-sm">
                CoG
              </div>
            </Html>
          )}
        </group>

        {/* Hook */}
        <group position={hookPos}>
          <Cone args={[0.18, 0.36, 16]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.35} />
          </Cone>
          <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09, 0.025, 12, 24]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>

        {/* Slings */}
        {nodes.map((node) => {
          const tension = input.sling_tensions?.[String(node.id) as '1' | '2' | '3' | '4']
          const mid: [number, number, number] = [
            (node.position[0] + hookPos[0]) / 2,
            (node.position[1] + hookPos[1]) / 2,
            (node.position[2] + hookPos[2]) / 2,
          ]
          return (
            <group key={`sling-${node.id}`}>
              <Suspense fallback={
                <Line
                  points={[new THREE.Vector3(...hookPos), new THREE.Vector3(...node.position)]}
                  color="#0f172a"
                  lineWidth={2}
                />
              }>
                <WireRopeMesh 
                  start={new THREE.Vector3(...node.position)} 
                  end={new THREE.Vector3(...hookPos)} 
                />
              </Suspense>
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
                    className="rounded-md border border-border/70 bg-card/90 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-foreground shadow-sm backdrop-blur"
                  >
                    <span className="text-muted-foreground">S{node.id}</span>
                    {typeof tension === 'number' && Number.isFinite(tension) && (
                      <span className="ml-1 tabular-nums">{tension.toFixed(1)} kN</span>
                    )}
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

        {/* Bounding box name/label */}
        {input.load_label && bounds && displayLabels && (
          <Html
            position={[bounds.center[0], bounds.center[1], lowestZ - 0.2]}
            center
            distanceFactor={10}
            occlude={false}
            style={{ pointerEvents: 'none' }}
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-card/50 px-1.5 py-0.2 rounded backdrop-blur-sm">
              {input.load_label}
            </div>
          </Html>
        )}

        </group>{/* end elevation group */}

        {/* Camera Controls */}
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

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-card/80 px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground backdrop-blur">
        drag · scroll · right-click pan
      </div>
    </div>
  )
}

export default GeometryVisualizer3D
