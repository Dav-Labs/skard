import { createWorker, type Worker } from 'tesseract.js'

let workerReady: Promise<Worker> | null = null

export function preloadWorker() {
  if (!workerReady) {
    workerReady = createWorker('eng')
  }
  return workerReady
}

export function preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const src = canvas
  const srcCtx = src.getContext('2d')!
  const srcData = srcCtx.getImageData(0, 0, src.width, src.height)
  const srcPixels = srcData.data

  // Step 1: Convert to grayscale in-place
  const grayValues = new Uint8Array(src.width * src.height)
  for (let i = 0; i < srcPixels.length; i += 4) {
    grayValues[i / 4] = Math.round(
      0.299 * srcPixels[i] + 0.587 * srcPixels[i + 1] + 0.114 * srcPixels[i + 2]
    )
  }

  // Step 2: Adaptive threshold (local mean over a window)
  // This handles uneven lighting much better than global contrast
  const w = src.width
  const h = src.height
  const windowSize = Math.max(15, Math.round(w / 40)) // adaptive window
  const half = Math.floor(windowSize / 2)
  const thresholded = new Uint8Array(w * h)

  // Build integral image for fast local mean
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += grayValues[y * w + x]
      integral[(y + 1) * (w + 1) + (x + 1)] =
        rowSum + integral[y * (w + 1) + (x + 1)]
    }
  }

  const C = 8 // threshold bias — pixels must be this much darker than local mean to be "black"
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half)
      const y1 = Math.max(0, y - half)
      const x2 = Math.min(w - 1, x + half)
      const y2 = Math.min(h - 1, y + half)
      const area = (x2 - x1 + 1) * (y2 - y1 + 1)
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1]
      const mean = sum / area
      thresholded[y * w + x] = grayValues[y * w + x] < mean - C ? 0 : 255
    }
  }

  // Step 3: Upscale 2x for better OCR on small text
  const scale = 2
  const out = document.createElement('canvas')
  out.width = w * scale
  out.height = h * scale
  const outCtx = out.getContext('2d')!
  const outData = outCtx.createImageData(out.width, out.height)
  const outPixels = outData.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = thresholded[y * w + x]
      // Write a scale x scale block
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const oy = y * scale + dy
          const ox = x * scale + dx
          const oi = (oy * out.width + ox) * 4
          outPixels[oi] = val
          outPixels[oi + 1] = val
          outPixels[oi + 2] = val
          outPixels[oi + 3] = 255
        }
      }
    }
  }

  outCtx.putImageData(outData, 0, 0)
  return out
}

export async function recognizeCardName(imageData: string | HTMLCanvasElement): Promise<string> {
  const w = await preloadWorker()
  const { data } = await w.recognize(imageData)
  const text = data.text.trim()
  // Take the first line and clean it up
  const firstLine = text.split('\n')[0]?.trim() || ''
  // Strip non-alpha noise but keep spaces, hyphens, apostrophes, commas
  return firstLine.replace(/[^a-zA-Z\s\-',]/g, '').trim()
}
