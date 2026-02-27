import { useRef, useState, useCallback, useEffect } from 'react'

// Must match CameraView.tsx constants
const BOX_WIDTH_FRAC  = 0.48          // 48% of container width
const CARD_ASPECT     = 63 / 88       // MTG card width/height ratio
const NAME_BAR_FRAC   = 0.18          // name bar = top 18% of card height
const INFO_LINE_FRAC  = 0.06          // info line = bottom 6% of card height
const MAX_OUT_WIDTH   = 1200          // cap output to avoid huge images

export interface CaptureResult {
  nameBar: HTMLCanvasElement
  infoLine: HTMLCanvasElement
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [torch, setTorch] = useState(() => localStorage.getItem('skard:torch') === 'on')
  const [zoom, setZoom] = useState(1)
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
    if (!video || !isActive) return null

    const vw = video.videoWidth
    const vh = video.videoHeight
    // clientWidth/clientHeight = actual CSS display size of the video element
    const cw = video.clientWidth
    const ch = video.clientHeight

    // --- Object-cover coordinate transform ---
    // Determine how the video is scaled+offset to fill the container.
    const videoAspect     = vw / vh
    const containerAspect = cw / ch
    let scale: number, offX: number, offY: number

    if (videoAspect > containerAspect) {
      // Video is wider — scale to fill height, crop left/right
      scale = vh / ch
      offX  = (vw - cw * scale) / 2
      offY  = 0
    } else {
      // Video is taller — scale to fill width, crop top/bottom
      scale = vw / cw
      offX  = 0
      offY  = (vh - ch * scale) / 2
    }

    // --- Card outline box in CSS pixels (mirrors CameraView.tsx) ---
    const boxW_css = cw * BOX_WIDTH_FRAC
    const boxH_css = boxW_css / CARD_ASPECT
    const boxL_css = (cw - boxW_css) / 2
    const boxT_css = (ch - boxH_css) / 2

    // --- Map card outline → video pixel coordinates ---
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

    // --- Name bar (top 18% of card, but crop tightly to just the text) ---
    const barX = cardX
    const barY = cardY
    const barW = cardW
    const barH = cardH * NAME_BAR_FRAC

    const nameBar = extractRegion(video,
      Math.round(barX + barW * 0.08),   // skip left frame edge + decoration
      Math.round(barY + barH * 0.25),   // skip top frame border (deeper inset for 18% bar)
      Math.round(barW * 0.62),           // stop well before mana cost on right
      Math.round(barH * 0.35),           // tight crop: just the name text, skip frame borders
    )

    // --- Info line (bottom 6% of card) ---
    const infoY = cardY + cardH * (1 - INFO_LINE_FRAC)
    const infoLine = extractRegion(video,
      Math.round(cardX + cardW * 0.04), // left inset 4% (skip frame edge)
      Math.round(infoY + cardH * INFO_LINE_FRAC * 0.10), // skip top border
      Math.round(cardW * 0.60),          // left 60% (info is left-aligned, skip copyright)
      Math.round(cardH * INFO_LINE_FRAC * 0.80), // 80% height (skip bottom frame border)
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

  return { videoRef, isActive, error, start, stop, capture, torch, toggleTorch, zoom, zoomRange, setZoomLevel }
}
