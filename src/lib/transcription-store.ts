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
  const existing = transcriptionStore.get(sessionId) || { userText: '', agentText: '', lastUpdate: 0 }
  
  if (type === 'user') {
    existing.userText = text
  } else {
    existing.agentText = text
  }
  
  existing.lastUpdate = Date.now()
  transcriptionStore.set(sessionId, existing)
}

// Helper function to map LayerCode session to interview session
export function mapLayerCodeSession(layerCodeSessionId: string, interviewSessionId: string) {
  sessionMapping.set(layerCodeSessionId, interviewSessionId)
}

// Helper function to set the latest interview session ID
export function setLatestInterviewSessionId(sessionId: string) {
  latestInterviewSessionId = sessionId
}

// Helper function to get the interview session ID from LayerCode session ID
export function getInterviewSessionId(layerCodeSessionId: string): string | undefined {
  const mapped = sessionMapping.get(layerCodeSessionId)
  if (mapped) {
    return mapped
  }
  
  // Fallback to latest interview session if no mapping exists
  if (!latestInterviewSessionId) {
    // Look for any sessions that have recent activity (last 5 minutes)
    const now = Date.now()
    const fiveMinutesAgo = now - (5 * 60 * 1000)
    
    for (const [sessionId, data] of transcriptionStore.entries()) {
      if (data.lastUpdate > fiveMinutesAgo) {
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