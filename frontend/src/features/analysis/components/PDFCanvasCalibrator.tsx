import React, { useRef, useState, useEffect } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { Upload, Scale, Check, AlertCircle, X, ChevronRight, ChevronDown, Compass } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Initialize pdfjs worker in Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PDFCanvasCalibratorProps {
  isOpen: boolean
  onClose: () => void
  onApplyCoordinates: (coords: {
    x_cog: number
    y_cog: number
    z_cog: number
    points: Array<{ x: number; y: number; z: number }>
  }) => void
  liftingPointsQty: number
  sameHeight?: boolean
  initialCoords?: {
    x_cog: number
    y_cog: number
    z_cog: number
    points: Array<{ x: number; y: number; z: number }>
  }
}

type Mode = 'idle' | 'calibrate-1' | 'calibrate-2' | 'measure-cog' | 'measure-lug'
type ViewMode = 'profile' | 'plan' | 'frontal' // Profile: X (horiz) & Z (vert). Plan: X (horiz) & Y (vert). Frontal: Y (horiz) & Z (vert).

interface PixelPoint {
  x: number
  y: number
}

export function PDFCanvasCalibrator({
  isOpen,
  onClose,
  onApplyCoordinates,
  liftingPointsQty,
  sameHeight,
  initialCoords,
}: PDFCanvasCalibratorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // PDF Document & Page States
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pdfPage, setPdfPage] = useState<pdfjs.PDFPageProxy | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)

  // Calibration & Coordinate States
  const [viewMode, setViewMode] = useState<ViewMode>('profile')
  const [mode, setMode] = useState<Mode>('idle')
  const [activeLugIndex, setActiveLugIndex] = useState<number>(0)

  // Pixels space coordinates
  const [calibPoint1, setCalibPoint1] = useState<PixelPoint | null>(null)
  const [calibPoint2, setCalibPoint2] = useState<PixelPoint | null>(null)
  const [scaleRatio, setScaleRatio] = useState<number | null>(null) // physical meters per pixel
  const [knownDistanceInput, setKnownDistanceInput] = useState<string>('5000')

  // Pixels space coordinates (separated for Profile, Plan, and Frontal views)
  const [cogProfilePixel, setCogProfilePixel] = useState<PixelPoint | null>(null)
  const [cogPlanPixel, setCogPlanPixel] = useState<PixelPoint | null>(null)
  const [cogFrontalPixel, setCogFrontalPixel] = useState<PixelPoint | null>(null)
  const [lugsProfilePixel, setLugsProfilePixel] = useState<Array<PixelPoint | null>>(() =>
    Array(4).fill(null)
  )
  const [lugsPlanPixel, setLugsPlanPixel] = useState<Array<PixelPoint | null>>(() =>
    Array(4).fill(null)
  )
  const [lugsFrontalPixel, setLugsFrontalPixel] = useState<Array<PixelPoint | null>>(() =>
    Array(4).fill(null)
  )

  // Physical coordinates (meters)
  const [xCog, setXCog] = useState<number>(initialCoords?.x_cog ?? 0)
  const [yCog, setYCog] = useState<number>(initialCoords?.y_cog ?? 0)
  const [zCog, setZCog] = useState<number>(initialCoords?.z_cog ?? 0)
  const [points, setPoints] = useState<Array<{ x: number; y: number; z: number }>>(() => {
    const defaultPoints = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0 }))
    if (initialCoords?.points) {
      initialCoords.points.forEach((p, idx) => {
        if (idx < 4) defaultPoints[idx] = { ...p }
      })
    }
    return defaultPoints
  })

  // Buffer canvas to cache the PDF page render
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Magnifier States
  const [showMagnifier, setShowMagnifier] = useState<boolean>(true)
  const [magnifierZoom, setMagnifierZoom] = useState<number>(3)
  const [mousePos, setMousePos] = useState<PixelPoint | null>(null)
  const magnifierCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Sidebar Steps Accordion State
  const [expandedSteps, setExpandedSteps] = useState<{
    step1: boolean
    step2: boolean
    step3: boolean
  }>({
    step1: true,
    step2: true,
    step3: true,
  })

  const toggleStep = (stepKey: 'step1' | 'step2' | 'step3') => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepKey]: !prev[stepKey],
    }))
  }

  // Re-hydrate coordinates when initialCoords changes
  useEffect(() => {
    if (initialCoords) {
      setXCog(initialCoords.x_cog)
      setYCog(initialCoords.y_cog)
      setZCog(initialCoords.z_cog)
      if (initialCoords.points) {
        setPoints((prev) => {
          const next = [...prev]
          initialCoords.points.forEach((p, i) => {
            if (i < 4) next[i] = { ...p }
          })
          return next
        })
      }
    }
  }, [initialCoords])

  // Load PDF file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const doc = await loadingTask.promise
      setPdfDoc(doc)
      setTotalPages(doc.numPages)
      setCurrentPage(1)
      await loadPage(doc, 1)
      // Auto-advance to Step 2
      setExpandedSteps((prev) => ({ ...prev, step1: false, step2: true }))
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to load PDF drawing. Make sure it is not corrupted.')
    } finally {
      setLoading(false)
    }
  }

  // Load specific page
  const loadPage = async (doc: pdfjs.PDFDocumentProxy, pageNum: number) => {
    try {
      const page = await doc.getPage(pageNum)
      setPdfPage(page)
      // Reset calibration / selections when page changes
      setCalibPoint1(null)
      setCalibPoint2(null)
      setCogProfilePixel(null)
      setCogPlanPixel(null)
      setLugsProfilePixel(Array(4).fill(null))
      setLugsPlanPixel(Array(4).fill(null))
      setMode('idle')
      setMousePos(null)
    } catch (err) {
      console.error(err)
      toast.error('Error loading PDF page.')
    }
  }

  // Render PDF page to buffer canvas
  useEffect(() => {
    if (!pdfPage || !canvasRef.current) return

    const renderPDF = async () => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Use a fixed display width or match container
      const containerWidth = containerRef.current?.clientWidth ?? 800
      const viewport = pdfPage.getViewport({ scale: 1.0 })
      const scale = containerWidth / viewport.width
      const scaledViewport = pdfPage.getViewport({ scale })

      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height

      // Create a hidden buffer canvas if not exists
      if (!bufferCanvasRef.current) {
        bufferCanvasRef.current = document.createElement('canvas')
      }
      const buffer = bufferCanvasRef.current
      buffer.width = scaledViewport.width
      buffer.height = scaledViewport.height
      const bufferCtx = buffer.getContext('2d')

      if (bufferCtx) {
        const renderContext = {
          canvasContext: bufferCtx,
          viewport: scaledViewport,
          canvas: buffer,
        }
        await pdfPage.render(renderContext).promise
        // Draw initial frame
        drawAnnotations()
      }
    }

    renderPDF()
  }, [pdfPage])

  // Canvas drawing loop for annotations (single-canvas design)
  const drawAnnotations = () => {
    const canvas = canvasRef.current
    const buffer = bufferCanvasRef.current
    if (!canvas || !buffer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 1. Draw cached PDF image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(buffer, 0, 0)

    // 2. Draw Calibration Line if defined
    if (calibPoint1) {
      ctx.beginPath()
      ctx.arc(calibPoint1.x, calibPoint1.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#6366f1' // Indigo
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      if (calibPoint2) {
        ctx.beginPath()
        ctx.arc(calibPoint2.x, calibPoint2.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = '#6366f1'
        ctx.fill()
        ctx.stroke()

        // Draw line between points
        ctx.beginPath()
        ctx.moveTo(calibPoint1.x, calibPoint1.y)
        ctx.lineTo(calibPoint2.x, calibPoint2.y)
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 3
        ctx.setLineDash([5, 5])
        ctx.stroke()
        ctx.setLineDash([])

        // Draw label
        const mx = (calibPoint1.x + calibPoint2.x) / 2
        const my = (calibPoint1.y + calibPoint2.y) / 2
        ctx.fillStyle = '#4f46e5'
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText(`${knownDistanceInput} mm`, mx + 10, my - 10)
      }
    }

    // 3. Draw Center of Gravity (CoG as Datum 0,0,0)
    const activeCogPixel = viewMode === 'profile' ? cogProfilePixel
      : viewMode === 'plan' ? cogPlanPixel
      : cogFrontalPixel
    if (activeCogPixel && mode !== 'measure-cog') {
      ctx.beginPath()
      ctx.arc(activeCogPixel.x, activeCogPixel.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#ef4444' // Red
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Drawing target segments inside to resemble standard COG symbol
      ctx.beginPath()
      ctx.moveTo(activeCogPixel.x - 7, activeCogPixel.y)
      ctx.lineTo(activeCogPixel.x + 7, activeCogPixel.y)
      ctx.moveTo(activeCogPixel.x, activeCogPixel.y - 7)
      ctx.lineTo(activeCogPixel.x, activeCogPixel.y + 7)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#991b1b'
      ctx.font = 'bold 10px monospace'
      ctx.fillText('CoG (Origin 0,0,0)', activeCogPixel.x + 10, activeCogPixel.y - 5)
    }

    // 5. Draw Lifting Lugs
    const activeLugsPixel = viewMode === 'profile' ? lugsProfilePixel
      : viewMode === 'plan' ? lugsPlanPixel
      : lugsFrontalPixel
    activeLugsPixel.forEach((lug, idx) => {
      if (idx >= liftingPointsQty || !lug) return
      if (mode === 'measure-lug' && activeLugIndex === idx) return
      ctx.beginPath()
      ctx.arc(lug.x, lug.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#3b82f6' // Blue
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw text number inside
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(idx + 1), lug.x, lug.y)
      ctx.textAlign = 'left' // restore
      ctx.textBaseline = 'alphabetic'

      ctx.fillStyle = '#1e3a8a'
      ctx.font = 'bold 10px monospace'
      const p = points[idx]
      const hLabel = viewMode === 'frontal' ? p.y.toFixed(2) : p.x.toFixed(2)
      const vLabel = viewMode === 'plan' ? p.y.toFixed(2) : p.z.toFixed(2)
      ctx.fillText(`Lug ${idx + 1} (${hLabel}, ${vLabel})`, lug.x + 10, lug.y - 5)
    })
  }

  useEffect(() => {
    drawAnnotations()
  }, [
    calibPoint1,
    calibPoint2,
    cogProfilePixel,
    cogPlanPixel,
    cogFrontalPixel,
    lugsProfilePixel,
    lugsPlanPixel,
    lugsFrontalPixel,
    mode,
    viewMode,
    xCog,
    yCog,
    zCog,
    points,
    knownDistanceInput
  ])

  // Magnifier drawing function
  const drawMagnifier = (el: HTMLCanvasElement) => {
    const mainCanvas = canvasRef.current
    if (!el || !mainCanvas || !mousePos) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const size = 140
    el.width = size
    el.height = size

    // Clear magnifier canvas
    ctx.clearRect(0, 0, size, size)

    // Calculate mouse position relative to canvas coordinate system
    const rect = mainCanvas.getBoundingClientRect()
    const scaleX = mainCanvas.width / rect.width
    const scaleY = mainCanvas.height / rect.height

    const canvasX = mousePos.x * scaleX
    const canvasY = mousePos.y * scaleY

    // Copy from main canvas to magnifier canvas
    const sourceSize = size / magnifierZoom
    const sx = canvasX - sourceSize / 2
    const sy = canvasY - sourceSize / 2

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      mainCanvas,
      sx, sy, sourceSize, sourceSize,
      0, 0, size, size
    )

    // Draw red target crosshair in center
    ctx.beginPath()
    ctx.moveTo(size / 2 - 12, size / 2)
    ctx.lineTo(size / 2 + 12, size / 2)
    ctx.moveTo(size / 2, size / 2 - 12)
    ctx.lineTo(size / 2, size / 2 + 12)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
  }

  useEffect(() => {
    if (showMagnifier && mode !== 'idle' && mousePos && magnifierCanvasRef.current) {
      drawMagnifier(magnifierCanvasRef.current)
    }
  }, [
    mousePos,
    showMagnifier,
    mode,
    magnifierZoom,
    calibPoint1,
    calibPoint2,
    cogProfilePixel,
    cogPlanPixel,
    lugsProfilePixel,
    lugsPlanPixel,
    viewMode,
    xCog,
    yCog,
    zCog,
    points,
    knownDistanceInput
  ])

  // Escape key listener to cancel active selection modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode !== 'idle') {
          if (mode.startsWith('calibrate')) {
            setCalibPoint1(null)
            setCalibPoint2(null)
          }
          setMode('idle')
          setMousePos(null)
          toast.info('Selection mode cancelled.')
          e.stopPropagation()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mode])

  // Auto-expand Step 3 (Measure) when switching views if CoG is not defined yet
  useEffect(() => {
    const activeCog = viewMode === 'profile' ? cogProfilePixel
      : viewMode === 'plan' ? cogPlanPixel
      : cogFrontalPixel
    if (!activeCog && pdfDoc) {
      setExpandedSteps((prev) => ({
        ...prev,
        step3: true,
      }))
    }
  }, [viewMode, cogProfilePixel, cogPlanPixel, cogFrontalPixel, pdfDoc])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'idle') return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    // Raw screen coordinates (for magnifier container position)
    let clientX = e.clientX - rect.left
    let clientY = e.clientY - rect.top

    // Convert to canvas internal coordinate system (for ortho calculations)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    let internalX = clientX * scaleX
    let internalY = clientY * scaleY

    // Shift Key Orthogonal Constraint snaps to Datum or CalibPoint1 axes
    if (e.shiftKey) {
      if (mode === 'calibrate-2' && calibPoint1) {
        const dx = Math.abs(internalX - calibPoint1.x)
        const dy = Math.abs(internalY - calibPoint1.y)
        if (dx >= dy) {
          internalY = calibPoint1.y
          clientY = internalY / scaleY
        } else {
          internalX = calibPoint1.x
          clientX = internalX / scaleX
        }
      } else if (mode === 'measure-lug' && (viewMode === 'profile' ? cogProfilePixel : cogPlanPixel)) {
        const activeCog = viewMode === 'profile' ? cogProfilePixel! : cogPlanPixel!
        const dx = Math.abs(internalX - activeCog.x)
        const dy = Math.abs(internalY - activeCog.y)
        if (dx >= dy) {
          internalY = activeCog.y
          clientY = internalY / scaleY
        } else {
          internalX = activeCog.x
          clientX = internalX / scaleX
        }
      }
    }

    setMousePos({ x: clientX, y: clientY })
  }

  const handleMouseLeave = () => {
    setMousePos(null)
  }

  // Canvas Click Handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'idle') return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    // Scale client click position to canvas internal bitmap coordinate space
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    let x = (e.clientX - rect.left) * scaleX
    let y = (e.clientY - rect.top) * scaleY

    // Shift Key Orthogonal snaps
    if (e.shiftKey) {
      if (mode === 'calibrate-2' && calibPoint1) {
        const dx = Math.abs(x - calibPoint1.x)
        const dy = Math.abs(y - calibPoint1.y)
        if (dx >= dy) {
          y = calibPoint1.y
        } else {
          x = calibPoint1.x
        }
      } else if (mode === 'measure-lug' && (viewMode === 'profile' ? cogProfilePixel : cogPlanPixel)) {
        const activeCog = viewMode === 'profile' ? cogProfilePixel! : cogPlanPixel!
        const dx = Math.abs(x - activeCog.x)
        const dy = Math.abs(y - activeCog.y)
        if (dx >= dy) {
          y = activeCog.y
        } else {
          x = activeCog.x
        }
      }
    }

    if (mode === 'calibrate-1') {
      setCalibPoint1({ x, y })
      setCalibPoint2(null)
      setScaleRatio(null)
      setMode('calibrate-2')
      toast.info('Click the second point to define the known dimension.')
    } else if (mode === 'calibrate-2') {
      setCalibPoint2({ x, y })
      setMode('idle')
      // Open dialog/input prompts
      toast.success('Points selected. Please enter the physical distance to calculate scale.')
    } else if (mode === 'measure-cog') {
      if (!scaleRatio) {
        toast.error('Please calibrate the scale first.')
        return
      }
      if (viewMode === 'profile') {
        setCogProfilePixel({ x, y })
      } else if (viewMode === 'plan') {
        setCogPlanPixel({ x, y })
      } else {
        setCogFrontalPixel({ x, y })
      }

      if (viewMode === 'profile') {
        setXCog(0)
        setZCog(0)
      } else if (viewMode === 'plan') {
        setXCog(0)
        setYCog(0)
      } else {
        setYCog(0)
        setZCog(0)
      }
      setMode('idle')
      toast.success('CoG established as Reference Origin!')
    } else if (mode === 'measure-lug') {
      const activeCog = viewMode === 'profile' ? cogProfilePixel
        : viewMode === 'plan' ? cogPlanPixel
        : cogFrontalPixel
      if (!scaleRatio || !activeCog) {
        toast.error('Please calibrate the scale and set the CoG first for the active view.')
        return
      }
      if (viewMode === 'profile') {
        setLugsProfilePixel((prev) => {
          const next = [...prev]
          next[activeLugIndex] = { x, y }
          return next
        })
      } else if (viewMode === 'plan') {
        setLugsPlanPixel((prev) => {
          const next = [...prev]
          next[activeLugIndex] = { x, y }
          return next
        })
      } else {
        setLugsFrontalPixel((prev) => {
          const next = [...prev]
          next[activeLugIndex] = { x, y }
          return next
        })
      }

      // Calculate coordinates relative to CoG
      const dx = (x - activeCog.x) * scaleRatio
      const dy = (activeCog.y - y) * scaleRatio

      setPoints((prev) => {
        const next = [...prev]
        const current = next[activeLugIndex] || { x: 0, y: 0, z: 0 }
        if (viewMode === 'profile') {
          next[activeLugIndex] = {
            x: dx,
            y: current.y,
            z: sameHeight ? zCog : dy,
          }
        } else if (viewMode === 'plan') {
          next[activeLugIndex] = {
            x: dx,
            y: dy,
            z: current.z,
          }
        } else {
          // Frontal (Y&Z): horizontal → Y, vertical → Z, preserve X
          next[activeLugIndex] = {
            x: current.x,
            y: dx,
            z: sameHeight ? zCog : dy,
          }
        }
        return next
      })
      setMode('idle')
      toast.success(`Lifting Point ${activeLugIndex + 1} coordinates captured!`)
    }
  }

  // Calculate pixel distance
  const getPixelDistance = (p1: PixelPoint, p2: PixelPoint) => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y)
  }

  // Perform calibration scale ratio math
  const applyCalibration = () => {
    if (!calibPoint1 || !calibPoint2) {
      toast.error('Please select both calibration points first.')
      return
    }
    const distanceVal = parseFloat(knownDistanceInput)
    if (isNaN(distanceVal) || distanceVal <= 0) {
      toast.error('Please enter a valid positive distance.')
      return
    }

    const pixelDist = getPixelDistance(calibPoint1, calibPoint2)
    const ratio = (distanceVal / 1000) / pixelDist // Convert input mm to meters
    setScaleRatio(ratio)
    toast.success(`Scale Calibrated: 1 pixel = ${(ratio * 1000).toFixed(2)} mm`)
    // Auto-advance to Step 3
    setExpandedSteps((prev) => ({ ...prev, step2: false, step3: true }))
  }

  // Apply visual-calibrated coordinates back to the form state
  const handleApply = () => {
    // 1. Find the lowest lifting point height (z) among the active lifting points
    const activePoints = points.slice(0, liftingPointsQty)
    const zValues = activePoints.map((p) => p.z)
    const zLowest = zValues.length > 0 ? Math.min(...zValues) : 0

    // 2. Adjust Z coordinates such that the lowest lifting point is at 0
    const adjustedPoints = points.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z - zLowest,
    }))
    const adjustedZCog = zCog - zLowest

    // 3. Round all coordinates to a maximum of 3 decimal places
    const roundTo3Dec = (val: number) => Math.round(val * 1000) / 1000

    onApplyCoordinates({
      x_cog: roundTo3Dec(xCog),
      y_cog: roundTo3Dec(yCog),
      z_cog: roundTo3Dec(adjustedZCog),
      points: adjustedPoints.map((p) => ({
        x: roundTo3Dec(p.x),
        y: roundTo3Dec(p.y),
        z: roundTo3Dec(p.z),
      })),
    })
    toast.success('Coordinates applied to form.')
    onClose()
  }

  if (!isOpen) return null

  // Magnifier layout position calculations
  const size = 140
  const halfSize = size / 2
  const canvasWidth = canvasRef.current ? canvasRef.current.clientWidth : 800
  const clampedX = mousePos ? Math.max(halfSize, Math.min(canvasWidth - halfSize, mousePos.x)) : 0
  const showAbove = mousePos ? mousePos.y > 160 : true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
      <div className="flex flex-col bg-card border border-border rounded-xl w-full max-w-7xl h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-md font-semibold text-foreground">2D PDF Drawing Calibrator</h2>
              <p className="text-xs text-muted-foreground">Extract absolute coordinates directly from digital drawings</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Workspace Layout */}
        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
          
          {/* Left Sidebar Control Panel */}
          <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-card p-5 flex flex-col gap-4 overflow-y-auto">
            
            {/* Step 1: Upload Drawing */}
            <div className="border-b border-border pb-3">
              <button
                type="button"
                onClick={() => toggleStep('step1')}
                className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <span>Step 1: Upload drawing</span>
                {expandedSteps.step1 ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {expandedSteps.step1 && (
                <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-lg border border-dashed border-input bg-muted/40 text-sm text-foreground flex items-center justify-center gap-2 hover:bg-muted/80 hover:border-primary transition-all duration-200"
                  >
                    <Upload className="h-4 w-4" />
                    {pdfDoc ? 'Change PDF Drawing' : 'Upload PDF Drawing'}
                  </button>
                </div>
              )}
            </div>

            {pdfDoc && (
              <>
                {/* Viewer Options */}
                <div className="border-b border-border pb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Viewer Options</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMagnifier}
                        onChange={(e) => {
                          setShowMagnifier(e.target.checked)
                          if (!e.target.checked) setMousePos(null)
                        }}
                        className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>Enable Zoom Magnifier</span>
                    </label>
                    {showMagnifier && (
                      <div className="flex items-center justify-between gap-2 text-xs pl-5">
                        <span className="text-muted-foreground">Zoom Level:</span>
                        <div className="flex gap-1">
                          {[2, 3, 4, 5].map((factor) => (
                            <button
                              key={factor}
                              type="button"
                              onClick={() => setMagnifierZoom(factor)}
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-mono border transition-colors',
                                magnifierZoom === factor
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-muted border-input'
                              )}
                            >
                              {factor}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Scale Calibration */}
                <div className="border-b border-border pb-3">
                  <button
                    type="button"
                    onClick={() => toggleStep('step2')}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <span>Step 2: Calibrate scale</span>
                    {expandedSteps.step2 ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  {expandedSteps.step2 && (
                    <div className="mt-2 space-y-3 animate-in fade-in duration-200">
                      <button
                        onClick={() => {
                          setMode('calibrate-1')
                          setCalibPoint1(null)
                          setCalibPoint2(null)
                          setScaleRatio(null)
                          toast.info('Click the first point of a known dimension (e.g. scale bar).')
                        }}
                        className={cn(
                          'w-full py-2 px-3 rounded-md text-xs font-medium border flex items-center justify-center gap-2 transition-all',
                          mode.startsWith('calibrate')
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                            : 'border-input hover:bg-muted'
                        )}
                      >
                        <Scale className="h-3.5 w-3.5" />
                        {calibPoint1 ? 'Recalibrate Scale' : 'Select Known Line'}
                      </button>

                      {calibPoint1 && calibPoint2 && (
                        <div className="bg-muted/40 p-2.5 rounded-lg border border-border space-y-2">
                          <label className="block text-[11px] font-medium text-muted-foreground">Known physical distance (mm):</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={knownDistanceInput}
                              onChange={(e) => setKnownDistanceInput(e.target.value)}
                              step="100"
                              className="w-full bg-background border border-input rounded-md px-2 py-1 text-xs font-mono"
                            />
                            <button
                              onClick={applyCalibration}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-2.5 text-xs font-medium transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}

                      {scaleRatio && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Scale: 1px = {(scaleRatio * 1000).toFixed(1)} mm
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 3: Drawing View Mode & Measurements */}
                <div className={cn("pb-3 flex flex-col min-h-0", expandedSteps.step3 ? "flex-1" : "")}>
                  <button
                    type="button"
                    onClick={() => toggleStep('step3')}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1 mb-2"
                  >
                    <span>Step 3: Select View &amp; Measure</span>
                    {expandedSteps.step3 ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  
                  {expandedSteps.step3 && (
                    <div className="flex-1 flex flex-col min-h-0 space-y-3 animate-in fade-in duration-200">
                      {/* View Toggles */}
                      <div className="grid grid-cols-3 gap-2 bg-muted/60 p-1 rounded-lg border border-border">
                        <button
                          onClick={() => setViewMode('profile')}
                          className={cn(
                            'py-1 rounded-md text-xs font-medium text-center transition-all',
                            viewMode === 'profile' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Profile (X &amp; Z)
                        </button>
                        <button
                          onClick={() => setViewMode('plan')}
                          className={cn(
                            'py-1 rounded-md text-xs font-medium text-center transition-all',
                            viewMode === 'plan' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Plan (X &amp; Y)
                        </button>
                        <button
                          onClick={() => setViewMode('frontal')}
                          className={cn(
                            'py-1 rounded-md text-xs font-medium text-center transition-all',
                            viewMode === 'frontal' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Frontal (Y &amp; Z)
                        </button>
                      </div>

                      {/* Measurement Options List */}
                      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                        {/* Measure CoG */}
                        <button
                          onClick={() => {
                            setMode('measure-cog')
                            toast.info('Click the Center of Gravity (CoG) on the drawing.')
                          }}
                          className={cn(
                            'w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                            mode === 'measure-cog'
                              ? 'border-red-500 bg-red-50/50 dark:bg-red-950/10'
                              : 'border-border bg-card/50 hover:bg-muted'
                          )}
                        >
                          <div>
                            <span className="text-xs font-semibold text-foreground block">Centre of Gravity (CoG)</span>
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              {viewMode === 'profile'
                                ? `X: ${xCog.toFixed(2)}m · Z: ${zCog.toFixed(2)}m`
                                : viewMode === 'plan'
                                ? `X: ${xCog.toFixed(2)}m · Y: ${yCog.toFixed(2)}m`
                                : `Y: ${yCog.toFixed(2)}m · Z: ${zCog.toFixed(2)}m`}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>

                        {/* Measure Lugs */}
                        {Array.from({ length: liftingPointsQty }).map((_, idx) => (
                          <button
                            key={idx}
                            disabled={!(viewMode === 'profile' ? cogProfilePixel : viewMode === 'plan' ? cogPlanPixel : cogFrontalPixel)}
                            onClick={() => {
                              setMode('measure-lug')
                              setActiveLugIndex(idx)
                              toast.info(`Click the Lifting Point ${idx + 1} on the drawing.`)
                            }}
                            className={cn(
                              'w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                              mode === 'measure-lug' && activeLugIndex === idx
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/10'
                                : 'border-border bg-card/50 hover:bg-muted'
                            )}
                          >
                            <div>
                              <span className="text-xs font-semibold text-foreground block">Lifting Point {idx + 1}</span>
                              <span className="text-[10px] font-mono text-muted-foreground block">
                                {viewMode === 'profile'
                                  ? `X: ${points[idx]?.x.toFixed(2) ?? '0.00'}m · Z: ${points[idx]?.z.toFixed(2) ?? '0.00'}m`
                                  : viewMode === 'plan'
                                  ? `X: ${points[idx]?.x.toFixed(2) ?? '0.00'}m · Y: ${points[idx]?.y.toFixed(2) ?? '0.00'}m`
                                  : `Y: ${points[idx]?.y.toFixed(2) ?? '0.00'}m · Z: ${points[idx]?.z.toFixed(2) ?? '0.00'}m`}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>

          {/* Right Main Viewer (Canvas Scroll container) */}
          <main ref={containerRef} className="flex-1 bg-slate-900 overflow-auto relative flex items-start justify-center p-4">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-sm font-medium">Processing digital drawing...</span>
              </div>
            ) : pdfDoc ? (
              <div className="relative border-4 border-slate-950 rounded shadow-2xl bg-white select-none">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  className={cn(
                    'max-w-full cursor-default transition-all duration-100',
                    mode !== 'idle' && 'cursor-crosshair'
                  )}
                />

                {/* Magnifier glass overlay */}
                {showMagnifier && mode !== 'idle' && mousePos && (
                  <div
                    className="absolute pointer-events-none border-2 border-indigo-500 rounded-full shadow-2xl overflow-hidden bg-white select-none"
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      left: `${clampedX}px`,
                      top: `${mousePos.y}px`,
                      transform: showAbove ? `translate(-50%, -${size + 15}px)` : `translate(-50%, 25px)`,
                      zIndex: 40,
                    }}
                  >
                    <canvas
                      ref={magnifierCanvasRef}
                      className="w-full h-full"
                    />
                    {/* Outer border rings and labels inside the loupe */}
                    <div className="absolute inset-0 rounded-full border border-indigo-400/50 pointer-events-none" />
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-slate-950/85 text-[9px] text-white px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider shadow">
                      {mode.startsWith('calibrate') ? 'scale' : mode.replace('measure-', '')}
                    </div>
                  </div>
                )}
                
                {/* Page Navigation Overlay */}
                {totalPages > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 text-white border border-slate-700 px-3 py-1.5 rounded-full shadow-lg text-xs font-medium backdrop-blur">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => {
                        const prev = currentPage - 1
                        setCurrentPage(prev)
                        loadPage(pdfDoc, prev)
                      }}
                      className="hover:text-primary transition-colors disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="font-mono">{currentPage} / {totalPages}</span>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        const next = currentPage + 1
                        setCurrentPage(next)
                        loadPage(pdfDoc, next)
                      }}
                      className="hover:text-primary transition-colors disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-slate-400 gap-4 text-center">
                <div className="rounded-full bg-slate-800/80 p-5 border border-slate-700 shadow-lg">
                  <Compass className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h4 className="text-sm font-semibold text-slate-200">No drawing uploaded</h4>
                  <p className="text-xs text-slate-400">
                    Upload a digital 2D PDF drawing of your structure (skid, manifold, PLR, etc.) to begin visual calibration and coordinate capture.
                  </p>
                </div>
              </div>
            )}

            {/* Instruction tooltip overlay */}
            {mode !== 'idle' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-bounce border border-indigo-400">
                <AlertCircle className="h-4 w-4" />
                {mode === 'calibrate-1' && 'Click the first calibration point on drawing scale bar'}
                {mode === 'calibrate-2' && 'Click the second calibration point on drawing scale bar'}
                {mode === 'measure-cog' && 'Click the Centre of Gravity (CoG)'}
                {mode === 'measure-lug' && `Click Lifting Point ${activeLugIndex + 1}`}
              </div>
            )}
          </main>
        </div>

        {/* Footer actions */}
        <footer className="flex items-center justify-between border-t border-border bg-muted/10 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            {!pdfDoc && 'Upload a PDF to calibrate.'}
            {pdfDoc && !scaleRatio && 'Please calibrate the drawing scale.'}
            {scaleRatio && !(viewMode === 'profile' ? cogProfilePixel : cogPlanPixel) && `Please set the Centre of Gravity (CoG) for ${viewMode} view.`}
            {scaleRatio && (viewMode === 'profile' ? cogProfilePixel : cogPlanPixel) && 'Click fields on the sidebar and click the drawing to measure.'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-input rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!(cogProfilePixel || cogPlanPixel) || !scaleRatio}
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Coordinates
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
