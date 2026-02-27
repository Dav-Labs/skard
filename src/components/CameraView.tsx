import { useEffect } from 'react'
import { useCamera } from '../hooks/useCamera'

interface Props {
  onCapture: (canvas: HTMLCanvasElement) => void
  isProcessing: boolean
}

export function CameraView({ onCapture, isProcessing }: Props) {
  const { videoRef, isActive, error, start, capture } = useCamera()

  useEffect(() => {
    start()
  }, [start])

  const handleCapture = () => {
    const canvas = capture()
    if (canvas) onCapture(canvas)
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={start}
            className="px-6 py-3 bg-violet-600 text-white rounded-xl font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {/* Guide overlay for card name region */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute left-4 right-4 border-2 border-dashed border-violet-400/60 rounded-lg"
              style={{ top: '2%', height: '10%' }}
            >
              <span className="absolute bottom-1 left-2 text-xs text-violet-300/80">
                Align card name here
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
        <button
          onClick={handleCapture}
          disabled={!isActive || isProcessing}
          className="w-20 h-20 rounded-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 disabled:opacity-50 flex items-center justify-center transition-colors shadow-lg shadow-violet-900/50"
        >
          {isProcessing ? (
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-full border-4 border-white" />
          )}
        </button>
      </div>
    </div>
  )
}
