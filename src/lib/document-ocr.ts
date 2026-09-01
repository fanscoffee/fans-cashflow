import { createWorker, PSM } from "tesseract.js"

function mergeIkeaOcr(blockText: string, columnText: string) {
  const blockLines = blockText.split(/\r?\n/)
  const columnLines = columnText.split(/\r?\n/)
  const blockProductPositions = blockLines.map((line, index) => /art\/\s*ea/i.test(line) ? index : -1).filter((index) => index >= 0)
  const columnProductPositions = columnLines.map((line, index) => /art\/\s*ea/i.test(line) ? index : -1).filter((index) => index >= 0)
  if (columnProductPositions.length <= blockProductPositions.length) return columnText

  const merged = [...columnLines]
  for (let productIndex = 0; productIndex < columnProductPositions.length; productIndex += 1) {
    const columnStart = columnProductPositions[productIndex]
    const columnEnd = columnProductPositions[productIndex + 1] ?? columnLines.length
    const blockStart = blockProductPositions[productIndex]
    const blockEnd = blockProductPositions[productIndex + 1] ?? blockLines.length
    if (blockStart == null) continue

    const blockReference = blockLines[blockStart].match(/art\/\s*ea\s+(\d+)/i)?.[1]
    if (blockReference) merged[columnStart] = merged[columnStart].replace(/(art\/\s*ea\s+)\d+/i, `$1${blockReference}`)

    const blockPriceLine = blockLines.slice(blockStart + 1, blockEnd).find((line) => /^\s*\d+\s+\d+[,.]\d+\s+\d+[,.]\d+/.test(line))
    if (blockPriceLine) {
      const columnPriceIndex = merged.slice(columnStart + 1, columnEnd).findIndex((line) => (line.match(/\d+[,.]\d+/g) || []).length >= 2)
      if (columnPriceIndex >= 0) merged[columnStart + 1 + columnPriceIndex] = blockPriceLine
    }
  }
  return merged.join("\n")
}

async function recognizeImage(file: Blob | HTMLCanvasElement, setStatus: (value: string) => void, languages: string) {
  const worker = await createWorker(languages, 1, { logger: (message) => message.status && setStatus(`${message.status} ${Math.round(message.progress * 100)}%`) })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" })
    const blockResult = await worker.recognize(file)
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" })
    const columnResult = await worker.recognize(file)
    if (/art\/\s*ea/i.test(columnResult.data.text)) return mergeIkeaOcr(blockResult.data.text, columnResult.data.text)
    return blockResult.data.text.trim().length >= columnResult.data.text.trim().length ? blockResult.data.text : columnResult.data.text
  } finally {
    await worker.terminate()
  }
}

async function isPdfFile(file: File) {
  if (file.type.toLowerCase() === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return true
  const header = new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer()))
  return header === "%PDF-"
}

function pdfItemsToText(items: unknown[]) {
  const rows: Array<{ y: number; items: Array<{ x: number; text: string }> }> = []
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") continue
    const item = rawItem as { str?: unknown; transform?: unknown }
    if (typeof item.str !== "string" || !item.str.trim() || !Array.isArray(item.transform)) continue
    const x = Number(item.transform[4]) || 0
    const y = Number(item.transform[5]) || 0
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 1.5)
    if (!row) {
      row = { y, items: [] }
      rows.push(row)
    }
    row.items.push({ x, text: item.str.trim() })
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")).join("\n")
}

export async function extractDocument(file: File, setStatus: (value: string) => void, languages = "spa+eng") {
  if (!(await isPdfFile(file))) return recognizeImage(file, setStatus, languages)

  setStatus("Abriendo PDF...")
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const buffer = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setStatus(`Leyendo página ${pageNumber}/${pdf.numPages}`)
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    pages.push(pdfItemsToText(textContent.items))
  }
  const text = pages.join("\n")
  if (text.trim().length > 40) return text

  const ocrPages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const canvasContext = canvas.getContext("2d")
    if (!canvasContext) throw new Error("El navegador no permite renderizar el PDF")
    await page.render({ canvas, canvasContext, viewport }).promise
    ocrPages.push(await recognizeImage(canvas, setStatus, languages))
  }
  const ocrText = ocrPages.join("\n")
  if (!ocrText.trim()) throw new Error("El PDF no contiene texto legible")
  return ocrText
}
