import { createWorker, PSM, type Worker } from 'tesseract.js'

export interface CollectorInfo {
  set: string
  number: string
}

let workerReady: Promise<Worker> | null = null

export function preloadWorker() {
  if (!workerReady) {
    workerReady = createWorker('eng').then(async (w) => {
      // SPARSE_TEXT: find text regions independently — handles card frame
      // decorations around the name bar without reading them as text.
      // Whitelist restricts to characters that appear in card names.
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -',",
      })
      return w
    }).catch((err) => {
      workerReady = null
      throw err
    })
  }
  return workerReady
}

let collectorWorkerReady: Promise<Worker> | null = null

export function preloadCollectorWorker() {
  if (!collectorWorkerReady) {
    collectorWorkerReady = createWorker('eng').then(async (w) => {
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/ ',
      })
      return w
    }).catch((err) => {
      collectorWorkerReady = null
      throw err
    })
  }
  return collectorWorkerReady
}

export function preprocessImage(canvas: HTMLCanvasElement, invertPolarity = false): HTMLCanvasElement {
  const srcCtx = canvas.getContext('2d')!
  const { data: srcPixels } = srcCtx.getImageData(0, 0, canvas.width, canvas.height)
  const w = canvas.width
  const h = canvas.height

  // Step 1: Grayscale
  const gray = new Uint8Array(w * h)
  for (let i = 0; i < srcPixels.length; i += 4) {
    gray[i / 4] = Math.round(
      0.299 * srcPixels[i] + 0.587 * srcPixels[i + 1] + 0.114 * srcPixels[i + 2]
    )
  }

  // Step 2: Mild Gaussian blur (3×3, σ≈1) to smooth foil/reflective surface noise
  // before thresholding — smoothing suppresses high-frequency foil texture that
  // adaptive threshold would otherwise misread as ink. Unlike sharpening, it does
  // NOT amplify noise artifacts.
  const blurred = new Uint8Array(w * h)
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1] // sum=16
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ny = Math.min(h - 1, Math.max(0, y + ky))
          const nx = Math.min(w - 1, Math.max(0, x + kx))
          sum += gray[ny * w + nx] * kernel[(ky + 1) * 3 + (kx + 1)]
        }
      }
      blurred[y * w + x] = Math.round(sum / 16)
    }
  }

  const source = invertPolarity ? blurred.map((v) => 255 - v) : blurred

  // Step 3: Adaptive threshold — window≈one character wide, C=8 keeps foil
  // gradients from counting as ink (pixel must be 8 levels darker than local mean)
  const windowSize = Math.max(15, Math.round(w / 40))
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

  const C = 8
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

  // Step 4: 2x upscale — brings character height to Tesseract sweet spot (20–30px)
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
  return raw
    .split('\n')
    .map((l) => l.replace(/[^a-zA-Z\s\-',]/g, '').trim())
    // Filter out noise: must have at least one word of 3+ letters
    .filter((l) => /[a-zA-Z]{3,}/.test(l))
    .sort((a, b) => b.length - a.length)
    // Strip leading/trailing single-char words (frame decoration artifacts like "t")
    .map((l) => l.replace(/^(\S\s)+/, '').replace(/(\s\S)+$/, '').trim())
    [0] ?? ''
}

export function parseCollectorInfo(raw: string): CollectorInfo | null {
  const text = raw.trim().toUpperCase()

  // Post-2024 format: "R 0123 SET EN" or "R 0123 SET"
  const post2024 = text.match(/[RCUMSB]\s+(\d{1,4}[A-Z]?)\s+([A-Z][A-Z0-9]{2,3})\b/)
  if (post2024) {
    return { number: post2024[1].replace(/^0+/, '') || '0', set: post2024[2].toLowerCase() }
  }

  // Pre-2024 format: "123/269 SET R EN" or "123/269 SET"
  const pre2024 = text.match(/(\d{1,4}[A-Z]?)\/\d+\s+([A-Z][A-Z0-9]{2,3})\b/)
  if (pre2024) {
    return { number: pre2024[1].replace(/^0+/, '') || '0', set: pre2024[2].toLowerCase() }
  }

  // Loose fallback: any 1-4 digit number near any 3-4 letter code
  const loose = text.match(/(\d{1,4}[A-Z]?)\s+([A-Z][A-Z0-9]{2,3})\b/)
  if (loose) {
    return { number: loose[1].replace(/^0+/, '') || '0', set: loose[2].toLowerCase() }
  }

  return null
}

export async function recognizeCollectorInfo(canvas: HTMLCanvasElement): Promise<{ info: CollectorInfo | null; raw: string; debugUrl: string }> {
  const worker = await preloadCollectorWorker()

  // Collector info is white text on dark background — always invert
  const processed = preprocessImage(canvas, true)
  const debugUrl = processed.toDataURL('image/png')

  const { data } = await worker.recognize(processed)
  const raw = data.text.trim()
  const info = parseCollectorInfo(raw)

  return { info, raw, debugUrl }
}

export async function recognizeCardName(canvas: HTMLCanvasElement): Promise<{ name: string; raw: string; debugUrl: string }> {
  const worker = await preloadWorker()

  const processed = preprocessImage(canvas)
  const debugUrl = processed.toDataURL('image/png')

  const { data: primary } = await worker.recognize(processed)
  const primaryName = bestLine(primary.text)

  if (primaryName.length >= 3) return { name: primaryName, raw: primary.text.trim(), debugUrl }

  // Inverted polarity fallback for light-text-on-dark frames
  const { data: fallback } = await worker.recognize(preprocessImage(canvas, true))
  const fallbackName = bestLine(fallback.text)

  return fallbackName.length > primaryName.length
    ? { name: fallbackName, raw: fallback.text.trim(), debugUrl }
    : { name: primaryName, raw: primary.text.trim(), debugUrl }
}
