import { createWorker, type Worker } from 'tesseract.js'

let workerReady: Promise<Worker> | null = null

export function preloadWorker() {
  if (!workerReady) {
    workerReady = createWorker('eng')
  }
  return workerReady
}

export function preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    // Increase contrast
    const contrast = ((gray - 128) * 1.5 + 128)
    const val = Math.max(0, Math.min(255, contrast))
    data[i] = val
    data[i + 1] = val
    data[i + 2] = val
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
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
