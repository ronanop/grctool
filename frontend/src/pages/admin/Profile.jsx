import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { authService } from '../../services/authService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { User, Shield, Building2, Mail, Calendar, ArrowLeft, Key, Save, Settings, Bell, Globe, Database, Clock, Palette } from 'lucide-react'
import toast from 'react-hot-toast'
import { applyDarkMode } from '../../lib/darkMode'

const Profile = () => {
  const navigate = useNavigate()
  const { user, setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [userDetails, setUserDetails] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [appSettings, setAppSettings] = useState({
    emailNotifications: true,
    systemAlerts: true,
    autoSave: true,
    darkMode: false,
    language: 'en',
    timezone: 'UTC',
    dataRetention: '90',
    sessionTimeout: '30',
    globalDateTime: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
    useGlobalDateTime: false
  })
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    loadUserDetails()
  }, [])

  const loadUserDetails = async () => {
    try {
      const data = await authService.getCurrentUser()
      setUserDetails(data)
    } catch (error) {
      toast.error('Failed to load user details')
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      // Note: This would require a backend endpoint to change password
      // For now, we'll just show a message
      toast.success('Password change functionality requires backend implementation')
      setShowChangePassword(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleSettingChange = (key, value) => {
    setAppSettings(prev => {
      const newSettings = {
        ...prev,
        [key]: value
      }
      
      // Apply dark mode immediately when toggled
      if (key === 'darkMode') {
        applyDarkMode(value)
      }
      
      return newSettings
    })
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      // Save settings to localStorage (or API in production)
      localStorage.setItem('appSettings', JSON.stringify(appSettings))
      
      // Ensure dark mode is applied
      applyDarkMode(appSettings.darkMode)
      
      toast.success('Application settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        setAppSettings(settings)
        // Apply dark mode if it was enabled
        if (settings.darkMode) {
          applyDarkMode(true)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
  }, [])

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-4 animate-slide-in-down">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight mb-2">Admin Profile</h1>
          <p className="text-lg text-gray-600 font-medium">
            View and manage your account information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2 animate-slide-in-up shadow-xl">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {user?.username?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {userDetails?.username || user?.username || 'Admin'}
                </h2>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="text-lg font-semibold text-gray-700 capitalize">
                    {userDetails?.role || user?.role || 'Admin'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Username</p>
                  <p className="text-base font-semibold text-gray-900">
                    {userDetails?.username || user?.username || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Role</p>
                  <p className="text-base font-semibold text-gray-900 capitalize">
                    {userDetails?.role || user?.role || 'Admin'}
                  </p>
                </div>
              </div>

              {userDetails?.department_id && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">Department</p>
                    <p className="text-base font-semibold text-gray-900">
                      {userDetails?.department_name || 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {userDetails?.created_at && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">Member Since</p>
                    <p className="text-base font-semibold text-gray-900">
                      {formatDate(userDetails.created_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="animate-slide-in-up shadow-xl" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Password</p>
                  <p className="text-sm text-gray-600">Last changed: Recently</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowChangePassword(!showChangePassword)}
              >
                {showChangePassword ? 'Cancel' : 'Change Password'}
              </Button>
            </div>

            {showChangePassword && (
              <form onSubmit={handlePasswordChange} className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-scale-in">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Statistics */}
      <Card className="animate-slide-in-up shadow-xl" style={{ animationDelay: '0.2s' }}>
        <CardHeader>
          <CardTitle>Account Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Account Status</p>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">Active</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Access Level</p>
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">Full Access</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Last Login</p>
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">Today</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application Settings */}
      <Card className="animate-slide-in-up shadow-xl" style={{ animationDelay: '0.3s' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Application Settings</CardTitle>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notifications Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Email Notifications</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appSettings.emailNotifications}
                      onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Receive email alerts for important updates</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">System Alerts</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appSettings.systemAlerts}
                      onChange={(e) => handleSettingChange('systemAlerts', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Show in-app notifications and alerts</p>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Palette className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Preferences</h3>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Dark Mode</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appSettings.darkMode}
                      onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Enable dark theme for the application</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Auto-Save</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appSettings.autoSave}
                      onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Automatically save form data as you type</p>
              </div>
            </div>

            {/* System Settings Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">System Settings</h3>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={appSettings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Application Date & Time
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appSettings.useGlobalDateTime}
                      onChange={(e) => handleSettingChange('useGlobalDateTime', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Enable to set a global date and time for the entire application
                </p>
                
                {appSettings.useGlobalDateTime && (
                  <div className="space-y-4 animate-scale-in">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Timezone
                      </label>
                      <select
                        value={appSettings.timezone}
                        onChange={(e) => handleSettingChange('timezone', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                      >
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                        <option value="Asia/Dubai">Dubai (GST)</option>
                        <option value="Asia/Kolkata">Mumbai (IST)</option>
                        <option value="Australia/Sydney">Sydney (AEST)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Set Global Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={appSettings.globalDateTime}
                        onChange={(e) => handleSettingChange('globalDateTime', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        This date and time will be used as the reference for the entire application
                      </p>
                    </div>

                    <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-900 mb-1">Current Application Time:</p>
                          <p className="text-sm font-bold text-blue-800">
                            {appSettings.globalDateTime 
                              ? new Date(appSettings.globalDateTime).toLocaleString('en-US', {
                                  timeZone: appSettings.timezone,
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  timeZoneName: 'short'
                                })
                              : 'Not set'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date()
                          const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                          handleSettingChange('globalDateTime', localDateTime)
                          toast.success('Date and time set to current time')
                        }}
                        className="flex-1"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Use Current Time
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleSettingChange('useGlobalDateTime', false)
                          toast.info('Global date/time disabled')
                        }}
                        className="flex-1"
                      >
                        Disable
                      </Button>
                    </div>
                  </div>
                )}

                {!appSettings.useGlobalDateTime && (
                  <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                    <p className="text-xs text-gray-600 text-center">
                      Application will use system date and time
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Data & Security Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-100">
                  <Database className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Data & Security</h3>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data Retention (days)
                </label>
                <select
                  value={appSettings.dataRetention}
                  onChange={(e) => handleSettingChange('dataRetention', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">How long to keep archived data</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Session Timeout (minutes)
                </label>
                <select
                  value={appSettings.sessionTimeout}
                  onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Automatic logout after inactivity</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Profile

