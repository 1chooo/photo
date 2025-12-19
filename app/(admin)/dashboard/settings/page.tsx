'use client'

import { useAuth } from '@/lib/firebase/useAuth'
import { useEffect, useState } from 'react'
import { TelegramChat } from '@/types/settings'
import { 
  Save, 
  Key, 
  MessageCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Copy, 
  Check,
  Plus,
  Trash2,
  Star,
  Edit2
} from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [idToken, setIdToken] = useState<string | null>(null)
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([])
  
  // UI States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken)
    }
  }, [user])

  // 載入現有設定
  useEffect(() => {
    if (!idToken) return

    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setTelegramChats(data.telegramChats || [])
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [idToken])

  const handleAddChat = () => {
    const newChat: TelegramChat = {
      id: `chat-${Date.now()}`,
      name: '',
      botToken: '',
      chatId: '',
      isDefault: telegramChats.length === 0
    }
    setTelegramChats([...telegramChats, newChat])
    setEditingId(newChat.id)
  }

  const handleUpdateChat = (id: string, updates: Partial<TelegramChat>) => {
    setTelegramChats(chats => 
      chats.map(chat => chat.id === id ? { ...chat, ...updates } : chat)
    )
  }

  const handleDeleteChat = (id: string) => {
    const updatedChats = telegramChats.filter(chat => chat.id !== id)
    // 如果刪除的是預設 chat，將第一個 chat 設為預設
    if (updatedChats.length > 0 && telegramChats.find(c => c.id === id)?.isDefault) {
      updatedChats[0].isDefault = true
    }
    setTelegramChats(updatedChats)
  }

  const handleSetDefault = (id: string) => {
    setTelegramChats(chats =>
      chats.map(chat => ({ ...chat, isDefault: chat.id === id }))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idToken) return

    // 驗證所有 chat 都有完整資料
    const invalidChat = telegramChats.find(chat => 
      !chat.name.trim() || !chat.botToken.trim() || !chat.chatId.trim()
    )
    
    if (invalidChat) {
      setMessage({ type: 'error', text: '請填寫所有 Chat 的完整資訊' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ telegramChats })
      })

      if (res.ok) {
        setMessage({ type: 'success', text: '設定已成功儲存！' })
        setEditingId(null)
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || '儲存失敗' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '儲存設定時發生錯誤' })
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToken = (chatId: string, token: string) => {
    navigator.clipboard.writeText(token)
    setCopied(chatId)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleShowToken = (chatId: string) => {
    setShowTokens(prev => ({ ...prev, [chatId]: !prev[chatId] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 border-b pb-4 border-neutral-200/50 dark:border-neutral-700/50">
        <h1 className="text-3xl font-bold mb-2">
          Settings
        </h1>
        <p className="opacity-70">
          管理您的 Telegram Chat 設定
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bots List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Telegram Chats</h2>
              <button
                type="button"
                onClick={handleAddChat}
                className="flex items-center gap-2 px-4 py-2 bg-rurikon-500 hover:opacity-90 text-white rounded-lg text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
                新增 Chat
              </button>
            </div>

            {telegramChats.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm opacity-60 mb-4">尚未設定任何 Telegram Chat</p>
                <button
                  type="button"
                  onClick={handleAddChat}
                  className="text-sm text-rurikon-500 hover:underline"
                >
                  新增第一個 Chat
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {telegramChats.map((chat, index) => (
                  <div
                    key={chat.id}
                    className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 space-y-3"
                  >
                    {/* Chat Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium opacity-50">#{index + 1}</span>
                        {chat.isDefault && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded text-xs font-medium">
                            <Star className="w-3 h-3 fill-current" />
                            預設
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!chat.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(chat.id)}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors opacity-60 hover:opacity-100"
                            title="設為預設 Chat"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === chat.id ? null : chat.id)}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors opacity-60 hover:opacity-100"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChat(chat.id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-60 hover:opacity-100 text-red-600"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Chat Name */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <MessageCircle className="w-4 h-4" />
                        Chat 名稱
                      </label>
                      <input
                        type="text"
                        value={chat.name}
                        onChange={(e) => handleUpdateChat(chat.id, { name: e.target.value })}
                        placeholder="例如：主頻道、測試群組"
                        disabled={editingId !== chat.id}
                        className="w-full px-4 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent transition-all outline-none text-sm disabled:opacity-50"
                      />
                    </div>

                    {/* Bot Token */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Key className="w-4 h-4" />
                        Bot Token
                      </label>
                      <div className="relative group">
                        <input
                          type={showTokens[chat.id] ? "text" : "password"}
                          value={chat.botToken}
                          onChange={(e) => handleUpdateChat(chat.id, { botToken: e.target.value })}
                          placeholder="123456:ABC-DEF..."
                          disabled={editingId !== chat.id}
                          className="w-full pl-4 pr-24 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent transition-all outline-none font-mono text-sm disabled:opacity-50"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-transparent">
                          <button
                            type="button"
                            onClick={() => toggleShowToken(chat.id)}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors opacity-60 hover:opacity-100"
                            title={showTokens[chat.id] ? "隱藏 Token" : "顯示 Token"}
                          >
                            {showTokens[chat.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />
                          <button
                            type="button"
                            onClick={() => handleCopyToken(chat.id, chat.botToken)}
                            disabled={!chat.botToken}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors opacity-60 hover:opacity-100"
                            title="複製 Token"
                          >
                            {copied === chat.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Chat ID */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <MessageCircle className="w-4 h-4" />
                        Chat ID
                      </label>
                      <input
                        type="text"
                        value={chat.chatId}
                        onChange={(e) => handleUpdateChat(chat.id, { chatId: e.target.value })}
                        placeholder="-1001234567890"
                        disabled={editingId !== chat.id}
                        className="w-full px-4 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent transition-all outline-none font-mono text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Message */}
          {message && (
            <div className={`p-4 rounded-lg border text-sm flex items-center gap-2 ${
              message.type === 'success' 
                ? 'border-green-200 text-green-600 dark:border-green-900 dark:text-green-400' 
                : 'border-red-200 text-red-600 dark:border-red-900 dark:text-red-400'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <Loader2 className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-rurikon-500 hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  儲存設定
                </>
              )}
            </button>
          </div>
        </form>

        {/* Helper Section */}
        <div className="mt-10 pt-6 border-t border-dashed border-neutral-200 dark:border-neutral-800">
          <h3 className="font-medium mb-4 flex items-center gap-2 opacity-90">
            <span className="flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs">?</span>
            如何設定 Telegram Bot？
          </h3>
          <ol className="text-sm opacity-70 space-y-2 list-decimal list-inside marker:opacity-50">
            <li>在 Telegram 中搜尋並開啟 <strong>@BotFather</strong></li>
            <li>發送 <code className="px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-xs">/newbot</code> 指令</li>
            <li>依序設定名稱，複製回傳的 <strong>HTTP API Token</strong></li>
            <li>將機器人加入您的頻道或群組</li>
            <li>填入上方表單並儲存</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
