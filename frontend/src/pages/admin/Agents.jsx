import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { chatbotSettingsService } from '../../services/chatbotSettingsService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Bot, Edit, Building2, Filter, MessageCircle, Settings, Plug, ChevronRight, Database, Shield, Users, FolderOpen, Headphones } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TAB_AGENTS = 'agents'
const TAB_CHATBOT = 'chatbot'
const TAB_OEM = 'oem'

const OEM_ICONS = {
  database: Database,
  business: Building2,
  people: Users,
  settings: Settings,
  folder: FolderOpen,
  support: Headphones,
  security: Shield,
}

const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  department_id: z.string().optional(),
  status: z.string().optional(),
})

const Agents = () => {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [activeTab, setActiveTab] = useState(TAB_OEM)
  const [chatbotSettings, setChatbotSettings] = useState({ enabled: true, title: 'Assistant', model: 'gpt-4o-mini', custom_instructions: '', vector_db: 'pinecone' })
  const [chatbotSettingsLoading, setChatbotSettingsLoading] = useState(false)
  const [chatbotSaving, setChatbotSaving] = useState(false)
  const [oemAgents, setOemAgents] = useState([])
  const [oemLoading, setOemLoading] = useState(false)
  const [selectedOEM, setSelectedOEM] = useState(null)
  const [oemConfig, setOemConfig] = useState({ enabled: false, api_base_url: '', auth_type: '', schedule_cron: '', notes: '' })
  const [oemSaving, setOemSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: zodResolver(agentSchema),
  })

  useEffect(() => {
    loadDepartments()
    loadAgents()
  }, [])

  useEffect(() => {
    loadAgents()
  }, [selectedDepartment])

  useEffect(() => {
    if (activeTab === TAB_CHATBOT) loadChatbotSettings()
    if (activeTab === TAB_OEM) loadOEMAgents()
  }, [activeTab])

  const loadOEMAgents = async () => {
    setOemLoading(true)
    try {
      const data = await adminService.getOEMAgents()
      setOemAgents(data || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load OEM agents')
      setOemAgents([])
    } finally {
      setOemLoading(false)
    }
  }

  const openOEMConfig = (oem) => {
    setSelectedOEM(oem)
    setOemConfig({
      enabled: oem.enabled ?? false,
      api_base_url: oem.config?.api_base_url ?? '',
      auth_type: oem.config?.auth_type ?? '',
      schedule_cron: oem.config?.schedule_cron ?? '',
      notes: oem.config?.notes ?? '',
    })
  }

  const saveOEMConfig = async () => {
    if (!selectedOEM) return
    setOemSaving(true)
    try {
      await adminService.updateOEMAgent(selectedOEM.slug, {
        enabled: oemConfig.enabled,
        api_base_url: oemConfig.api_base_url || undefined,
        auth_type: oemConfig.auth_type || undefined,
        schedule_cron: oemConfig.schedule_cron || undefined,
        notes: oemConfig.notes || undefined,
      })
      toast.success(`${selectedOEM.name} configuration saved`)
      loadOEMAgents()
      setSelectedOEM(prev => prev ? { ...prev, ...oemConfig, config: { ...selectedOEM.config, ...oemConfig } } : null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save configuration')
    } finally {
      setOemSaving(false)
    }
  }

  const loadChatbotSettings = async () => {
    setChatbotSettingsLoading(true)
    try {
      const data = await chatbotSettingsService.getSettings()
      setChatbotSettings({
        enabled: data.enabled ?? true,
        title: data.title ?? 'Assistant',
        model: data.model ?? 'gpt-4o-mini',
        custom_instructions: data.custom_instructions ?? '',
        vector_db: data.vector_db ?? 'pinecone',
      })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load chatbot settings')
    } finally {
      setChatbotSettingsLoading(false)
    }
  }

  const saveChatbotSettings = async () => {
    setChatbotSaving(true)
    try {
      const data = await chatbotSettingsService.updateSettings(chatbotSettings)
      setChatbotSettings(data)
      toast.success('Chatbot settings saved')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save chatbot settings')
    } finally {
      setChatbotSaving(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await adminService.getDepartments()
      setDepartments(data || [])
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadAgents = async () => {
    try {
      const params = selectedDepartment !== 'all' ? { department_id: selectedDepartment } : {}
      const data = await adminService.getAgents(params)
      setAgents(data || [])
    } catch (error) {
      console.error('Error loading agents:', error)
      toast.error(error.response?.data?.detail || 'Failed to load agents')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      if (editingAgent) {
        await adminService.updateAgent(editingAgent.id, data)
        toast.success('Agent updated successfully')
      } else {
        await adminService.createAgent(data)
        toast.success('Agent created successfully')
      }
      reset()
      setShowForm(false)
      setEditingAgent(null)
      loadAgents()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save agent')
    }
  }

  const handleEdit = (agent) => {
    setEditingAgent(agent)
    setValue('name', agent.name)
    setValue('description', agent.description || '')
    setValue('department_id', agent.department_id || '')
    setValue('status', agent.status || 'active')
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return

    try {
      await adminService.deleteAgent(id)
      toast.success('Agent deleted successfully')
      loadAgents()
    } catch (error) {
      toast.error('Failed to delete agent')
    }
  }

  const handleCancel = () => {
    reset()
    setShowForm(false)
    setEditingAgent(null)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">smart_toy</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Agent Management</h1>
              <p className="text-sm text-slate-400 mt-1">Agents • Chatbot • OEM & Partners</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex rounded-xl border border-white/20 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setActiveTab(TAB_AGENTS)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === TAB_AGENTS ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Bot className="w-4 h-4" />
                Agents
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(TAB_CHATBOT)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === TAB_CHATBOT ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Chatbot
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(TAB_OEM)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === TAB_OEM ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Plug className="w-4 h-4" />
                OEM & Partners
              </button>
            </div>
          {activeTab === TAB_AGENTS && (
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              {showForm ? 'Cancel' : 'Add Agent'}
            </Button>
          )}
        </div>
        </div>
      </div>

      {activeTab === TAB_CHATBOT && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Chatbot Settings & Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chatbotSettingsLoading ? (
              <p className="text-gray-500">Loading settings...</p>
            ) : (
              <div className="space-y-6 max-w-xl">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-900">Enable chatbot</p>
                    <p className="text-sm text-gray-500">Show the floating chatbot to logged-in users</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={chatbotSettings.enabled}
                      onChange={(e) => setChatbotSettings((s) => ({ ...s, enabled: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chatbot title</label>
                  <Input
                    value={chatbotSettings.title}
                    onChange={(e) => setChatbotSettings((s) => ({ ...s, title: e.target.value }))}
                    placeholder="e.g. Assistant"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI model</label>
                  <Input
                    value={chatbotSettings.model}
                    onChange={(e) => setChatbotSettings((s) => ({ ...s, model: e.target.value }))}
                    placeholder="e.g. gpt-4o-mini"
                  />
                  <p className="mt-1 text-xs text-gray-500">Model used for chat completions (e.g. gpt-4o-mini, gpt-4o)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vector database for chatbot context</label>
                  <select
                    value={chatbotSettings.vector_db ?? 'pinecone'}
                    onChange={(e) => setChatbotSettings((s) => ({ ...s, vector_db: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pinecone">Pinecone (cloud)</option>
                    <option value="local">Local (ChromaDB)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Chatbot uses this vector DB to retrieve document context. Pinecone = RAG Documents; Local = Local VD (ChromaDB).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom instructions</label>
                  <textarea
                    value={chatbotSettings.custom_instructions ?? ''}
                    onChange={(e) => setChatbotSettings((s) => ({ ...s, custom_instructions: e.target.value }))}
                    placeholder="e.g. Always respond in a formal tone. Focus on ISO 27001 when relevant."
                    rows={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional. These are added to the chatbot system prompt and guide how it responds.</p>
                </div>
                <Button onClick={saveChatbotSettings} disabled={chatbotSaving}>
                  {chatbotSaving ? 'Saving...' : 'Save Chatbot Settings'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === TAB_OEM && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">OEM & Partner Integrations</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure integrations for automatic proof submission (Archer-style). Click an OEM to set connection and sync options.
            </p>
          </div>
          {oemLoading ? (
            <p className="text-gray-500">Loading OEM agents...</p>
          ) : selectedOEM ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = OEM_ICONS[selectedOEM.icon] || Plug
                      return <Icon className="w-5 h-5" />
                    })()}
                    {selectedOEM.name}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOEM(null)}>Back to list</Button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{selectedOEM.what_it_does}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium">Data source:</span> {selectedOEM.fetch_methods}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Enable integration</p>
                    <p className="text-sm text-gray-500">Use this OEM for automatic proof submission</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={oemConfig.enabled}
                      onChange={(e) => setOemConfig(c => ({ ...c, enabled: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 dark:bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API base URL</label>
                  <Input
                    value={oemConfig.api_base_url}
                    onChange={(e) => setOemConfig(c => ({ ...c, api_base_url: e.target.value }))}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Auth type</label>
                  <select
                    value={oemConfig.auth_type}
                    onChange={(e) => setOemConfig(c => ({ ...c, auth_type: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="">— Select —</option>
                    <option value="api_key">API Key</option>
                    <option value="oauth2">OAuth 2.0</option>
                    <option value="basic">Basic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule (cron or description)</label>
                  <Input
                    value={oemConfig.schedule_cron}
                    onChange={(e) => setOemConfig(c => ({ ...c, schedule_cron: e.target.value }))}
                    placeholder="e.g. 0 */6 * * * (every 6 hours) or Daily at 2am"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                  <textarea
                    value={oemConfig.notes}
                    onChange={(e) => setOemConfig(c => ({ ...c, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-200"
                    placeholder="Connection or mapping notes..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={saveOEMConfig} disabled={oemSaving}>
                    {oemSaving ? 'Saving...' : 'Save configuration'}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedOEM(null)}>Back to list</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {oemAgents.map((oem) => {
                const Icon = OEM_ICONS[oem.icon] || Plug
                return (
                  <Card
                    key={oem.slug}
                    className="cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                    onClick={() => openOEMConfig(oem)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{oem.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{oem.what_it_does}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">
                        <span className="font-medium">Fetch:</span> {oem.fetch_methods}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${oem.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {oem.enabled ? 'Enabled' : 'Not configured'}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Configure</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === TAB_AGENTS && showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingAgent ? 'Edit Agent' : 'Create New Agent'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('name')}
                  placeholder="e.g., Compliance Agent, Security Agent"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Brief description of the agent..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department (Optional)
                </label>
                <select
                  {...register('department_id')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">No Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingAgent ? 'Update Agent' : 'Create Agent'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === TAB_AGENTS && (
        <>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <label className="text-sm font-medium text-gray-700">Filter by Department:</label>
        </div>
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const department = departments.find(d => d.id === agent.department_id || d.id === agent.department_id?._id || d.id === agent.department_id?.id)
          return (
            <Card key={agent.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Bot className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {department && (
                          <>
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-medium text-gray-500">
                              {department.name}
                            </span>
                          </>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${
                          agent.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {agent.status || 'active'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                      {agent.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{agent.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Created:</span>
                    <span>{formatDate(agent.created_at)}</span>
                  </div>
                  {agent.updated_at && (
                    <div className="flex items-center justify-between">
                      <span>Updated:</span>
                      <span>{formatDate(agent.updated_at)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(agent)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(agent.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {agents.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No agents found. Create your first agent to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
        </>
      )}
    </div>
  )
}

export default Agents

