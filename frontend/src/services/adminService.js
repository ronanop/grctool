import api from './api'

export const adminService = {
  // Departments
  getDepartments: async (complianceFrameworkId = null) => {
    const params = complianceFrameworkId ? { compliance_framework_id: complianceFrameworkId } : {}
    const response = await api.get('/api/v1/admin/departments', { params })
    // Normalize _id to id for consistency
    return response.data.map(dept => ({
      ...dept,
      id: dept.id || dept._id,
      compliance_framework_ids: dept.compliance_framework_ids || []
    }))
  },

  createDepartment: async (department) => {
    const response = await api.post('/api/v1/admin/departments', department)
    return response.data
  },

  updateDepartment: async (id, department) => {
    const response = await api.put(`/api/v1/admin/departments/${id}`, department)
    return response.data
  },

  deleteDepartment: async (id) => {
    await api.delete(`/api/v1/admin/departments/${id}`)
  },

  clearDepartmentResponses: async (id) => {
    const response = await api.delete(`/api/v1/admin/departments/${id}/responses`)
    return response.data
  },

  // Compliance Frameworks
  getComplianceFrameworks: async (activeOnly = false) => {
    const params = activeOnly ? { active_only: true } : {}
    const response = await api.get('/api/v1/admin/compliance-frameworks', { params })
    return response.data.map(framework => ({
      ...framework,
      id: framework.id || framework._id
    }))
  },

  createComplianceFramework: async (framework) => {
    const response = await api.post('/api/v1/admin/compliance-frameworks', framework)
    return response.data
  },

  updateComplianceFramework: async (id, framework) => {
    const response = await api.put(`/api/v1/admin/compliance-frameworks/${id}`, framework)
    return response.data
  },

  deleteComplianceFramework: async (id) => {
    await api.delete(`/api/v1/admin/compliance-frameworks/${id}`)
  },

  // ISO Controls
  getISOControls: async (departmentId = null, complianceFrameworkId = null) => {
    const params = {}
    if (departmentId) params.department_id = departmentId
    if (complianceFrameworkId) params.compliance_framework_id = complianceFrameworkId
    const response = await api.get('/api/v1/admin/iso-controls', { params })
    return response.data.map(control => ({
      ...control,
      id: control.id || control._id,
      department_id: control.department_id || control.departmentId
    }))
  },

  createISOControl: async (control) => {
    const response = await api.post('/api/v1/admin/iso-controls', control)
    return response.data
  },

  updateISOControl: async (id, control) => {
    const response = await api.put(`/api/v1/admin/iso-controls/${id}`, control)
    return response.data
  },

  deleteISOControl: async (id) => {
    await api.delete(`/api/v1/admin/iso-controls/${id}`)
  },

  // Questions
  getQuestions: async (isoControlId = null, departmentId = null, complianceFrameworkId = null) => {
    const params = {}
    if (isoControlId) params.iso_control_id = isoControlId
    if (departmentId) params.department_id = departmentId
    if (complianceFrameworkId) params.compliance_framework_id = complianceFrameworkId
    const response = await api.get('/api/v1/admin/questions', { params })
    // Normalize _id to id for consistency
    return response.data.map(q => ({
      ...q,
      id: q.id || q._id,
      iso_control_id: q.iso_control_id || q.isoControlId
    }))
  },

  createQuestion: async (question) => {
    const response = await api.post('/api/v1/admin/questions', question)
    return {
      ...response.data,
      id: response.data.id || response.data._id,
      iso_control_id: response.data.iso_control_id || response.data.isoControlId
    }
  },

  updateQuestion: async (id, question) => {
    const response = await api.put(`/api/v1/admin/questions/${id}`, question)
    return {
      ...response.data,
      id: response.data.id || response.data._id,
      iso_control_id: response.data.iso_control_id || response.data.isoControlId
    }
  },

  deleteQuestion: async (id) => {
    await api.delete(`/api/v1/admin/questions/${id}`)
  },

  bulkImportQuestions: async (file, importMode = 'create_only') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('import_mode', importMode)
    
    try {
      const response = await api.post('/api/v1/admin/questions/bulk-import', formData)
      return response.data
    } catch (error) {
      // Re-throw with better error message
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail
        const newError = new Error(detail)
        newError.response = error.response
        throw newError
      }
      throw error
    }
  },

  // Users
  getUsers: async () => {
    const response = await api.get('/api/v1/admin/users')
    // Normalize _id to id for consistency
    return response.data.map(user => ({
      ...user,
      id: user.id || user._id,
      department_id: user.department_id || user.departmentId
    }))
  },

  deleteUser: async (id) => {
    await api.delete(`/api/v1/admin/users/${id}`)
  },

  // Dashboard
  getDashboardStats: async () => {
    const response = await api.get('/api/v1/admin/dashboard/stats')
    return response.data
  },

  // Responses
  getResponses: async (departmentId = null, userId = null) => {
    const params = {}
    if (departmentId) params.department_id = departmentId
    if (userId) params.user_id = userId
    const response = await api.get('/api/v1/admin/responses', { params })
    return response.data
  },

  downloadProof: async (responseId) => {
    const response = await api.get(`/api/v1/admin/responses/${responseId}/proof`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Policies
  getPolicies: async (params = {}) => {
    const response = await api.get('/api/v1/admin/policies', { params })
    return response.data.map(policy => ({
      ...policy,
      id: policy.id || policy._id,
      department_id: policy.department_id || policy.department_id?._id || policy.department_id?.id
    }))
  },

  uploadPolicy: async (file, name, description, departmentId) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('department_id', departmentId)
    if (name) formData.append('name', name)
    if (description) formData.append('description', description)
    
    const response = await api.post('/api/v1/admin/policies', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return {
      ...response.data,
      id: response.data.id || response.data._id
    }
  },

  updatePolicy: async (id, policy) => {
    const response = await api.put(`/api/v1/admin/policies/${id}`, policy)
    return {
      ...response.data,
      id: response.data.id || response.data._id
    }
  },

  deletePolicy: async (id) => {
    await api.delete(`/api/v1/admin/policies/${id}`)
  },

  downloadPolicy: async (id) => {
    const response = await api.get(`/api/v1/admin/policies/${id}/download`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Agents
  getAgents: async (params = {}) => {
    const response = await api.get('/api/v1/admin/agents', { params })
    return response.data.map(agent => ({
      ...agent,
      id: agent.id || agent._id,
      department_id: agent.department_id || agent.department_id?._id || agent.department_id?.id
    }))
  },

  createAgent: async (agent) => {
    const response = await api.post('/api/v1/admin/agents', agent)
    return {
      ...response.data,
      id: response.data.id || response.data._id
    }
  },

  updateAgent: async (id, agent) => {
    const response = await api.put(`/api/v1/admin/agents/${id}`, agent)
    return {
      ...response.data,
      id: response.data.id || response.data._id
    }
  },

  deleteAgent: async (id) => {
    await api.delete(`/api/v1/admin/agents/${id}`)
  },

  // OEM / Partner integrations (Archer-style)
  getOEMAgents: async () => {
    const response = await api.get('/api/v1/admin/oem-agents')
    return response.data || []
  },
  getOEMAgent: async (slug) => {
    const response = await api.get(`/api/v1/admin/oem-agents/${slug}`)
    return response.data
  },
  updateOEMAgent: async (slug, payload) => {
    const response = await api.put(`/api/v1/admin/oem-agents/${slug}`, payload)
    return response.data
  },

  // RAG Documents
  uploadRAGDocument: async (file, departmentId, documentName) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('department_id', departmentId)
    if (documentName) {
      formData.append('document_name', documentName)
    }
    const response = await api.post('/api/v1/rag/documents/upload', formData, {
      timeout: 120000, // 2 min - RAG processing (embedding + Pinecone) can be slow
    })
    return response.data
  },

  getRAGDocuments: async (departmentId = null) => {
    const params = {}
    if (departmentId && departmentId !== 'all') {
      params.department_id = departmentId
    }
    const response = await api.get('/api/v1/rag/documents', { params })
    if (!response.data || !Array.isArray(response.data)) {
      return []
    }
    return response.data.map(doc => ({
      ...doc,
      id: doc.id || doc._id,
      department_id: doc.department_id || doc.department_id?._id || doc.department_id?.id
    }))
  },

  deleteRAGDocument: async (documentId) => {
    await api.delete(`/api/v1/rag/documents/${documentId}`)
  },

  searchRAGDocuments: async (query, departmentId = null, nResults = 5) => {
    const params = { query, n_results: nResults }
    if (departmentId) {
      params.department_id = departmentId
    }
    const response = await api.get('/api/v1/rag/documents/search', { params })
    return response.data
  },

  getRAGStats: async (departmentId = null) => {
    const params = departmentId ? { department_id: departmentId } : {}
    const response = await api.get('/api/v1/rag/documents/stats', { params })
    return response.data
  },

  // Local VD (ChromaDB)
  uploadLocalVDDocument: async (file, departmentId, documentName) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('department_id', departmentId)
    if (documentName) {
      formData.append('document_name', documentName)
    }
    const response = await api.post('/api/v1/local-vd/documents/upload', formData, {
      timeout: 120000,
    })
    return response.data
  },

  getLocalVDDocuments: async (departmentId = null) => {
    const params = {}
    if (departmentId && departmentId !== 'all') {
      params.department_id = departmentId
    }
    const response = await api.get('/api/v1/local-vd/documents', { params })
    if (!response.data || !Array.isArray(response.data)) {
      return []
    }
    return response.data.map(doc => ({
      ...doc,
      id: doc.id || doc._id,
      department_id: doc.department_id || doc.department_id?._id || doc.department_id?.id
    }))
  },

  deleteLocalVDDocument: async (documentId) => {
    await api.delete(`/api/v1/local-vd/documents/${documentId}`)
  },

  searchLocalVDDocuments: async (query, departmentId, nResults = 5) => {
    const params = { query, n_results: nResults }
    if (departmentId && departmentId !== 'all') {
      params.department_id = departmentId
    }
    const response = await api.get('/api/v1/local-vd/documents/search', { params })
    return response.data
  },
}

