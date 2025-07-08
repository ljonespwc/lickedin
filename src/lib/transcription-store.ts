// In-memory store for transcriptions (in production, use Redis or similar)
const transcriptionStore = new Map<string, {
  userText: string
  agentText: string
  lastUpdate: number
}>()

// Map LayerCode session IDs to interview session IDs
const sessionMapping = new Map<string, string>()

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

// Helper function to map LayerCode session to interview session
export function mapLayerCodeSession(layerCodeSessionId: string, interviewSessionId: string) {
  console.log(`=== SESSION MAPPING ===`)
  console.log(`LayerCode: ${layerCodeSessionId} -> Interview: ${interviewSessionId}`)
  sessionMapping.set(layerCodeSessionId, interviewSessionId)
}

// Helper function to get the interview session ID from LayerCode session ID
export function getInterviewSessionId(layerCodeSessionId: string): string | undefined {
  return sessionMapping.get(layerCodeSessionId)
}

// Helper function to get transcription data
export function getTranscription(sessionId: string) {
  return transcriptionStore.get(sessionId) || { userText: '', agentText: '', lastUpdate: 0 }
}