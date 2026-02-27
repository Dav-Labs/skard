import { useRef, useState, useCallback, useEffect } from 'react'

const NAME_BAR_FRAC   = 0.18          // name bar = top 18% of card height
const INFO_LINE_FRAC  = 0.06          // info line = bottom 6% of card height
const MAX_OUT_WIDTH   = 1200          // cap output to avoid huge images

// Name crop insets within the name bar (what actually gets OCR'd)
export const NAME_CROP = { left: 0.02, top: 0.10, width: 0.90, height: 0.65 }

export interface CaptureResult {
  nameBar: HTMLCanvasElement
  infoLine: HTMLCanvasElement
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [torch, setTorch] = useState(() => localStorage.getItem('skard:torch') === 'on')
  const [zoom, setZoom] = useState(() => parseFloat(localStorage.getItem('skard:zoom') || '1'))
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const track = stream.getVideoTracks()[0]
      // Detect zoom range from camera capabilities
      const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number } }
      if (caps.zoom) {
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max })
        const savedZoom = parseFloat(localStorage.getItem('skard:zoom') || '1')
        const clamped = Math.min(caps.zoom.max, Math.max(caps.zoom.min, savedZoom))
        if (clamped > caps.zoom.min) {
          try {
            await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] })
            setZoom(clamped)
          } catch { /* ignore */ }
        }
      }
      // Apply saved torch preference — best-effort, not all devices support it
      const savedTorch = localStorage.getItem('skard:torch') === 'on'
      if (savedTorch) {
        try {
          await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] })
        } catch {
          // Torch not supported on this device — ignore
        }
      }
      setIsActive(true)
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : 'Could not access camera.'
      )
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsActive(false)
  }, [])

  const capture = useCallback((): CaptureResult | null => {
    const video = videoRef.current
    const box = boxRef.current
    if (!video || !box || !isActive) return null

    const vw = video.videoWidth
    const vh = video.videoHeight

    // --- Use actual DOM positions for perfect alignment ---
    const videoRect = video.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()

    // Box position relative to video element
    const boxL_css = boxRect.left - videoRect.left
    const boxT_css = boxRect.top - videoRect.top
    const boxW_css = boxRect.width
    const boxH_css = boxRect.height

    // Container = video element CSS size
    const cw = videoRect.width
    const ch = videoRect.height

    // --- Object-cover coordinate transform ---
    const videoAspect     = vw / vh
    const containerAspect = cw / ch
    let scale: number, offX: number, offY: number

    if (videoAspect > containerAspect) {
      scale = vh / ch
      offX  = (vw - cw * scale) / 2
      offY  = 0
    } else {
      scale = vw / cw
      offX  = 0
      offY  = (vh - ch * scale) / 2
    }

    // --- Map box → video pixel coordinates ---
    const cardX = offX + boxL_css * scale
    const cardY = offY + boxT_css * scale
    const cardW = boxW_css * scale
    const cardH = boxH_css * scale

    // --- Helper to extract a region to a canvas ---
    function extractRegion(src: HTMLVideoElement, sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement {
      const outScale = Math.min(1, MAX_OUT_WIDTH / sw)
      const outW = Math.round(sw * outScale)
      const outH = Math.round(sh * outScale)
      const c = document.createElement('canvas')
      c.width = outW
      c.height = outH
      const ctx = c.getContext('2d')!
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, outW, outH)
      return c
    }

    // --- Name bar (top 18% of card) ---
    const barW = cardW
    const barH = cardH * NAME_BAR_FRAC

    const nameBar = extractRegion(video,
      Math.round(cardX + barW * NAME_CROP.left),
      Math.round(cardY + barH * NAME_CROP.top),
      Math.round(barW * NAME_CROP.width),
      Math.round(barH * NAME_CROP.height),
    )

    // --- Info line (bottom 6% of card) ---
    const infoY = cardY + cardH * (1 - INFO_LINE_FRAC)
    const infoLine = extractRegion(video,
      Math.round(cardX + cardW * 0.04),
      Math.round(infoY + cardH * INFO_LINE_FRAC * 0.10),
      Math.round(cardW * 0.60),
      Math.round(cardH * INFO_LINE_FRAC * 0.80),
    )

    return { nameBar, infoLine }
  }, [isActive])

  const setZoomLevel = useCallback(async (level: number) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !zoomRange) return
    const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, level))
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] })
      setZoom(clamped)
      localStorage.setItem('skard:zoom', String(clamped))
    } catch {
      // Zoom not supported
    }
  }, [zoomRange])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
      localStorage.setItem('skard:torch', next ? 'on' : 'off')
    } catch {
      // Torch not supported
    }
  }, [torch])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, boxRef, isActive, error, start, stop, capture, torch, toggleTorch, zoom, zoomRange, setZoomLevel }
}
