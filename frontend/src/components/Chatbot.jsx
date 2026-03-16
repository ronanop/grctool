import { useState, useRef, useEffect } from 'react'
import { chatService } from '../services/chatService'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'

const CHAT_STORAGE_KEY_PREFIX = 'chat_session_'
const MAX_STORED_MESSAGES = 100

const getStorageKey = (user) => {
  if (!user) return null
  const id = user.id ?? user.username ?? user._id
  return id ? `${CHAT_STORAGE_KEY_PREFIX}${id}` : null
}

const loadMessagesFromStorage = (user) => {
  const key = getStorageKey(user)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_MESSAGES) : []
  } catch {
    return []
  }
}

const saveMessagesToStorage = (user, messages) => {
  const key = getStorageKey(user)
  if (!key || !Array.isArray(messages)) return
  try {
    const toStore = messages.slice(-MAX_STORED_MESSAGES).map((m) => ({ role: m.role, content: m.content }))
    localStorage.setItem(key, JSON.stringify(toStore))
  } catch (_) {}
}

const clearChatStorage = (user) => {
  const key = getStorageKey(user)
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch (_) {}
}

const Chatbot = ({ title = 'Assistant' }) => {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedDoc, setAttachedDoc] = useState(null)   // { name, text } or null
  const [attachedImage, setAttachedImage] = useState(null) // { name, base64, mime } or null
  const [recording, setRecording] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const recognitionRef = useRef(null)

  // Load session messages for current user on mount / user change
  useEffect(() => {
    setMessages(loadMessagesFromStorage(user))
  }, [user?.id, user?.username, user?._id])

  // Persist messages to session storage whenever they change
  useEffect(() => {
    if (messages.length > 0) saveMessagesToStorage(user, messages)
  }, [messages, user])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleClearChat = () => {
    if (messages.length === 0) return
    if (!window.confirm('Clear chat and start a new session? This cannot be undone.')) return
    setMessages([])
    clearChatStorage(user)
    toast.success('Chat cleared')
  }

  const handleSend = async () => {
    let text = input.trim()
    if (attachedDoc?.text) text = text ? `${text}\n\n[Document: ${attachedDoc.name}]\n${attachedDoc.text}` : `[Document: ${attachedDoc.name}]\n${attachedDoc.text}`
    if (!text && !attachedImage) return
    if (loading) return
    const imageToSend = attachedImage ? { ...attachedImage } : null
    setInput('')
    setAttachedDoc(null)
    setAttachedImage(null)
    const displayContent = text || (imageToSend ? `[Image: ${imageToSend.name}]` : '')
    const userMsg = { role: 'user', content: displayContent, image: imageToSend ? { name: imageToSend.name } : null }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const payload = {
        message: text || (imageToSend ? 'What do you see in this image?' : ''),
        messages: [...history, { role: 'user', content: displayContent }],
      }
      if (imageToSend?.base64) payload.image_base64 = imageToSend.base64
      const { reply } = await chatService.sendMessageWithOptions(payload)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to get reply'
      toast.error(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDocumentSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      if (text.trim()) {
        setAttachedDoc({ name: file.name, text: text.slice(0, 30000) })
        toast.success(`Attached: ${file.name}`)
      } else {
        toast.error('Could not read document as text. Try a .txt file.')
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const attachImageFile = (file, sourceLabel = 'Image') => {
    if (!file || !file.type.startsWith('image/')) return false
    const displayName = file.name?.trim() || (sourceLabel === 'pasted image' ? 'Pasted image' : 'pasted-image.png')
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      setAttachedImage({ name: displayName, base64, mime: file.type })
      toast.success(sourceLabel === 'pasted image' ? 'Image pasted — add a question and send' : `Attached: ${displayName}`)
    }
    reader.readAsDataURL(file)
    return true
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, etc.)')
      return
    }
    attachImageFile(file, 'image')
    e.target.value = ''
  }

  const handlePaste = (e) => {
    const clipboardData = e.clipboardData
    if (!clipboardData) return
    const items = clipboardData.items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file && attachImageFile(file, 'pasted image')) return
        break
      }
    }
    const files = clipboardData.files
    if (files?.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          e.preventDefault()
          if (attachImageFile(files[i], 'pasted image')) return
          break
        }
      }
    }
  }

  const toggleVoice = () => {
    if (recording) {
      try {
        if (recognitionRef.current) recognitionRef.current.stop()
      } catch (_) {}
      setRecording(false)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = () => {
      setRecording(false)
      toast.error('Voice recognition failed')
    }
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  const canSend = (input.trim() || attachedDoc || attachedImage) && !loading

  return (
    <>
      {/* Floating button - bottom right */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-600 text-white shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-300"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <span className="material-icons-outlined text-3xl">chat</span>
      </button>

      {/* Chat panel - slide up + fade */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl dark:border-slate-700"
          style={{ animation: 'chatPanelIn 0.3s ease-out' }}
        >
          <style>{`
            @keyframes chatPanelIn {
              from { opacity: 0; transform: translateY(12px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes messageIn {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulseDot {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-3 dark:border-slate-700">
            <span className="flex items-center gap-2 font-semibold text-white drop-shadow-sm">
              <span className="material-icons-outlined text-2xl">smart_toy</span>
              {title}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                disabled={messages.length === 0}
                className="rounded-xl p-2 text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Clear chat and start new session"
                aria-label="Clear chat"
              >
                <span className="material-icons-outlined">delete_sweep</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Close"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center" style={{ animation: 'messageIn 0.4s ease-out' }}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-3">
                  <span className="material-icons-outlined text-3xl text-indigo-600 dark:text-indigo-400">forum</span>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Ask me anything</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">About your policies, compliance, or documents</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Use the toolbar to attach a document, image, or use voice.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'messageIn 0.25s ease-out' }}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white dark:bg-slate-800 px-4 py-3 border border-slate-200/80 dark:border-slate-700 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Getting response… This may take a few seconds when searching your documents.</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachments preview */}
          {(attachedDoc || attachedImage) && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 flex flex-wrap gap-2 items-center">
              {attachedDoc && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 text-xs font-medium">
                  <span className="material-icons-outlined text-sm">description</span>
                  {attachedDoc.name}
                  <button type="button" onClick={() => setAttachedDoc(null)} className="hover:opacity-80">
                    <span className="material-icons-outlined text-sm">close</span>
                  </button>
                </span>
              )}
              {attachedImage && (
                <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 text-xs font-medium">
                  {attachedImage.base64 && (
                    <img
                      src={`data:${attachedImage.mime || 'image/png'};base64,${attachedImage.base64}`}
                      alt="Attached"
                      className="h-8 w-auto max-w-[80px] rounded object-cover border border-violet-200 dark:border-violet-700"
                    />
                  )}
                  <span className="truncate max-w-[120px]">{attachedImage.name}</span>
                  <button type="button" onClick={() => setAttachedImage(null)} className="hover:opacity-80 shrink-0" title="Remove image">
                    <span className="material-icons-outlined text-sm">close</span>
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Toolbar + Input */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            <div className="flex gap-1.5 mb-2">
              <input type="file" ref={fileInputRef} accept=".txt,.csv,.json" className="hidden" onChange={handleDocumentSelect} />
              <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors"
                title="Attach document (.txt)"
              >
                <span className="material-icons-outlined text-xl">attach_file</span>
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-800 dark:hover:text-violet-400 transition-colors"
                title="Attach image"
              >
                <span className="material-icons-outlined text-xl">image</span>
              </button>
              <button
                type="button"
                onClick={toggleVoice}
                className={`p-2.5 rounded-xl transition-colors ${recording ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400'}`}
                title="Voice input"
              >
                <span className="material-icons-outlined text-xl">{recording ? 'mic' : 'mic_none'}</span>
              </button>
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Type a message or paste a screenshot (Ctrl+V / Cmd+V)..."
                className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500 transition-shadow"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200"
              >
                <span className="material-icons-outlined">send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Chatbot
