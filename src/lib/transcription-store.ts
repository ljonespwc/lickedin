// In-memory store for transcriptions (in production, use Redis or similar)
const transcriptionStore = new Map<string, {
  userText: string
  agentText: string
  lastUpdate: number
}>()

// Map LayerCode session IDs to interview session IDs
const sessionMapping = new Map<string, string>()

// Store the latest interview session ID (simple fallback approach)
let latestInterviewSessionId: string | null = null

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

// Helper function to set the latest interview session ID
export function setLatestInterviewSessionId(sessionId: string) {
  console.log(`=== SETTING LATEST INTERVIEW SESSION ===`)
  console.log(`Setting: ${sessionId}`)
  latestInterviewSessionId = sessionId
}

// Helper function to get the interview session ID from LayerCode session ID
export function getInterviewSessionId(layerCodeSessionId: string): string | undefined {
  const mapped = sessionMapping.get(layerCodeSessionId)
  if (mapped) {
    return mapped
  }
  
  // Fallback to latest interview session if no mapping exists
  console.log(`=== FALLBACK TO LATEST SESSION ===`)
  console.log(`LayerCode session: ${layerCodeSessionId}`)
  console.log(`Latest interview session: ${latestInterviewSessionId}`)
  
  // If no latest session, let's check if we can find an active session from transcription store
  if (!latestInterviewSessionId) {
    console.log(`=== ATTEMPTING TO FIND ACTIVE SESSION ===`)
    // Look for any sessions that have recent activity (last 5 minutes)
    const now = Date.now()
    const fiveMinutesAgo = now - (5 * 60 * 1000)
    
    for (const [sessionId, data] of transcriptionStore.entries()) {
      if (data.lastUpdate > fiveMinutesAgo) {
        console.log(`=== FOUND ACTIVE SESSION: ${sessionId} ===`)
        return sessionId
      }
    }
  }
  
  return latestInterviewSessionId || undefined
}

// Helper function to get transcription data
export function getTranscription(sessionId: string) {
  return transcriptionStore.get(sessionId) || { userText: '', agentText: '', lastUpdate: 0 }
}