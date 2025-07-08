// In-memory store for transcriptions (in production, use Redis or similar)
const transcriptionStore = new Map<string, {
  userText: string
  agentText: string
  lastUpdate: number
}>()

// Helper function to update transcription store
export function updateTranscription(sessionId: string, type: 'user' | 'agent', text: string) {
  console.log(`=== TRANSCRIPTION STORE UPDATE ===`)
  console.log(`Session: ${sessionId}, Type: ${type}, Text: "${text}"`)
  
  const existing = transcriptionStore.get(sessionId) || { userText: '', agentText: '', lastUpdate: 0 }
  console.log('Existing data:', existing)
  
  if (type === 'user') {
    existing.userText = text
  } else {
    existing.agentText = text
  }
  
  existing.lastUpdate = Date.now()
  transcriptionStore.set(sessionId, existing)
  
  console.log('Updated data:', existing)
  console.log('Store size:', transcriptionStore.size)
}

// Helper function to get transcription data
export function getTranscription(sessionId: string) {
  return transcriptionStore.get(sessionId) || { userText: '', agentText: '', lastUpdate: 0 }
}