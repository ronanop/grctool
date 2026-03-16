import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { userService } from '../../services/userService'
import useAuthStore from '../../store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Upload, CheckCircle2, XCircle, FileText, Shield, ChevronRight, ChevronLeft, Search, BookOpen, AlertCircle, Loader2, Bell, X } from 'lucide-react'
import { PieChart, Pie, Cell, RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts'

const Checklist = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  // Redirect senior users to dashboard
  useEffect(() => {
    const isSenior = user?.is_senior === true || user?.isSenior === true || user?.is_senior === 1
    if (isSenior) {
      navigate('/user/dashboard', { replace: true })
    }
  }, [user, navigate])
  const [isoControls, setISOControls] = useState([])
  const [questions, setQuestions] = useState({}) // { controlId: [questions] }
  const [controlResponses, setControlResponses] = useState({}) // { controlId: 'Yes' | 'No' }
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})
  const [currentControlIndex, setCurrentControlIndex] = useState(0)
  const [ragResults, setRagResults] = useState({}) // { questionId: { found: boolean, document: string, chunk: string } }
  const [ragSearching, setRagSearching] = useState({}) // { questionId: boolean }
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [frameworks, setFrameworks] = useState([])
  const [selectedFrameworkId, setSelectedFrameworkId] = useState(() => {
    // Load from localStorage or default to first framework
    return localStorage.getItem('selectedComplianceFramework') || ''
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm()

  useEffect(() => {
    loadData()
    loadNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [selectedFrameworkId])

  useEffect(() => {
    if (selectedFrameworkId) {
      localStorage.setItem('selectedComplianceFramework', selectedFrameworkId)
      loadData()
    }
  }, [selectedFrameworkId])

  const loadData = async () => {
    try {
      const [controlsData, controlResponsesData, responsesData] = await Promise.all([
        userService.getISOControls(selectedFrameworkId || null),
        userService.getControlResponses(),
        userService.getResponses(),
      ])
      
      // Normalize control IDs (handle both id and _id)
      const normalizedControls = controlsData.map(control => ({
        ...control,
        id: control.id || control._id
      }))
      setISOControls(normalizedControls)
      
      // Map control responses (normalize IDs)
      const controlRespMap = {}
      controlResponsesData.forEach((cr) => {
        const controlId = cr.iso_control_id || cr.iso_control_id?._id || cr.iso_control_id?.id
        controlRespMap[controlId] = cr.status
      })
      setControlResponses(controlRespMap)

      // Load questions for each control
      const questionsMap = {}
      for (const control of normalizedControls) {
        const controlId = control.id || control._id
        const questionsData = await userService.getQuestions(controlId, selectedFrameworkId || null)
        questionsMap[controlId] = questionsData
      }
      setQuestions(questionsMap)
      // Normalize response question_ids to match question IDs
      const normalizedResponses = responsesData.map(r => ({
        ...r,
        question_id: r.question_id || r.question_id?._id || r.question_id?.id
      }))
      setResponses(normalizedResponses)

      // Pre-fill form with existing responses
      responsesData.forEach((response) => {
        setValue(`response_${response.question_id}`, response.status)
      })
      
      // Pre-fill control responses
      controlResponsesData.forEach((cr) => {
        setValue(`control_${cr.iso_control_id}`, cr.status)
      })
    } catch (error) {
      toast.error('Failed to load checklist')
    } finally {
      setLoading(false)
    }
  }


  const getResponseForQuestion = (questionId) => {
    if (!questionId) return null
    // Normalize both IDs for comparison (handle ObjectId strings)
    const normalizedQuestionId = String(questionId)
    return responses.find((r) => {
      const normalizedResponseId = String(r.question_id || r.question_id?._id || r.question_id?.id)
      return normalizedResponseId === normalizedQuestionId
    })
  }

  const handleControlResponse = async (controlId, status) => {
    try {
      // ResponseStatus enum expects "Yes" or "No" (capitalized)
      const statusValue = status === 'Yes' ? 'Yes' : 'No'
      await userService.createControlResponse({
        iso_control_id: controlId,
        status: statusValue
      })
      setControlResponses({ ...controlResponses, [controlId]: statusValue })
      setValue(`control_${controlId}`, statusValue)
      
      // If No, clear all question responses for this control
      if (statusValue === 'No') {
        const controlQuestions = questions[controlId] || []
        controlQuestions.forEach((q) => {
          setValue(`response_${q.id}`, '')
        })
      }
    } catch (error) {
      console.error('Control response error:', error)
      toast.error(error.response?.data?.detail || 'Failed to save control response')
    }
  }

  const handleFileUpload = async (questionId, file) => {
    if (!file) return

    // Ensure questionId is valid first
    if (!questionId || questionId === 'undefined' || questionId === undefined || questionId === null) {
      toast.error('Invalid question ID. Please refresh the page and try again.')
      return
    }

    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 10MB limit. Please choose a smaller file.')
      return
    }

    // Validate file type
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.xls', '.xlsx', '.csv']
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('File type not supported. Please upload PDF, DOC, DOCX, JPG, PNG, TXT, XLS, XLSX, or CSV files.')
      return
    }

    setUploading({ ...uploading, [questionId]: true })
    try {
      // Validate questionId BEFORE upload
      if (!questionId || questionId === 'undefined' || questionId === undefined || questionId === null) {
        toast.error('Invalid question ID. Please refresh the page and try again.')
        setUploading({ ...uploading, [questionId]: false })
        return
      }
      
      // Validate questionId is a valid ObjectId format (24 hex characters)
      const questionIdStr = String(questionId).trim()
      if (!/^[0-9a-fA-F]{24}$/.test(questionIdStr)) {
        console.error('Invalid question ID format:', questionIdStr, 'Original:', questionId)
        toast.error('Invalid question ID format. Please refresh the page and try again.')
        setUploading({ ...uploading, [questionId]: false })
        return
      }
      
      console.log('Uploading file for question:', questionIdStr)
      const uploadResult = await userService.uploadProof(file)
      console.log('File uploaded successfully:', uploadResult)
      
      const response = getResponseForQuestion(questionIdStr)
      console.log('Existing response:', response)
      
      if (response && response.id) {
        console.log('Updating existing response:', response.id)
        await userService.updateResponse(response.id, {
          proof_url: uploadResult.proof_url,
        })
      } else {
        console.log('Creating new response with:', {
          question_id: questionIdStr,
          status: 'Yes',
          proof_url: uploadResult.proof_url,
        })
        // Ensure question_id is a string and status is capitalized
        await userService.createResponse({
          question_id: questionIdStr,
          status: 'Yes',
          proof_url: uploadResult.proof_url,
        })
      }
      
      toast.success('Proof upload successful, sent for approval')
      // Reload responses to get updated data
      const updatedResponses = await userService.getResponses()
      const normalizedResponses = updatedResponses.map(r => ({
        ...r,
        question_id: r.question_id || r.question_id?._id || r.question_id?.id
      }))
      setResponses(normalizedResponses)
    } catch (error) {
      console.error('File upload error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        questionId: questionId
      })
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        toast.error('Network error: Please check if the backend server is running at http://localhost:8000')
      } else if (error.response?.status === 422) {
        toast.error(error.response?.data?.detail || 'Validation error. Please check your input.')
      } else {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to upload file'
        toast.error(errorMessage)
      }
    } finally {
      setUploading({ ...uploading, [questionId]: false })
    }
  }

  const loadNotifications = async () => {
    try {
      const [unreadData, allData] = await Promise.all([
        userService.getUnreadNotificationsCount(),
        userService.getUnreadNotifications()
      ])
      setUnreadCount(unreadData.count || 0)
      setNotifications(allData || [])
      
      // Auto-show notification modal if there are unread notifications
      if (unreadData.count > 0 && !showNotificationModal) {
        // Show the first unread notification
        const firstUnread = allData.find(n => !n.is_read)
        if (firstUnread) {
          setSelectedNotification(firstUnread)
          setShowNotificationModal(true)
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification)
    setShowNotificationModal(true)
    // Mark as read
    if (!notification.is_read) {
      userService.updateNotification(notification.id || notification._id, { is_read: true })
        .then(() => {
          loadNotifications()
        })
        .catch(err => console.error('Error marking notification as read:', err))
    }
  }

  const handleResubmitProof = async (notification) => {
    if (!notification.related_data?.question_id) {
      toast.error('Question ID not found')
      return
    }
    
    setShowNotificationModal(false)
    setSelectedNotification(null)
    
    // Mark notification as read
    if (!notification.is_read) {
      await userService.updateNotification(notification.id || notification._id, { is_read: true })
    }
    
    // Find the question and scroll to it
    const questionId = notification.related_data.question_id
    const questionElement = document.querySelector(`[data-question-id="${questionId}"]`)
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight the question
      questionElement.classList.add('ring-4', 'ring-red-500', 'ring-opacity-50')
      setTimeout(() => {
        questionElement.classList.remove('ring-4', 'ring-red-500', 'ring-opacity-50')
      }, 3000)
      
      // Focus on the file input
      const fileInput = questionElement.querySelector('input[type="file"]')
      if (fileInput) {
        setTimeout(() => {
          fileInput.click()
        }, 500)
      }
    } else {
      toast.info('Please navigate to the question and upload a new proof file')
    }
    
    loadNotifications()
  }

  const onSubmit = async (data) => {
    try {
      // Save control responses
      for (const control of isoControls) {
        const controlStatus = data[`control_${control.id}`]
        if (controlStatus) {
          await userService.createControlResponse({
            iso_control_id: control.id,
            status: controlStatus
          })
        }
      }

      // Save question responses (only for controls where status is Yes)
      for (const control of isoControls) {
        const controlStatus = controlResponses[control.id] || data[`control_${control.id}`]
        if (controlStatus === 'Yes') {
          const controlQuestions = questions[control.id] || []
          for (const question of controlQuestions) {
            const responseKey = `response_${question.id}`
            const status = data[responseKey]

            if (!status) continue

            const existingResponse = getResponseForQuestion(question.id)
            const fileInput = document.getElementById(`file_${question.id}`)
            const file = fileInput?.files[0]

            if (status === 'Yes') {
              if (existingResponse?.proof_url) {
                if (existingResponse.status !== 'Yes') {
                  await userService.updateResponse(existingResponse.id, {
                    status: 'Yes',
                  })
                }
              } else if (file) {
                const uploadResult = await userService.uploadProof(file)
                if (existingResponse) {
                  await userService.updateResponse(existingResponse.id, {
                    status: 'Yes',
                    proof_url: uploadResult.proof_url,
                  })
                } else {
                  await userService.createResponse({
                    question_id: String(question.id),
                    status: 'Yes',
                    proof_url: uploadResult.proof_url,
                  })
                }
              } else if (!existingResponse) {
                toast.error(`Please upload a proof file for: ${question.text}`)
                return
              }
            } else {
              if (existingResponse) {
                await userService.updateResponse(existingResponse.id, {
                  status: 'No',
                  proof_url: null,
                })
              } else {
                await userService.createResponse({
                  question_id: String(question.id),
                  status: 'No',
                })
              }
            }
          }
        }
      }

      toast.success('Responses saved successfully!')
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save responses')
    }
  }

  const currentControl = isoControls[currentControlIndex]
  const currentControlQuestions = currentControl ? (questions[currentControl.id] || []) : []
  const isControlFollowed = currentControl ? (controlResponses[currentControl.id] === 'Yes') : false

  // Auto-search RAG when control changes or questions load
  useEffect(() => {
    if (loading || !user?.department_id || !currentControl) return
    
    const controlId = `control_${currentControl.id}`
    
    // Auto-search for control immediately when displayed
    if (!ragResults[controlId] && !ragSearching[controlId]) {
      searchRAGForControl(currentControl)
    }

    // Auto-search for all sub-questions when control is displayed
    if (currentControlQuestions.length > 0) {
      currentControlQuestions.forEach((question) => {
        if (question && !ragResults[question.id] && !ragSearching[question.id]) {
          searchRAGForQuestion(question)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentControlIndex, currentControl, currentControlQuestions.length, loading])

  // RAG search uses Pinecone only (backend /api/v1/rag/documents/search). Answers must come from documents only.
  const MAX_DISTANCE_FOR_FOLLOWED = 0.5 // Only mark "followed" if policy chunk is highly relevant (distance < 0.5)
  const RAG_N_RESULTS = 15 // Request more results so policy wording variations (e.g. "background check" for screening) still match

  // Expand control search query with topic synonyms so policy text (e.g. "background screening") matches
  const expandControlSearchQuery = (control) => {
    const base = `${control.control_id || ''} ${control.control_name || ''}`.trim() || 'screening policy procedure'
    const name = (control.control_name || '').toLowerCase()
    const id = (control.control_id || '').toLowerCase()
    if (name.includes('screening') || id.includes('7.1.1') || base.toLowerCase().includes('screening')) {
      return `${base} screening background check pre-employment verification employment policy procedure`
    }
    return `${base} policy procedure implementation`
  }

  const searchRAGForControl = async (control) => {
    if (!control) return
    
    if (!user?.department_id) {
      const controlId = `control_${control.id}`
      setRagResults({
        ...ragResults,
        [controlId]: {
          found: false,
          document: null,
          chunk: null,
          error: 'No department assigned'
        }
      })
      return
    }

    const controlId = `control_${control.id}`
    setRagSearching(prev => ({ ...prev, [controlId]: true }))

    try {
      const searchQuery = expandControlSearchQuery(control)
      
      const results = await userService.searchRAGDocuments(
        searchQuery,
        user.department_id,
        RAG_N_RESULTS
      )

      const positiveKeywords = [
        'yes', 'implemented', 'followed', 'compliant', 'established', 
        'in place', 'active', 'enforced', 'policy', 'procedure', 'screening'
      ]
      const negativeKeywords = [
        'no', 'not', 'missing', 'absent', 'non-compliant', 'violation', 'breach'
      ]

      let bestMatch = null
      let foundPositiveForAutoMark = false
      let bestScore = 0

      // If Pinecone returned any results, we found relevant text in policy documents
      if (results && results.results && results.results.length > 0) {
        // Best match = lowest distance (most relevant)
        const sorted = [...results.results].sort((a, b) => (a.distance ?? 1) - (b.distance ?? 1))
        const top = sorted[0]
        bestMatch = {
          document: top.metadata?.document_name || 'Policy Document',
          chunk: top.text,
          distance: top.distance
        }

        // Auto-mark "Yes" only when highly relevant and positive language in chunk
        for (const result of results.results) {
          const text = result.text?.toLowerCase() || ''
          const distance = result.distance ?? 1.0
          if (distance >= MAX_DISTANCE_FOR_FOLLOWED) continue
          const positiveCount = positiveKeywords.filter(kw => text.includes(kw)).length
          const negativeCount = negativeKeywords.filter(kw => text.includes(kw)).length
          if (positiveCount > negativeCount && positiveCount > 0) {
            const score = (positiveCount - negativeCount) * (1 - distance)
            if (score > bestScore) {
              bestScore = score
              foundPositiveForAutoMark = true
            }
          }
        }
      }

      const foundRelevantText = bestMatch != null

      setRagResults(prev => ({
        ...prev,
        [controlId]: {
          found: foundRelevantText,
          document: bestMatch?.document || null,
          chunk: bestMatch?.chunk || null,
          distance: bestMatch?.distance || null
        }
      }))

      if (foundRelevantText) {
        toast.success(`Sanchalan AI Found that your policy covers this control, please continue submitting artefacts for the same: ${bestMatch.document}`, { duration: 4000 })
      }

      // Auto-select "Yes" only when we're confident the policy states the control is followed
      if (foundPositiveForAutoMark && bestMatch && !watch(`control_${control.id}`)) {
        setValue(`control_${control.id}`, 'Yes')
        handleControlResponse(control.id, 'Yes')
      }
    } catch (error) {
      console.error('RAG search error for control:', error)
      const errorMessage = error.code === 'ECONNABORTED' 
        ? 'Search timed out. Please try again.' 
        : error.response?.data?.detail || error.message || 'Search failed'
      
      setRagResults(prev => ({
        ...prev,
        [controlId]: {
          found: false,
          document: null,
          chunk: null,
          error: errorMessage
        }
      }))
    } finally {
      setRagSearching(prev => ({ ...prev, [controlId]: false }))
    }
  }

  const searchRAGForQuestion = async (question) => {
    if (!question) return
    
    if (!user?.department_id) {
      setRagResults(prev => ({
        ...prev,
        [question.id]: {
          found: false,
          document: null,
          chunk: null,
          error: 'No department assigned'
        }
      }))
      return
    }

    const questionId = question.id
    setRagSearching(prev => ({ ...prev, [questionId]: true }))

    try {
      // Build search query from question text and control name; expand with topic keywords for better match
      let searchQuery = `${currentControl?.control_name || ''} ${question.text}`.trim()
      const name = (currentControl?.control_name || '').toLowerCase()
      if (name.includes('screening') || (question.text || '').toLowerCase().includes('screening')) {
        searchQuery = `${searchQuery} screening background check pre-employment verification policy procedure`
      } else {
        searchQuery = `${searchQuery} policy procedure`
      }
      
      const results = await userService.searchRAGDocuments(
        searchQuery,
        user.department_id,
        RAG_N_RESULTS
      )

      const positiveKeywords = [
        'yes', 'implemented', 'followed', 'compliant', 'established', 
        'in place', 'active', 'enforced', 'policy', 'procedure'
      ]
      const negativeKeywords = [
        'no', 'not', 'missing', 'absent', 'non-compliant', 'violation', 'breach'
      ]

      let bestMatch = null
      let foundPositiveForAutoMark = false
      let bestScore = 0

      // If Pinecone returned any results, we found relevant text in policy documents
      if (results && results.results && results.results.length > 0) {
        const sorted = [...results.results].sort((a, b) => (a.distance ?? 1) - (b.distance ?? 1))
        const top = sorted[0]
        bestMatch = {
          document: top.metadata?.document_name || 'Policy Document',
          chunk: top.text,
          distance: top.distance
        }

        for (const result of results.results) {
          const text = result.text?.toLowerCase() || ''
          const distance = result.distance ?? 1.0
          if (distance >= MAX_DISTANCE_FOR_FOLLOWED) continue
          const positiveCount = positiveKeywords.filter(kw => text.includes(kw)).length
          const negativeCount = negativeKeywords.filter(kw => text.includes(kw)).length
          if (positiveCount > negativeCount && positiveCount > 0) {
            const score = (positiveCount - negativeCount) * (1 - distance)
            if (score > bestScore) {
              bestScore = score
              foundPositiveForAutoMark = true
            }
          }
        }
      }

      const foundRelevantText = bestMatch != null

      setRagResults(prev => ({
        ...prev,
        [questionId]: {
          found: foundRelevantText,
          document: bestMatch?.document || null,
          chunk: bestMatch?.chunk || null,
          distance: bestMatch?.distance || null
        }
      }))

      if (foundRelevantText) {
        toast.success(`Sanchalan AI Found that your policy covers this control, please continue submitting artefacts for the same: ${bestMatch.document}`, { duration: 4000 })
      }

      // Auto-select "Yes" and persist only when we're confident the policy states the answer
      if (foundPositiveForAutoMark && bestMatch && !watch(`response_${questionId}`)) {
        setValue(`response_${questionId}`, 'Yes')
        const existingResponse = getResponseForQuestion(questionId)
        try {
          if (existingResponse?.id) {
            await userService.updateResponse(existingResponse.id, { status: 'Yes' })
            setResponses(prev => prev.map(r => String(r.question_id || r.question_id?._id) === String(questionId) ? { ...r, status: 'Yes' } : r))
          } else {
            const created = await userService.createResponse({
              question_id: String(questionId),
              status: 'Yes',
            })
            setResponses(prev => {
              const without = prev.filter(r => String(r.question_id || r.question_id?._id) !== String(questionId))
              return [...without, { ...created, question_id: questionId }]
            })
          }
        } catch (err) {
          console.error('Failed to persist RAG auto-response:', err)
        }
      }
    } catch (error) {
      console.error('RAG search error:', error)
      const errorMessage = error.code === 'ECONNABORTED' 
        ? 'Search timed out. Please try again.' 
        : error.response?.data?.detail || error.message || 'Search failed'
      
      // Don't show error toast, just mark as not found
      setRagResults(prev => ({
        ...prev,
        [questionId]: {
          found: false,
          document: null,
          chunk: null,
          error: errorMessage
        }
      }))
    } finally {
      setRagSearching(prev => ({ ...prev, [questionId]: false }))
    }
  }

  const totalControls = isoControls.length
  const answeredControls = Object.keys(controlResponses).length
  const progressPercentage = totalControls > 0 ? (answeredControls / totalControls) * 100 : 0

  const goToNextControl = () => {
    if (currentControlIndex < isoControls.length - 1) {
      setCurrentControlIndex(currentControlIndex + 1)
    }
  }

  const goToPreviousControl = () => {
    if (currentControlIndex > 0) {
      setCurrentControlIndex(currentControlIndex - 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading checklist...</p>
        </div>
      </div>
    )
  }

  if (isoControls.length === 0) {
    return (
      <div className="space-y-6">
        <div className="page-hero">
          <div className="absolute inset-0 data-grid-pattern opacity-50" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">assignment</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Compliance Checklist</h1>
              <p className="text-slate-400 text-sm mt-1">No controls assigned yet</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 dark:text-slate-400">No ISO controls assigned to your department yet.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header – login-inspired */}
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">assignment</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Compliance Checklist</h1>
              <p className="text-sm text-slate-400 mt-1">
                Review each control and answer the questions if the control is being followed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {frameworks.length > 0 && (
              <select
                value={selectedFrameworkId}
                onChange={(e) => {
                  setSelectedFrameworkId(e.target.value)
                  localStorage.setItem('selectedComplianceFramework', e.target.value)
                }}
                className="px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none max-w-[200px]"
              >
                <option value="" className="text-slate-900">Select framework</option>
                {frameworks.map((framework) => (
                  <option key={framework.id || framework._id} value={framework.id || framework._id} className="text-slate-900">
                    {framework.name} {framework.version ? `(${framework.version})` : ''}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => {
                if (unreadCount > 0) {
                  const firstUnread = notifications.find(n => !n.is_read)
                  if (firstUnread) handleNotificationClick(firstUnread)
                  else setShowNotificationModal(true)
                } else {
                  setShowNotificationModal(true)
                }
              }}
              className="relative p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-600 dark:text-slate-400">Progress</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              Control {currentControlIndex + 1} of {totalControls} • {answeredControls} answered
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-700 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">
            {progressPercentage.toFixed(0)}% Complete
          </p>
        </CardContent>
      </Card>

      {/* User progress charts */}
      {totalControls > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Your completion gauge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="55%" outerRadius="95%" data={[{ name: 'Controls', value: progressPercentage, fill: '#2563eb' }]} startAngle={180} endAngle={0}>
                    <RadialBar background dataKey="value" cornerRadius={6} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(0)}%`, 'Complete']} contentStyle={{ borderRadius: 8 }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <p className="text-center text-lg font-bold text-slate-900 dark:text-white -mt-10">{progressPercentage.toFixed(0)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Controls: answered vs remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Answered', value: answeredControls, color: '#10b981' },
                        { name: 'Remaining', value: Math.max(0, totalControls - answeredControls), color: '#94a3b8' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => (percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : '')}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#94a3b8" />
                    </Pie>
                    <Tooltip formatter={(value) => [value, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {currentControl && (
          <>
            {/* Control Level Question */}
            <Card className="border-2 border-blue-300 shadow-xl animate-slide-in-up">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">
                    {currentControl.control_id} - {currentControl.control_name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-medium text-gray-900 mb-4">
                      Is this control being followed in your department?
                    </p>

                    {/* RAG Search Status for Control */}
                    {(() => {
                      const controlId = `control_${currentControl.id}`
                      const controlRagResult = ragResults[controlId]
                      const isControlSearching = ragSearching[controlId]
                      const hasControlRAGAnswer = controlRagResult?.found === true

                      return (
                        <>
                          {isControlSearching && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
                              <Search className="w-4 h-4 animate-pulse" />
                              <span>Searching policy documents...</span>
                              <span className="text-xs text-gray-500">(This may take a few seconds)</span>
                            </div>
                          )}

                          {/* Policy coverage found (from Pinecone) */}
                          {!isControlSearching && hasControlRAGAnswer && (
                            <div className="bg-green-50 border-2 border-green-300 p-4 rounded-md mb-4">
                              <div className="flex items-start gap-2 mb-2">
                                <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-green-800 mb-1">
                                    Sanchalan AI Found that your policy covers this control, please continue submitting artefacts for the same
                                  </p>
                                  <p className="text-xs text-green-700 mb-1">
                                    Reference: <span className="font-medium">{controlRagResult.document}</span>
                                  </p>
                                  {controlRagResult.chunk && (
                                    <p className="text-xs text-green-800 mt-2 p-2 bg-green-100 rounded border border-green-200 max-h-24 overflow-y-auto">
                                      {controlRagResult.chunk.length > 300 ? `${controlRagResult.chunk.slice(0, 300)}...` : controlRagResult.chunk}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No RAG Answer Found for Control */}
                          {!isControlSearching && controlRagResult && !hasControlRAGAnswer && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-md mb-4">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-800">
                                  <span className="font-semibold">No answer found in policy.</span> Please fill manually.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Search Status for Control */}
                          {isControlSearching && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800 mb-4">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Searching in policy documents...</span>
                            </div>
                          )}
                          {/* Manual Re-search Button for Control */}
                          {!isControlSearching && (
                            <button
                              type="button"
                              onClick={() => searchRAGForControl(currentControl)}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-800 transition-colors mb-4"
                            >
                              <Search className="w-4 h-4" />
                              <span>Re-search in policy documents</span>
                            </button>
                          )}
                        </>
                      )
                    })()}

                    <div className="flex gap-4">
                      <label className={`flex items-center cursor-pointer transition-all duration-300 rounded-xl p-4 border-2 ${(() => {
                        const controlId = `control_${currentControl.id}`
                        const hasControlRAGAnswer = ragResults[controlId]?.found === true
                        return hasControlRAGAnswer 
                          ? 'ring-2 ring-green-500 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg scale-105' 
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50 hover:scale-105'
                      })()}`}>
                        <input
                          type="radio"
                          value="Yes"
                          {...register(`control_${currentControl.id}`, { required: true })}
                          onChange={(e) => {
                            handleControlResponse(currentControl.id, 'Yes')
                          }}
                          className="mr-3 w-5 h-5 text-green-600 focus:ring-green-500"
                        />
                        <span className={`flex items-center text-lg font-semibold ${(() => {
                          const controlId = `control_${currentControl.id}`
                          const hasControlRAGAnswer = ragResults[controlId]?.found === true
                          return hasControlRAGAnswer ? 'text-green-700' : 'text-green-600'
                        })()}`}>
                          <CheckCircle2 className="w-6 h-6 mr-2" />
                          Yes
                          {(() => {
                            const controlId = `control_${currentControl.id}`
                            const hasControlRAGAnswer = ragResults[controlId]?.found === true
                            return hasControlRAGAnswer && (
                              <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded-full font-bold">
                                AI Detected
                              </span>
                            )
                          })()}
                        </span>
                      </label>
                      <label className="flex items-center cursor-pointer transition-all duration-300 rounded-xl p-4 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/50 hover:scale-105">
                        <input
                          type="radio"
                          value="No"
                          {...register(`control_${currentControl.id}`, { required: true })}
                          onChange={(e) => {
                            handleControlResponse(currentControl.id, 'No')
                          }}
                          className="mr-3 w-5 h-5 text-red-600 focus:ring-red-500"
                        />
                        <span className="flex items-center text-lg font-semibold text-red-600">
                          <XCircle className="w-6 h-6 mr-2" />
                          No
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Questions (only shown if control is being followed) */}
            {isControlFollowed && currentControlQuestions.length > 0 && (
              <div className="space-y-6 mt-6">
                <h2 className="text-2xl font-bold gradient-text">
                  Questions for {currentControl.control_id}
                </h2>
                {currentControlQuestions.map((question, qIndex) => {
                  const response = getResponseForQuestion(question.id)
                  const responseValue = watch(`response_${question.id}`) || response?.status || ''
                  const showFileUpload = responseValue === 'Yes'
                  const ragResult = ragResults[question.id]
                  const isSearching = ragSearching[question.id]
                  const hasRAGAnswer = ragResult?.found === true

                  return (
                    <Card 
                      key={question.id} 
                      hover={true} 
                      className="animate-slide-in-up" 
                      style={{ animationDelay: `${qIndex * 0.1}s` }}
                      data-question-id={question.id}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div>
                            {question.question_id && (
                              <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded mr-2">
                                {currentControl.control_id}.{question.question_id}
                              </span>
                            )}
                            <p className="text-gray-900 font-medium inline">{question.text}</p>
                          </div>

                          {/* RAG Search Status */}
                          {isSearching && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                              <Search className="w-4 h-4 animate-pulse" />
                              <span>Searching policy documents...</span>
                              <span className="text-xs text-gray-500">(This may take a few seconds)</span>
                            </div>
                          )}

                          {/* Search Status */}
                          {isSearching && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Searching in policy documents...</span>
                            </div>
                          )}
                          {/* Manual Re-search Button */}
                          {!isSearching && (
                            <button
                              type="button"
                              onClick={() => searchRAGForQuestion(question)}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                              <Search className="w-4 h-4" />
                              <span>Re-search in policy documents</span>
                            </button>
                          )}

                          {/* Policy coverage found (from Pinecone) */}
                          {!isSearching && hasRAGAnswer && (
                            <div className="bg-green-50 border-2 border-green-300 p-4 rounded-md">
                              <div className="flex items-start gap-2 mb-2">
                                <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-green-800 mb-1">
                                    Sanchalan AI Found that your policy covers this control, please continue submitting artefacts for the same
                                  </p>
                                  <p className="text-xs text-green-700 mb-1">
                                    Reference: <span className="font-medium">{ragResult.document}</span>
                                  </p>
                                  {ragResult.chunk && (
                                    <p className="text-xs text-green-800 mt-2 p-2 bg-green-100 rounded border border-green-200 max-h-24 overflow-y-auto">
                                      {ragResult.chunk.length > 300 ? `${ragResult.chunk.slice(0, 300)}...` : ragResult.chunk}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No RAG Answer Found */}
                          {!isSearching && ragResult && !hasRAGAnswer && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-md">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-800">
                                  <span className="font-semibold">No answer found in policy.</span> Please fill manually.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-4">
                            <label className={`flex items-center cursor-pointer transition-all duration-300 rounded-xl p-4 border-2 ${hasRAGAnswer 
                              ? 'ring-2 ring-green-500 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg scale-105' 
                              : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50 hover:scale-105'
                            }`}>
                              <input
                                type="radio"
                                value="Yes"
                                {...register(`response_${question.id}`, { required: isControlFollowed })}
                                className="mr-3 w-5 h-5 text-green-600 focus:ring-green-500"
                              />
                              <span className={`flex items-center text-lg font-semibold ${hasRAGAnswer ? 'text-green-700' : 'text-green-600'}`}>
                                <CheckCircle2 className="w-6 h-6 mr-2" />
                                Yes
                                {hasRAGAnswer && (
                                  <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded-full font-bold">
                                    AI Detected
                                  </span>
                                )}
                              </span>
                            </label>
                            <label className="flex items-center cursor-pointer transition-all duration-300 rounded-xl p-4 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/50 hover:scale-105">
                              <input
                                type="radio"
                                value="No"
                                {...register(`response_${question.id}`, { required: isControlFollowed })}
                                className="mr-3 w-5 h-5 text-red-600 focus:ring-red-500"
                              />
                              <span className="flex items-center text-lg font-semibold text-red-600">
                                <XCircle className="w-6 h-6 mr-2" />
                                No
                              </span>
                            </label>
                          </div>

                          {showFileUpload && (
                            <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-md animate-scale-in">
                              <label className="block text-sm font-bold text-gray-700 mb-3">
                                Upload Proof File <span className="text-red-500">*</span>
                              </label>
                              <div className="flex items-center gap-4">
                                <input
                                  id={`file_${question.id}`}
                                  type="file"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.xls,.xlsx,.csv"
                                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  onChange={(e) => {
                                    if (e.target.files[0]) {
                                      // Ensure question.id is valid before calling handleFileUpload
                                      if (question.id && question.id !== 'undefined' && question.id !== undefined) {
                                        handleFileUpload(question.id, e.target.files[0])
                                      } else {
                                        console.error('Invalid question ID in file input:', question)
                                        toast.error('Invalid question. Please refresh the page.')
                                      }
                                    }
                                  }}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Accepted formats: PDF, DOC, DOCX, JPG, PNG, TXT, XLS, XLSX, CSV (Max 10MB)
                                </p>
                                {response?.proof_url && (
                                  <span className="text-sm text-green-600 flex items-center">
                                    <FileText className="w-4 h-4 mr-1" />
                                    Proof uploaded
                                  </span>
                                )}
                              </div>
                              {uploading[question.id] && (
                                <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {isControlFollowed && currentControlQuestions.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500">No questions available for this control yet.</p>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6 gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousControl}
                disabled={currentControlIndex === 0}
                size="lg"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Previous
              </Button>
              
              {currentControlIndex < isoControls.length - 1 ? (
                <Button
                  type="button"
                  onClick={goToNextControl}
                  size="lg"
                >
                  Next
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button type="submit" size="lg" variant="success">
                  Save All Responses
                </Button>
              )}
            </div>
          </>
        )}
      </form>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Bell className="w-6 h-6" />
                  Notifications
                </CardTitle>
                <button
                  onClick={() => {
                    setShowNotificationModal(false)
                    setSelectedNotification(null)
                  }}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {selectedNotification ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
                          {selectedNotification.title}
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                          {selectedNotification.message}
                        </p>
                        {selectedNotification.related_data?.question_text && (
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Question:</p>
                            <p className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-3 rounded border">
                              {selectedNotification.related_data.question_text}
                            </p>
                          </div>
                        )}
                        {selectedNotification.related_data?.rejection_comments && (
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Rejection Comments:</p>
                            <p className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-3 rounded border">
                              {selectedNotification.related_data.rejection_comments}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={() => {
                        setShowNotificationModal(false)
                        setSelectedNotification(null)
                      }}
                      className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => handleResubmitProof(selectedNotification)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Resubmit Proof
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id || notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          notification.is_read
                            ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {notification.type === 'proof_rejected' && (
                            <XCircle className={`w-5 h-5 flex-shrink-0 mt-1 ${notification.is_read ? 'text-gray-400' : 'text-red-600 dark:text-red-400'}`} />
                          )}
                          <div className="flex-1">
                            <h4 className={`font-bold mb-1 ${notification.is_read ? 'text-gray-600' : 'text-red-900 dark:text-red-100'}`}>
                              {notification.title}
                              {!notification.is_read && (
                                <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block"></span>
                              )}
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">No notifications</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Checklist
