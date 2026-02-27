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
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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

    // Crop top ~20% of frame (card name region)
    const cropHeight = Math.round(vh * 0.20)
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = cropHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, vw, cropHeight, 0, 0, vw, cropHeight)
    return canvas
  }, [isActive])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, isActive, error, start, stop, capture }
}
