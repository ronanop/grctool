import api from './api'

/**
 * Send a message to the chatbot and get a reply.
 * @param {string} message - User message
 * @param {Array<{ role: 'user'|'assistant'|'system', content: string }>} messages - Optional conversation history
 * @returns {Promise<{ reply: string, model: string }>}
 */
export const chatService = {
  sendMessage: async (message, messages = []) => {
    const response = await api.post('/api/v1/chat/openai', {
      message,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }, { timeout: 90000 })
    return response.data
  },

  /**
   * Send message with optional image (vision) or other options.
   * @param {{ message: string, messages: Array<{role, content}>, image_base64?: string }} options
   * @returns {Promise<{ reply: string, model: string }>}
   */
  sendMessageWithOptions: async ({ message, messages = [], image_base64 }) => {
    const body = {
      message: message || '',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }
    if (image_base64) body.image_base64 = image_base64
    // Longer timeout for chat (RAG + model can take 30–90s)
    const response = await api.post('/api/v1/chat/openai', body, { timeout: 90000 })
    return response.data
  },
}
