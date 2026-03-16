import api from './api'

export const userService = {
  getISOControls: async (complianceFrameworkId = null) => {
    const params = complianceFrameworkId ? { compliance_framework_id: complianceFrameworkId } : {}
    const response = await api.get('/api/v1/user/iso-controls', { params })
    // Normalize _id to id for consistency
    return response.data.map(control => ({
      ...control,
      id: control.id || control._id
    }))
  },

  getQuestions: async (isoControlId = null, complianceFrameworkId = null) => {
    const params = {}
    if (isoControlId) params.iso_control_id = isoControlId
    if (complianceFrameworkId) params.compliance_framework_id = complianceFrameworkId
    const response = await api.get('/api/v1/user/questions', { params })
    // Normalize _id to id for consistency
    return response.data.map(question => ({
      ...question,
      id: question.id || question._id
    }))
  },

  createControlResponse: async (controlResponse) => {
    const response = await api.post('/api/v1/user/control-responses', controlResponse)
    return response.data
  },

  getControlResponses: async () => {
    const response = await api.get('/api/v1/user/control-responses')
    // Normalize iso_control_id
    return response.data.map(cr => ({
      ...cr,
      iso_control_id: cr.iso_control_id || cr.iso_control_id?._id || cr.iso_control_id?.id
    }))
  },

  getResponses: async () => {
    const response = await api.get('/api/v1/user/responses')
    return response.data
  },

  createResponse: async (response) => {
    const response_data = await api.post('/api/v1/user/responses', response)
    return response_data.data
  },

  updateResponse: async (id, response) => {
    const response_data = await api.put(`/api/v1/user/responses/${id}`, response)
    return response_data.data
  },

  uploadProof: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/user/upload-proof', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  downloadProof: async (responseId) => {
    const response = await api.get(`/api/v1/user/responses/${responseId}/proof`, {
      responseType: 'blob',
    })
    return response.data
  },

  // RAG search for policy documents
  searchRAGDocuments: async (query, departmentId = null, nResults = 5) => {
    const params = { query, n_results: nResults }
    if (departmentId) {
      params.department_id = departmentId
    }
    // Add timeout to prevent hanging
    const response = await api.get('/api/v1/rag/documents/search', { 
      params,
      timeout: 30000 // 30 second timeout
    })
    return response.data
  },

  // Senior user dashboard
  getDepartmentStats: async () => {
    const response = await api.get('/api/v1/user/dashboard/stats')
    return response.data
  },

  getDepartmentUsers: async () => {
    const response = await api.get('/api/v1/user/department/users')
    return response.data
  },

  // Tasks management
  getTasks: async () => {
    const response = await api.get('/api/v1/user/tasks')
    return response.data
  },

  createTask: async (task) => {
    const response = await api.post('/api/v1/user/tasks', task)
    return response.data
  },

  updateTask: async (taskId, task) => {
    const response = await api.put(`/api/v1/user/tasks/${taskId}`, task)
    return response.data
  },

  deleteTask: async (taskId) => {
    await api.delete(`/api/v1/user/tasks/${taskId}`)
  },

  // Proof approval
  getPendingProofApprovals: async () => {
    const response = await api.get('/api/v1/user/proof-approvals')
    return response.data
  },

  approveProof: async (taskId, approvalRequest) => {
    const response = await api.post(`/api/v1/user/proof-approvals/${taskId}/approve`, approvalRequest)
    return response.data
  },

  // Notifications
  getNotifications: async () => {
    const response = await api.get('/api/v1/user/notifications')
    return response.data
  },

  getUnreadNotifications: async () => {
    const response = await api.get('/api/v1/user/notifications/unread')
    return response.data
  },

  getUnreadNotificationsCount: async () => {
    const response = await api.get('/api/v1/user/notifications/unread/count')
    return response.data
  },

  updateNotification: async (notificationId, update) => {
    const response = await api.put(`/api/v1/user/notifications/${notificationId}`, update)
    return response.data
  },

  markAllNotificationsRead: async () => {
    await api.put('/api/v1/user/notifications/mark-all-read')
  },

  // Compliance Frameworks (using admin endpoint - users can view active frameworks)
  getComplianceFrameworks: async (activeOnly = true) => {
    const params = activeOnly ? { active_only: true } : {}
    const response = await api.get('/api/v1/admin/compliance-frameworks', { params })
    return response.data.map(framework => ({
      ...framework,
      id: framework.id || framework._id
    }))
  },
}

