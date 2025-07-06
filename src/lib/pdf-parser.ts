// PDF parsing utility using PDF.js legacy build for Node.js
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Use the legacy build for Node.js environments
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    
    // Set worker source for Node.js environment
    const path = await import('path')
    const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath
    
    // Convert Buffer to Uint8Array
    const pdfData = new Uint8Array(buffer)
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({
      data: pdfData,
    }).promise
    
    let fullText = ''
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Combine all text items from the page
      const pageText = textContent.items
        .map((item: unknown) => {
          const textItem = item as { str?: string }
          return textItem.str || ''
        })
        .join(' ')
      
      fullText += pageText + '\n'
    }
    
    return fullText.trim()
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('Failed to parse PDF file')
  }
}