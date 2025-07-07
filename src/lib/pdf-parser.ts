import { extractText, getDocumentProxy } from 'unpdf'

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer)
    
    // Load the PDF file into a PDF.js document
    const pdf = await getDocumentProxy(uint8Array)
    
    // Extract the text from the PDF file
    const { text } = await extractText(pdf, { mergePages: true })
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in PDF')
    }
    
    return text
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}