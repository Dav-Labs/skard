import { useEffect } from 'react'
import { useCamera } from '../hooks/useCamera'
import type { CaptureResult } from '../hooks/useCamera'

interface Props {
  onCapture: (result: CaptureResult) => void
  isProcessing: boolean
}

// MTG card aspect ratio: 63mm × 88mm
const CARD_ASPECT = 63 / 88 // width / height ≈ 0.716

export function CameraView({ onCapture, isProcessing }: Props) {
  const { videoRef, isActive, error, start, capture, torch, toggleTorch, zoom, zoomRange, setZoomLevel } = useCamera()

  useEffect(() => {
    start()
  }, [start])

  const handleCapture = () => {
    const result = capture()
    if (result) onCapture(result)
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

  // Card outline: 72% of container width, centered, MTG aspect ratio
  const boxWidthPct = 72

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

        {/* Card outline overlay */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dim everything outside the card box */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Card outline box */}
            <div
              className="relative bg-transparent z-10"
              style={{
                width: `${boxWidthPct}%`,
                aspectRatio: `${CARD_ASPECT}`,
              }}
            >
              {/* Clear the dim inside the box */}
              <div className="absolute inset-0 bg-transparent mix-blend-normal" />

              {/* Corner brackets */}
              {(['tl','tr','bl','br'] as const).map((corner) => (
                <div
                  key={corner}
                  className="absolute w-6 h-6 border-violet-400"
                  style={{
                    top:    corner.startsWith('t') ? 0 : 'auto',
                    bottom: corner.startsWith('b') ? 0 : 'auto',
                    left:   corner.endsWith('l')   ? 0 : 'auto',
                    right:  corner.endsWith('r')   ? 0 : 'auto',
                    borderTopWidth:    corner.startsWith('t') ? 2 : 0,
                    borderBottomWidth: corner.startsWith('b') ? 2 : 0,
                    borderLeftWidth:   corner.endsWith('l')   ? 2 : 0,
                    borderRightWidth:  corner.endsWith('r')   ? 2 : 0,
                  }}
                />
              ))}

              {/* Name bar highlight — top 18% of card */}
              <div
                className="absolute left-0 right-0 top-0 border border-violet-400/50 border-dashed"
                style={{ height: '18%' }}
              >
                <span className="absolute bottom-1 left-2 text-xs text-violet-300/70">
                  name
                </span>
              </div>

              {/* Info line highlight — bottom 6% of card */}
              <div
                className="absolute left-0 bottom-0 border border-violet-400/50 border-dashed"
                style={{ height: '6%', width: '60%' }}
              >
                <span className="absolute top-0 left-2 text-xs text-violet-300/70" style={{ fontSize: '0.55rem' }}>
                  info
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zoom slider */}
      {zoomRange && zoomRange.max > zoomRange.min && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center items-center gap-3 px-10 z-10">
          <span className="text-xs text-white/70">1x</span>
          <input
            type="range"
            min={zoomRange.min}
            max={Math.min(zoomRange.max, 10)}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="flex-1 zoom-slider"
          />
          <span className="text-xs text-white/70">{zoom.toFixed(1)}x</span>
        </div>
      )}

      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-10">
        <button
          onClick={toggleTorch}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            torch ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
          </svg>
        </button>
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
        <div className="w-14" /> {/* Spacer to keep capture button centered */}
      </div>
    </div>
  )
}
