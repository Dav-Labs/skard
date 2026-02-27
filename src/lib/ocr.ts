import { createWorker, type Worker } from 'tesseract.js'

let workerReady: Promise<Worker> | null = null

export function preloadWorker() {
  if (!workerReady) {
    workerReady = createWorker('eng').catch((err) => {
      workerReady = null
      throw err
    })
  }
  return workerReady
}

export function preprocessImage(canvas: HTMLCanvasElement, invertPolarity = false): HTMLCanvasElement {
  const srcCtx = canvas.getContext('2d')!
  const srcData = srcCtx.getImageData(0, 0, canvas.width, canvas.height)
  const srcPixels = srcData.data

  const w = canvas.width
  const h = canvas.height

  // Step 1: Grayscale
  const gray = new Uint8Array(w * h)
  for (let i = 0; i < srcPixels.length; i += 4) {
    gray[i / 4] = Math.round(
      0.299 * srcPixels[i] + 0.587 * srcPixels[i + 1] + 0.114 * srcPixels[i + 2]
    )
  }

  // Step 2: Sharpen — Laplacian 3×3 (center=5, NSEW=-1)
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

  const source = invertPolarity ? sharpened.map((v) => 255 - v) : sharpened

  // Step 3: Adaptive threshold
  const windowSize = Math.max(15, Math.round(w / 30))
  const half = Math.floor(windowSize / 2)
  const thresholded = new Uint8Array(w * h)

  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += source[y * w + x]
      integral[(y + 1) * (w + 1) + (x + 1)] = rowSum + integral[y * (w + 1) + (x + 1)]
    }
  }

  const C = 6
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half), y1 = Math.max(0, y - half)
      const x2 = Math.min(w - 1, x + half), y2 = Math.min(h - 1, y + half)
      const area = (x2 - x1 + 1) * (y2 - y1 + 1)
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1]
      thresholded[y * w + x] = source[y * w + x] < sum / area - C ? 0 : 255
    }
  }

  // Step 4: 3x upscale
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
          outPixels[oi] = outPixels[oi + 1] = outPixels[oi + 2] = val
          outPixels[oi + 3] = 255
        }
      }
    }
  }

  outCtx.putImageData(outData, 0, 0)
  return out
}

function bestLine(raw: string): string {
  // Pick the longest alpha-only line — handles cases where mana cost or
  // other symbols appear on a different line than the card name
  return raw
    .split('\n')
    .map((l) => l.replace(/[^a-zA-Z\s\-',]/g, '').trim())
    .sort((a, b) => b.length - a.length)[0] ?? ''
}

export async function recognizeCardName(canvas: HTMLCanvasElement): Promise<{ name: string; raw: string }> {
  const worker = await preloadWorker()

  const { data: primary } = await worker.recognize(preprocessImage(canvas))
  const primaryName = bestLine(primary.text)

  if (primaryName.length >= 3) return { name: primaryName, raw: primary.text.trim() }

  // Inverted polarity fallback (light-text-on-dark frames)
  const { data: fallback } = await worker.recognize(preprocessImage(canvas, true))
  const fallbackName = bestLine(fallback.text)

  if (fallbackName.length > primaryName.length) {
    return { name: fallbackName, raw: fallback.text.trim() }
  }
  return { name: primaryName, raw: primary.text.trim() }
}
