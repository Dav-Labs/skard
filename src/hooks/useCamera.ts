import { useRef, useState, useCallback, useEffect } from 'react'

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

    // Crop top ~15% of frame — enough tolerance for handheld alignment
    // without capturing so much that noise from artwork dominates
    const cropY = Math.round(vh * 0.02)
    const cropH = Math.round(vh * 0.15)

    // Cap width at 1200px so preprocessImage never gets a massive 4K image.
    // Tesseract + 3x upscale on a 3840px-wide crop would be ~11k px and hang.
    const maxW = 1200
    const scale = Math.min(1, maxW / vw)
    const outW = Math.round(vw * scale)
    const outH = Math.round(cropH * scale)

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, cropY, vw, cropH, 0, 0, outW, outH)
    return canvas
  }, [isActive])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, isActive, error, start, stop, capture }
}
