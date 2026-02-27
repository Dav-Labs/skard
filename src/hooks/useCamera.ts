import { useRef, useState, useCallback, useEffect } from 'react'

// Must match CameraView.tsx constants
const BOX_WIDTH_FRAC  = 0.72          // 72% of container width
const CARD_ASPECT     = 63 / 88       // MTG card width/height ratio
const NAME_BAR_FRAC   = 0.12          // name bar = top 12% of card height
const MAX_OUT_WIDTH   = 1200          // cap output to avoid huge images

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const capture = useCallback((): HTMLCanvasElement | null => {
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

    // --- Extract only the name bar (top 12% of card) ---
    const srcX = Math.round(cardX)
    const srcY = Math.round(cardY)
    const srcW = Math.round(cardW)
    const srcH = Math.round(cardH * NAME_BAR_FRAC)

    // --- Scale output down to cap width ---
    const outScale = Math.min(1, MAX_OUT_WIDTH / srcW)
    const outW     = Math.round(srcW * outScale)
    const outH     = Math.round(srcH * outScale)

    const canvas = document.createElement('canvas')
    canvas.width  = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
    return canvas
  }, [isActive])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, isActive, error, start, stop, capture }
}
