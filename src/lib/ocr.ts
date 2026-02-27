import { createWorker, type Worker } from 'tesseract.js'

let workerReady: Promise<Worker> | null = null

export function preloadWorker() {
  if (!workerReady) {
    workerReady = createWorker('eng').then(async (w) => {
      // '7' = SINGLE_LINE mode: treat the crop as one line of text.
      // Use the literal string to avoid PSM enum import issues in some builds.
      await w.setParameters({ tessedit_pageseg_mode: '7' as never })
      return w
    }).catch((err) => {
      workerReady = null // allow retry on next scan
      throw err
    })
  }
  return workerReady
}

export function preprocessImage(canvas: HTMLCanvasElement, invertPolarity = false): HTMLCanvasElement {
  const src = canvas
  const srcCtx = src.getContext('2d')!
  const srcData = srcCtx.getImageData(0, 0, src.width, src.height)
  const srcPixels = srcData.data

  const w = src.width
  const h = src.height

  // Step 1: Grayscale
  const gray = new Uint8Array(w * h)
  for (let i = 0; i < srcPixels.length; i += 4) {
    gray[i / 4] = Math.round(
      0.299 * srcPixels[i] + 0.587 * srcPixels[i + 1] + 0.114 * srcPixels[i + 2]
    )
  }

  // Step 2: Sharpen — helps with handheld blur at ~6 inches
  // Simple 3×3 Laplacian sharpen kernel: center=5, NSEW=-1
  const sharpened = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const top = y > 0     ? gray[(y - 1) * w + x] : gray[i]
      const bot = y < h - 1 ? gray[(y + 1) * w + x] : gray[i]
      const lft = x > 0     ? gray[y * w + x - 1]   : gray[i]
      const rgt = x < w - 1 ? gray[y * w + x + 1]   : gray[i]
      sharpened[i] = Math.max(0, Math.min(255, gray[i] * 5 - top - bot - lft - rgt))
    }
  }

  // Optionally invert polarity before thresholding (handles light-text-on-dark cards)
  const source = invertPolarity
    ? sharpened.map((v) => 255 - v)
    : sharpened

  // Step 3: Adaptive threshold (local mean via integral image)
  const windowSize = Math.max(15, Math.round(w / 30))
  const half = Math.floor(windowSize / 2)
  const thresholded = new Uint8Array(w * h)

  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += source[y * w + x]
      integral[(y + 1) * (w + 1) + (x + 1)] =
        rowSum + integral[y * (w + 1) + (x + 1)]
    }
  }

  // C=6: pixels this much darker than local mean → black text
  const C = 6
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
      thresholded[y * w + x] = source[y * w + x] < mean - C ? 0 : 255
    }
  }

  // Step 4: Upscale 3x — more pixels for Tesseract to work with
  const scale = 3
  const out = document.createElement('canvas')
  out.width = w * scale
  out.height = h * scale
  const outCtx = out.getContext('2d')!
  const outData = outCtx.createImageData(out.width, out.height)
  const outPixels = outData.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = thresholded[y * w + x]
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const oi = ((y * scale + dy) * out.width + (x * scale + dx)) * 4
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

function cleanText(raw: string): string {
  const firstLine = raw.trim().split('\n')[0]?.trim() || ''
  return firstLine.replace(/[^a-zA-Z\s\-',]/g, '').trim()
}

export async function recognizeCardName(canvas: HTMLCanvasElement): Promise<string> {
  const w = await preloadWorker()

  // Primary attempt: dark-text-on-light (standard card frames)
  const { data: primary } = await w.recognize(preprocessImage(canvas))
  const primaryResult = cleanText(primary.text)

  if (primaryResult.length >= 3) return primaryResult

  // Fallback: invert polarity for light-text-on-dark frames (mythic, special frames)
  const { data: fallback } = await w.recognize(preprocessImage(canvas, true))
  const fallbackResult = cleanText(fallback.text)

  // Return whichever attempt produced more text
  return fallbackResult.length > primaryResult.length ? fallbackResult : primaryResult
}
