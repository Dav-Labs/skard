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

    // Crop top ~12% of frame — tighter crop on just the card name bar
    // With the stand at a fixed distance, the card name occupies a smaller
    // portion of the frame than when holding the phone close
    const cropY = Math.round(vh * 0.03) // skip very top edge
    const cropHeight = Math.round(vh * 0.10)
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = cropHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, cropY, vw, cropHeight, 0, 0, vw, cropHeight)
    return canvas
  }, [isActive])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, isActive, error, start, stop, capture }
}
