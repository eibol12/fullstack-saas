import { useEffect, useLayoutEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    katex?: {
      renderToString: (
        expression: string,
        options?: {
          throwOnError?: boolean
          displayMode?: boolean
        },
      ) => string
    }
  }
}

const KATEX_SCRIPT_ID = 'report-katex-script'
const KATEX_STYLESHEET_ID = 'report-katex-stylesheet'
const KATEX_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js'
const KATEX_STYLESHEET_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'

let katexLoadPromise: Promise<void> | null = null

function ensureKatexStylesheet() {
  if (typeof document === 'undefined') {
    return
  }

  if (document.getElementById(KATEX_STYLESHEET_ID)) {
    return
  }

  const link = document.createElement('link')
  link.id = KATEX_STYLESHEET_ID
  link.rel = 'stylesheet'
  link.href = KATEX_STYLESHEET_URL
  document.head.appendChild(link)
}

function ensureKatexLoaded(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve()
  }

  if (window.katex) {
    return Promise.resolve()
  }

  if (katexLoadPromise) {
    return katexLoadPromise
  }

  ensureKatexStylesheet()

  katexLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(KATEX_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load KaTeX.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = KATEX_SCRIPT_ID
    script.src = KATEX_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load KaTeX.'))
    document.head.appendChild(script)
  })

  return katexLoadPromise
}

interface MathRendererProps {
  expression?: string | null
  fallback?: string | null
  displayMode?: boolean
  className?: string
}

export function MathRenderer({
  expression,
  fallback,
  displayMode = false,
  className,
}: MathRendererProps) {
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let isCancelled = false

    if (!expression) {
      setRenderedHtml(null)
      setHasError(false)
      return () => {
        isCancelled = true
      }
    }

    setRenderedHtml(null)
    setHasError(false)

    ensureKatexLoaded()
      .then(() => {
        if (isCancelled || !window.katex) {
          return
        }

        try {
          const html = window.katex.renderToString(expression, {
            throwOnError: true,
            displayMode,
          })
          if (!isCancelled) {
            setRenderedHtml(html)
          }
        } catch (_error) {
          if (!isCancelled) {
            setHasError(true)
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHasError(true)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [displayMode, expression])

  // Auto-shrink any rendered math whose natural width exceeds the
  // available column width. KaTeX produces non-wrapping output (absolute
  // positioning + nowrap), so without this guard a long expression — like
  // the wire-rope Nominal Safety Factor formula — would spill into the
  // citations column. We measure the natural width of the inner KaTeX
  // node and apply a CSS transform so the formula always fits the column,
  // re-measuring via ResizeObserver whenever the layout changes (window
  // resize, sidebar toggling, print preview, etc.).
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !renderedHtml) return

    const fit = () => {
      const inner = container.firstElementChild as HTMLElement | null
      if (!inner) return
      // Reset previous transform so measurement reflects the natural size.
      inner.style.transform = ''
      inner.style.transformOrigin = ''
      container.style.height = ''

      const naturalWidth = inner.scrollWidth
      const availableWidth = container.clientWidth
      if (availableWidth <= 0 || naturalWidth <= availableWidth) return

      const scale = availableWidth / naturalWidth
      inner.style.transformOrigin = displayMode ? 'top center' : 'left center'
      inner.style.transform = `scale(${scale})`
      // The transform doesn't affect layout, so reserve the scaled height
      // to keep neighbouring rows from overlapping the shrunken formula.
      const naturalHeight = inner.scrollHeight
      if (displayMode && naturalHeight > 0) {
        container.style.height = `${Math.ceil(naturalHeight * scale)}px`
      }
    }

    fit()
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(container)
    window.addEventListener('resize', fit)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [renderedHtml, displayMode])

  const Tag = displayMode ? 'div' : 'span'
  const fallbackText = fallback || expression || ''

  if (!expression || hasError || !renderedHtml) {
    return (
      <Tag
        ref={containerRef as never}
        className={className}
      >
        {fallbackText}
      </Tag>
    )
  }

  return (
    <Tag
      ref={containerRef as never}
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )
}
