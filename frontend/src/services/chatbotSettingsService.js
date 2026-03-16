import api from './api'

/**
 * Chatbot (OpenAI) settings – config for Layout/Chatbot and admin settings.
 */
export const chatbotSettingsService = {
  /** For Layout/Chatbot: enabled + title (any authenticated user). */
  getConfig: async () => {
    const response = await api.get('/api/v1/chatbot-settings/config')
    return response.data
  },

  /** Admin: full settings (enabled, title, model). */
  getSettings: async () => {
    const response = await api.get('/api/v1/chatbot-settings/settings')
    return response.data
  },

  /** Admin: update settings. */
  updateSettings: async (payload) => {
    const response = await api.put('/api/v1/chatbot-settings/settings', payload)
    return response.data
  },
}
