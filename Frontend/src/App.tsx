import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ProfileSettings from './components/ProfileSettings';
import LogoutModal from './components/LogoutModal';
import { FiCalendar } from "react-icons/fi";

// =====================
// Types
// =====================
// =====================
// Types
// =====================
type ViewState = 'dashboard' | 'write' | 'read' | 'summary' | 'calendar';
type AuthModalState = 'none' | 'login' | 'register';

type SummaryData = {
  stats: {
    total: number
    overIt: number
    stillDealing: number
    needHelp: number
    pending: number
    needHelpStreak: number
  }
  mentalScore: number
  mentalState: string
  mentalEmoji: string
  aiSummary: string
}

type DiaryEntry = {
  id: number
  title: string
  content: string
  mood: string
  reflection: string
  status: string
  preview: string
  isLocked: boolean
  unlockAt: string
  createdAt: string
}

type UserProfile = {
  username: string;
  displayName: string;
  avatar: string;
};

type Theme = {
  name: string
  bg1: string
  bg2: string
  accent: string
  paperLine: string
  panel: string
}

// =====================
// Icons
// =====================
const IconBook = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const IconPlus = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const IconHome = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const IconLock = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
)

const IconBack = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const API_URL = "/api";

// =====================
// Themes (LIGHT)
// =====================
const THEMES: Theme[] = [
  {
    name: 'Cream',
    bg1: 'hsl(28, 100%, 96%)',
    bg2: 'hsl(30, 80%, 93%)',
    accent: 'hsl(29, 65%, 55%)',
    paperLine: 'rgba(0,0,0,0.06)',
    panel: 'rgba(255,255,255,0.85)',
  },
  {
    name: 'Pink',
    bg1: 'hsl(330, 100%, 96%)',
    bg2: 'hsl(330, 70%, 93%)',
    accent: 'hsl(330, 72%, 58%)',
    paperLine: 'rgba(0,0,0,0.06)',
    panel: 'rgba(255,255,255,0.88)',
  },
  {
    name: 'Mint',
    bg1: 'hsl(142, 76%, 94%)',
    bg2: 'hsl(160, 55%, 92%)',
    accent: 'hsl(158, 60%, 42%)',
    paperLine: 'rgba(0,0,0,0.06)',
    panel: 'rgba(255,255,255,0.86)',
  },
  {
    name: 'Lavender',
    bg1: 'hsl(260, 100%, 97%)',
    bg2: 'hsl(260, 70%, 93%)',
    accent: 'hsl(260, 55%, 58%)',
    paperLine: 'rgba(0,0,0,0.06)',
    panel: 'rgba(255,255,255,0.88)',
  },
]

function applyTheme(t: Theme) {
  const r = document.documentElement
  r.style.setProperty('--bg1', t.bg1)
  r.style.setProperty('--bg2', t.bg2)
  r.style.setProperty('--accent', t.accent)
  r.style.setProperty('--paperLine', t.paperLine)
  r.style.setProperty('--panel', t.panel)
  localStorage.setItem('theme', t.name)
}

// =====================
// Countdown
// =====================
const Countdown = ({ target }: { target: string }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(target).getTime() - new Date().getTime()
      if (diff <= 0) return 'Ready!'
      const hrs = Math.floor(diff / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const secs = Math.floor((diff % (1000 * 60)) / 1000)
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }

    setTimeLeft(calculate())
    const timer = setInterval(() => setTimeLeft(calculate()), 1000)
    return () => clearInterval(timer)
  }, [target])

  return <div className="countdown">{timeLeft}</div>
}


// Auth Helper
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers as any || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('token');
    window.location.reload(); // Simple way to reset state to login
  }
  return response;
};

function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [authModal, setAuthModal] = useState<AuthModalState>('none');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Writer state
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeMood, setWriteMood] = useState("");
  const MOOD_OPTIONS = useMemo(() => ['😊', '😢', '😠', '😰', '😴', '🤔', '💪', '❤️'], [])

  // Locked modal state
  const [lockedModalOpen, setLockedModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  // Read view state
  const [readEntry, setReadEntry] = useState<DiaryEntry | null>(null)
  const [reflectionText, setReflectionText] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'over_it' | 'still_dealing' | 'need_help' | null>(null)
  const [aiResponse, setAiResponse] = useState('')
  const [showResultModal, setShowResultModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Summary state
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);

  // AI features
  type AIQuestion = { id: number; text: string; category: string }
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([])
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({})
  const [aiAlerts, setAiAlerts] = useState<Array<{ type: string; title: string; message: string }>>([])

  // Speech-to-text
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)

  // Settings (theme / privacy)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [privacyBlur, setPrivacyBlur] = useState<boolean>(() => localStorage.getItem('privacyBlur') === '1')

  // Notification dedupe
  const notifiedRef = useRef<Set<number>>(new Set())

  // Logout state
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Check Auth on Mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      fetchEntries();
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  // Theme init
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const t = THEMES.find((x) => x.name === saved) || THEMES[0]
    applyTheme(t)
  }, [])

  // Privacy blur persist
  useEffect(() => {
    localStorage.setItem('privacyBlur', privacyBlur ? '1' : '0')
  }, [privacyBlur])

  // Speech support check
  useEffect(() => {
    setSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  }, [])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // =====================
  // Actions
  // =====================

  const handleAuthAction = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setAuthModal('login');
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'th-TH'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    // append only final results
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setWriteContent(prev => prev + transcript);
    }

    recognition.start()
      ; (window as any).currentRecognition = recognition
  }

  const stopListening = () => {
    const recognition = (window as any).currentRecognition
    if (recognition) {
      recognition.stop()
      setIsListening(false)
    }
  }

  const fetchEntries = async () => {
    try {
      const res = await authFetch(`${API_URL}/entries`)
      if (res.ok) {
        const data = await res.json()
        setEntries(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch entries', err)
    }
  }

  const fetchSingleEntry = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/entries/${id}`)
      if (res.ok) {
        const entry = await res.json()
        setReadEntry(entry)
        setReflectionText(entry.reflection || '')
        setSelectedStatus(null)
        setAiResponse('')
      }
    } catch (err) {
      console.error('Failed to fetch entry', err)
    }
  }

  // Check unlocked + notify (dedupe)
  useEffect(() => {
    const checkUnlocked = () => {
      const now = new Date()
      entries.forEach((entry) => {
        if (!entry.isLocked) return
        const unlockTime = new Date(entry.unlockAt)
        const timeDiff = unlockTime.getTime() - now.getTime()

        // notify when unlocking within next 10s OR just unlocked within last 60s
        const shouldNotify = timeDiff <= 10000 && timeDiff > -60000
        if (!shouldNotify) return

        if (notifiedRef.current.has(entry.id)) return
        notifiedRef.current.add(entry.id)

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('📖 Entry Ready!', {
            body: `"${entry.title}" is ready to reflect on!`,
          })
        }
      })
    }

    const interval = setInterval(checkUnlocked, 10000)
    return () => clearInterval(interval)
  }, [entries])

  // Fetch AI features
  useEffect(() => {
    const fetchAIFeatures = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Fetch AI questions (interactive Q&A)
        const questionsRes = await authFetch(`${API_URL}/ai/questions`);
        if (questionsRes.ok) {
          const data = await questionsRes.json()
          if (typeof data.questions === 'string') {
            try {
              const parsed = JSON.parse(data.questions)
              setAiQuestions(Array.isArray(parsed) ? parsed : [])
            } catch {
              setAiQuestions([])
            }
          } else if (Array.isArray(data.questions)) {
            setAiQuestions(data.questions)
          }
        }

        // Fetch pattern alerts
        const alertsRes = await authFetch(`${API_URL}/ai/alerts`);
        if (alertsRes.ok) {
          const data = await alertsRes.json()
          setAiAlerts(data.alerts || [])
        }
      } catch (err) {
        console.error(err)
      }
    }

    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await authFetch(`${API_URL}/profile`);
        if (res.ok) setUserProfile(await res.json());
      } catch (err) { console.error("Failed to fetch profile", err); }
    };

    fetchAIFeatures();
    fetchProfile();
  }, [entries, view]); // Dependencies from HEAD

  const handleUpdateProfile = async (data: { displayName: string; avatar: string }) => {
    try {
      const res = await authFetch(`${API_URL}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setUserProfile(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (err) { console.error("Failed to update profile", err); }
  };

  const saveAnswer = async (question: AIQuestion, answer: string) => {
    try {
      await authFetch(`${API_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.text, answer, category: question.category })
      });
      // Remove answered question from list
      setAiQuestions(prev => prev.filter(q => q.id !== question.id));
      setQuestionAnswers(prev => { const n = { ...prev }; delete n[question.id]; return n; });
    } catch (err) { console.error(err); }
  };

  const handleSealEntry = async () => {
    if (!writeTitle || !writeContent) return
    try {
      const res = await authFetch(`${API_URL}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: writeTitle,
          content: writeContent,
          mood: writeMood,
        }),
      })
      if (res.ok) {
        setWriteTitle('')
        setWriteContent('')
        setWriteMood('')
        await fetchEntries()
        setView('dashboard')
      }
    } catch (err) {
      console.error('Failed to post entry', err)
    }
  }

  const handleCardClick = (entry: DiaryEntry) => {
    if (entry.isLocked) {
      setSelectedEntry(entry)
      setLockedModalOpen(true)
    } else {
      fetchSingleEntry(entry.id)
      setView('read')
    }
  }

  const handleUnlock = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/entries/${id}/unlock`, { method: 'POST' });
      if (res.ok) {
        await fetchEntries();
      }
    } catch (err) { console.error("Failed to unlock entry", err); }
  };

  const handleSubmitReflection = async () => {
    if (!readEntry || !selectedStatus) return
    setIsSubmitting(true)

    try {
      const res = await authFetch(`${API_URL}/entries/${readEntry.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus, reflection: reflectionText }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiResponse(data.aiResponse || 'ขอบคุณที่แบ่งปันความรู้สึกนะ 💛')
        setShowResultModal(true)
        await fetchEntries()
      } else {
        setAiResponse('ขอบคุณที่แบ่งปันความรู้สึก เราอยู่ตรงนี้นะ 💛')
        setShowResultModal(true)
      }
    } catch (err) {
      console.error('Failed to respond', err)
      setAiResponse('ขอบคุณที่แบ่งปันความรู้สึก เราอยู่ตรงนี้นะ 💛')
      setShowResultModal(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeResultAndGoBack = () => {
    setShowResultModal(false)
    setView('dashboard')
    setReadEntry(null)
    setSelectedStatus(null)
    setAiResponse('')
  }

  const handleDelete = async () => {
    if (!entryToDelete) return;
    try {
      await authFetch(`${API_URL}/entries/${entryToDelete.id}`, { method: 'DELETE' });
      fetchEntries();
      setShowDeleteModal(false);
      setEntryToDelete(null);
      if (readEntry?.id === entryToDelete.id) {
        setView('dashboard');
        setReadEntry(null);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className={`app-layout ${privacyBlur ? 'privacy-blur' : ''}`}>
      {/* Sidebar - Always visible in guest mode */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <h3>H</h3>
          <button className="settings-gear" onClick={() => setSettingsOpen(true)} title="Settings">
            ⚙️
          </button>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <span className="icon-box"><IconBook /></span><span>บันทึกของฉัน</span>
          </button>

          <button className={`nav-item ${view === 'summary' ? 'active' : ''}`} onClick={() => handleAuthAction(async () => {
            setView('summary');
            if (!summaryData) {
              setLoadingSummary(true);
              try {
                const res = await authFetch(`${API_URL}/summary`);
                if (res.ok) setSummaryData(await res.json());
              } catch (err) { console.error(err); }
              setLoadingSummary(false);
            }
          })}>
            <IconHome /><span>สรุปผล</span>
          </button>

          <button className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => handleAuthAction(() => setView('calendar'))}>
            <span className="icon-box"><FiCalendar className="calendar-icon" /></span><span>ปฏิทิน</span>
          </button>
          <div style={{ flexGrow: 1 }}></div>

          {/* User Profile Section */}
          {isAuthenticated && userProfile ? (
            <div className="sidebar-profile" onClick={() => setShowProfileModal(true)}>
              <div className="profile-avatar">
                {userProfile.avatar || userProfile.username[0]?.toUpperCase()}
              </div>
              <div className="profile-info">
                <div className="profile-name">{userProfile.displayName || userProfile.username}</div>
                <div className="profile-handle">@{userProfile.username}</div>
              </div>
            </div>
          ) : (
            <button className="nav-item logout-btn" style={{ background: 'white', border: '2px solid var(--accent)', color: 'hsl(220, 25%, 15%)', justifyContent: 'center', fontWeight: '800', fontSize: '1rem' }} onClick={() => setAuthModal('login')}>
              <span>เข้าสู่ระบบ</span>
            </button>
          )}

          {isAuthenticated && (
            <button className="nav-item logout-btn" onClick={() => setShowLogoutModal(true)}>
              🚪<span>ออกจากระบบ</span>
            </button>
          )}

        </nav>

        <div className="sidebar-footer">
          <div className="privacy-row">
            <span>Privacy Blur</span>
            <label className="switch">
              <input type="checkbox" checked={privacyBlur} onChange={(e) => setPrivacyBlur(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <p className="sidebar-hint">Safe space for teens 💛</p>
        </div>
      </aside>

      {userProfile && (
        <ProfileSettings
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          currentUser={userProfile}
          onUpdate={handleUpdateProfile}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        {view === 'dashboard' ? (
          <div className="dashboard-view container">
            <header className="view-header">
              <div className="view-header-icon">
                📝
              </div>
              <div className="view-header-text">
                <h1>ไดอารี่ของฉัน</h1>
                <p className="subtitle">พื้นที่ปลอดภัยสำหรับความคิดของคุณ</p>
              </div>
            </header>

            {/* AI Alerts Banner */}
            {aiAlerts.length > 0 && (
              <div className="ai-alerts">
                {aiAlerts.map((alert, i) => (
                  <div key={i} className={`alert-banner alert-${alert.type}`}>
                    <span className="alert-title">{alert.title}</span>
                    <span className="alert-message">{alert.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI Questions - Interactive Q&A */}
            {aiQuestions.length > 0 && (
              <div className="ai-questions glass-panel">
                <h3>🤖 AI อยากรู้จักคุณมากขึ้น</h3>
                <p className="ai-questions-subtitle">ตอบคำถามเหล่านี้เพื่อให้ AI เข้าใจคุณดีขึ้น</p>
                <div className="questions-list">
                  {aiQuestions.map((q) => (
                    <div key={q.id} className="question-card">
                      <span className="question-text">{q.text}</span>
                      <div className="question-input-row">
                        <input
                          type="text"
                          placeholder="พิมพ์คำตอบ..."
                          value={questionAnswers[q.id] || ''}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && questionAnswers[q.id]?.trim()) {
                              saveAnswer(q, questionAnswers[q.id])
                            }
                          }}
                        />
                        <button
                          onClick={() => questionAnswers[q.id]?.trim() && saveAnswer(q, questionAnswers[q.id])}
                          disabled={!questionAnswers[q.id]?.trim()}
                        >
                          ส่ง
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="entries-grid">
              <div className="entry-card create-card" onClick={() => handleAuthAction(() => setView('write'))}>
                <div className="icon-wrapper"><IconPlus /></div>
                <span>บันทึกใหม่</span>
              </div>

              {entries.map((entry) => (
                <div key={entry.id} className={`entry-card ${entry.isLocked ? 'locked-card' : ''}`} onClick={() => handleCardClick(entry)}>
                  {entry.isLocked ? (
                    <div className="locked-card-content">
                      <div className={`locked-title ${privacyBlur ? 'blur-text' : ''}`}>{entry.title}</div>
                      <div className="locked-center">
                        <IconLock size={56} />
                        <span className="locked-label">LOCKED</span>
                      </div>
                      <Countdown target={entry.unlockAt} />
                    </div>
                  ) : (
                    <>
                      <div className="card-header">
                        <span className="date">{new Date(entry.createdAt).toLocaleDateString()}</span>
                        {entry.mood ? <span className="mood-pill">{entry.mood}</span> : null}
                      </div>
                      <h3 className={privacyBlur ? 'blur-text' : ''}>{entry.title}</h3>
                      <p className={`preview-text ${privacyBlur ? 'blur-text' : ''}`}>{entry.preview}</p>
                    </>
                  )}
                </div>
              ))}
            </div>

            <button className="fab-button mobile-only" onClick={() => handleAuthAction(() => setView('write'))}>
              <IconPlus />
            </button>
          </div>
        ) : view === 'summary' ? (
          <div className="summary-view container">
            <header className="view-header">
              <div className="view-header-icon">
                📊
              </div>
              <div className="view-header-text">
                <h1>สรุปผล</h1>
                <p className="subtitle">ภาพรวมสุขภาพใจของคุณ</p>
              </div>
            </header>
            {summaryData && (
              <button
                className="btn-text"
                onClick={async () => {
                  setLoadingSummary(true);
                  try {
                    const res = await authFetch(`${API_URL}/summary`);
                    if (res.ok) setSummaryData(await res.json());
                  } catch (err) { console.error(err); }
                  setLoadingSummary(false);
                }}
                disabled={loadingSummary}
                style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
              >
                🔄 อัปเดตข้อมูลล่าสุด
              </button>
            )}

            {loadingSummary ? (
              <div className="loading-state">กำลังวิเคราะห์ข้อมูล...</div>
            ) : summaryData ? (
              <div className="summary-content">
                {/* Mental State Hero */}
                <div className="glass-panel mental-hero">
                  <div className="mental-emoji">{summaryData.mentalEmoji}</div>
                  <div className="mental-score-display">
                    <span className="score-number">{summaryData.mentalScore}</span>
                    <span className="score-label">/100</span>
                  </div>
                  <div className="mental-state-label">{summaryData.mentalState}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${summaryData.mentalScore}%` }}></div>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="stats-grid">
                  <div className="glass-panel stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-value">{summaryData.stats.total}</div>
                    <div className="stat-label">บันทึกทั้งหมด</div>
                  </div>
                  <div className="glass-panel stat-card stat-green">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value">{summaryData.stats.overIt}</div>
                    <div className="stat-label">เรื่องจิ๊บจ๊อย</div>
                  </div>
                  <div className="glass-panel stat-card stat-yellow">
                    <div className="stat-icon">⏳</div>
                    <div className="stat-value">{summaryData.stats.stillDealing}</div>
                    <div className="stat-label">ยังสู้อยู่</div>
                  </div>
                  <div className="glass-panel stat-card stat-red">
                    <div className="stat-icon">🆘</div>
                    <div className="stat-value">{summaryData.stats.needHelp}</div>
                    <div className="stat-label">ต้องการช่วยเหลือ</div>
                  </div>
                  <div className="glass-panel stat-card stat-gray">
                    <div className="stat-icon">⏸️</div>
                    <div className="stat-value">{summaryData.stats.pending}</div>
                    <div className="stat-label">ยังไม่ได้ไตร่ตรอง</div>
                  </div>
                </div>

                {/* Status Distribution Chart */}
                {summaryData.stats.total > 0 && (
                  <div className="glass-panel chart-section">
                    <h3>สัดส่วนสถานะ</h3>
                    <div className="status-bar-chart">
                      {summaryData.stats.overIt > 0 && (
                        <div
                          className="bar-segment green"
                          style={{ width: `${(summaryData.stats.overIt / summaryData.stats.total) * 100}%` }}
                          title={`เรื่องจิ๊บจ๊อย: ${summaryData.stats.overIt}`}
                        ></div>
                      )}
                      {summaryData.stats.stillDealing > 0 && (
                        <div
                          className="bar-segment yellow"
                          style={{ width: `${(summaryData.stats.stillDealing / summaryData.stats.total) * 100}%` }}
                          title={`ยังสู้อยู่: ${summaryData.stats.stillDealing}`}
                        ></div>
                      )}
                      {summaryData.stats.needHelp > 0 && (
                        <div
                          className="bar-segment red"
                          style={{ width: `${(summaryData.stats.needHelp / summaryData.stats.total) * 100}%` }}
                          title={`ต้องการช่วยเหลือ: ${summaryData.stats.needHelp}`}
                        ></div>
                      )}
                    </div>
                    <div className="chart-legend">
                      <span className="legend-item">
                        <span className="dot green"></span>จบแล้ว
                      </span>
                      <span className="legend-item">
                        <span className="dot yellow"></span>กำลังสู้
                      </span>
                      <span className="legend-item">
                        <span className="dot red"></span>ต้องช่วย
                      </span>
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {summaryData.aiSummary && (
                  <div className="glass-panel ai-summary-section">
                    <h3>🤖 AI วิเคราะห์</h3>
                    <div className="ai-summary-text">{summaryData.aiSummary}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>ยังไม่มีสรุปสุขภาพจิตของคุณ</p>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    setLoadingSummary(true);
                    try {
                      const res = await authFetch(`${API_URL}/summary`);
                      if (res.ok) setSummaryData(await res.json());
                    } catch (err) { console.error(err); }
                    setLoadingSummary(false);
                  }}
                  disabled={loadingSummary}
                >
                  {loadingSummary ? 'กำลังประมวลผล...' : '🔄 ลองวิเคราะห์อีกครั้ง'}
                </button>
              </div>
            )}
          </div>
        ) : view === 'calendar' ? (
          <div className="calendar-view container">
            <header className="view-header">
              <div className="view-header-icon">
                📅
              </div>
              <div className="view-header-text">
                <h1>ปฏิทิน</h1>
                <p className="subtitle">ดูประวัติบันทึกของคุณ</p>
              </div>
            </header>

            <div className="glass-panel calendar-panel">
              <div className="calendar-nav">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>&lt;</button>
                <span>{currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>&gt;</button>
              </div>

              <div className="calendar-grid">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
                  <div key={d} className="calendar-day-header">
                    {d}
                  </div>
                ))}

                {(() => {
                  const year = currentMonth.getFullYear()
                  const month = currentMonth.getMonth()
                  const firstDay = new Date(year, month, 1).getDay()
                  const daysInMonth = new Date(year, month + 1, 0).getDate()
                  const days: any[] = []

                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const dayEntries = entries.filter((e) => e.createdAt.startsWith(dateStr))
                    const hasMood = dayEntries.some((e) => e.mood)
                    const moodEmoji = dayEntries.find((e) => e.mood)?.mood || ''
                    const hasNeedHelp = dayEntries.some((e) => e.status === 'need_help')
                    const hasStillDealing = dayEntries.some((e) => e.status === 'still_dealing')
                    const hasOverIt = dayEntries.some((e) => e.status === 'over_it')

                    let statusClass = ''
                    if (hasNeedHelp) statusClass = 'status-red'
                    else if (hasStillDealing) statusClass = 'status-yellow'
                    else if (hasOverIt) statusClass = 'status-green'

                    days.push(
                      <div
                        key={day}
                        className={`calendar-day ${dayEntries.length > 0 ? 'has-entry' : ''} ${statusClass}`}
                        onClick={() => {
                          if (dayEntries.length > 0) {
                            fetchSingleEntry(dayEntries[0].id)
                            setView('read')
                          }
                        }}
                      >
                        <span className="day-number">{day}</span>
                        {hasMood && <span className="day-mood">{moodEmoji}</span>}
                        {dayEntries.length > 1 && <span className="day-count">+{dayEntries.length - 1}</span>}
                      </div>
                    )
                  }
                  return days
                })()}
              </div>
            </div>
          </div>
        ) : view === 'write' ? (
          <div className="writer-view container">
            <div className="glass-panel writer-panel diary-paper">
              <div className="writer-header">
                <h2>บันทึกใหม่</h2>
                <button className="btn-text" onClick={() => setView('dashboard')}>ยกเลิก</button>
              </div>
              <input type="text" className="diary-title-input" placeholder="ตั้งชื่อเรื่อง..." value={writeTitle} onChange={(e) => setWriteTitle(e.target.value)} />

              {/* Mood Picker */}
              <div className="mood-picker">
                <span className="mood-label">วันนี้รู้สึกอย่างไร?</span>
                <div className="mood-options">
                  {MOOD_OPTIONS.map((mood) => (
                    <button
                      key={mood}
                      className={`mood-btn ${writeMood === mood ? 'selected' : ''}`}
                      onClick={() => setWriteMood(writeMood === mood ? '' : mood)}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea with Voice Button */}
              <div className="textarea-wrapper">
                <textarea
                  className="diary-input"
                  placeholder={isListening ? "🎤 กำลังฟัง... พูดได้เลย!" : "มีอะไรในใจระบายออกมาได้เลย..."}
                  autoFocus
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                ></textarea>

                {speechSupported && (
                  <button
                    className={`voice-btn ${isListening ? 'listening' : ''}`}
                    onClick={isListening ? stopListening : startListening}
                    title={isListening ? 'หยุดฟัง' : 'พูดแทนการพิมพ์'}
                  >
                    {isListening ? '⏹️' : '🎤'}
                  </button>
                )}
              </div>

              <div className="writer-actions">
                <button className="btn-primary" onClick={handleSealEntry}>บันทึกและปล่อยวาง</button>
              </div>
            </div>
          </div>
        ) : view === 'read' && readEntry ? (
          <div className="read-view container">
            <div className="read-header-actions">
              <button className="btn-back" onClick={() => { setView('dashboard'); setReadEntry(null); }}>
                <IconBack /> กลับ
              </button>
              <button
                className="btn-delete"
                onClick={() => {
                  setEntryToDelete(readEntry)
                  setShowDeleteModal(true)
                }}
              >
                🗑️ ลบ
              </button>
            </div>

            <div className="read-layout">
              {/* LEFT: Past Entry */}
              <div className="glass-panel read-card past-card diary-paper">
                <div className="read-card-header">
                  <span className="read-label">📜 ตัวคุณในอดีต</span>
                  <span className="read-date">{new Date(readEntry.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className={`read-title ${privacyBlur ? 'blur-text' : ''}`}>{readEntry.title}</h2>
                <div className={`read-content ${privacyBlur ? 'blur-text' : ''}`}>{readEntry.content}</div>
              </div>

              {/* RIGHT: Reflection */}
              <div className="glass-panel read-card reflection-card diary-paper">
                <div className="read-card-header">
                  <span className="read-label">💭 ไตร่ตรอง</span>
                </div>

                <div className="reflection-prompts">
                  <p>• ตอนนี้รู้สึกยังไงกับเรื่องนั้น?</p>
                  <p>• แก้ได้หรือยัง?</p>
                  <p>• มันไม่ได้แย่อย่างที่คิดใช่ไหม?</p>
                </div>

                <textarea
                  className={`reflection-input ${privacyBlur ? 'blur-text' : ''}`}
                  placeholder="เขียนสิ่งที่อยากบอกตัวเองในอดีต..."
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                ></textarea>

                <div className="response-section">
                  <p className="response-label">เลือกสถานะของคุณ:</p>
                  <div className="response-options">
                    <label className={`response-option ${selectedStatus === 'over_it' ? 'selected' : ''}`}>
                      <input type="radio" name="status" value="over_it" checked={selectedStatus === 'over_it'} onChange={() => setSelectedStatus('over_it')} />
                      <span className="response-icon">✅</span>
                      <div>
                        <span className="response-title">เรื่องจิ๊บจ๊อย</span>
                        <span className="response-desc">Over it! ไม่ได้รู้สึกแย่แล้ว</span>
                      </div>
                    </label>

                    <label className={`response-option ${selectedStatus === 'still_dealing' ? 'selected' : ''}`}>
                      <input type="radio" name="status" value="still_dealing" checked={selectedStatus === 'still_dealing'} onChange={() => setSelectedStatus('still_dealing')} />
                      <span className="response-icon">⏳</span>
                      <div>
                        <span className="response-title">ยังสู้อยู่</span>
                        <span className="response-desc">Still dealing แต่โอเคขึ้นแล้ว (กลับมาใน 12 ชม.)</span>
                      </div>
                    </label>

                    <label className={`response-option ${selectedStatus === 'need_help' ? 'selected' : ''}`}>
                      <input type="radio" name="status" value="need_help" checked={selectedStatus === 'need_help'} onChange={() => setSelectedStatus('need_help')} />
                      <span className="response-icon">🆘</span>
                      <div>
                        <span className="response-title">ไม่ไหวช่วยด้วย</span>
                        <span className="response-desc">Need help ยังเครียดมาก (กลับมาใน 6 ชม.)</span>
                      </div>
                    </label>
                  </div>

                  <button className="btn-primary submit-btn" onClick={handleSubmitReflection} disabled={!selectedStatus || isSubmitting}>
                    {isSubmitting ? 'กำลังประมวลผล...' : 'ส่งคำตอบ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ===== Settings Modal ===== */}
        {settingsOpen && (
          <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
            <div className="modal-content glass-panel settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon">⚙️</div>
              <h3>Settings</h3>

              <div className="settings-section">
                <div className="settings-title">Theme</div>
                <div className="theme-grid">
                  {THEMES.map((t) => (
                    <button
                      key={t.name}
                      className="theme-card"
                      onClick={() => applyTheme(t)}
                      style={{
                        background: `linear-gradient(135deg, ${t.bg1}, ${t.bg2})`,
                        borderColor: t.accent,
                      }}
                    >
                      <div className="theme-name">{t.name}</div>
                      <div className="theme-accent" style={{ background: t.accent }}></div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-title">Privacy</div>
                <div className="settings-row">
                  <span>Blur titles & previews</span>
                  <label className="switch">
                    <input type="checkbox" checked={privacyBlur} onChange={(e) => setPrivacyBlur(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="settings-note">เหมาะเวลาคุณอยู่ที่สาธารณะ (เพื่อน/คนอื่นมองจอ)</div>
              </div>

              <button className="btn-primary" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* ===== AI Result Modal ===== */}
        {showResultModal && (
          <div className="modal-overlay" onClick={closeResultAndGoBack}>
            <div className="modal-content glass-panel ai-result-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon">🤖</div>
              <h3>จากใจ AI</h3>
              <div className={`ai-response-text ${privacyBlur ? 'blur-text' : ''}`}>{aiResponse}</div>

              {selectedStatus === 'need_help' && (
                <div className="help-resources">
                  <div className="help-item">
                    <span>📞</span>
                    <div>
                      <strong>สายด่วนสุขภาพจิต</strong>
                      <p>1323 (24 ชั่วโมง)</p>
                    </div>
                  </div>
                  <div className="help-item">
                    <span>💬</span>
                    <div>
                      <strong>สายด่วนป้องกันการฆ่าตัวตาย</strong>
                      <p>1388</p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedStatus === 'still_dealing' || selectedStatus === 'need_help') && (
                <p className="timer-note">⏰ เราจะกลับมาเช็คอีกครั้งใน {selectedStatus === 'need_help' ? '6' : '12'} ชั่วโมง</p>
              )}

              <button className="btn-primary" onClick={closeResultAndGoBack}>
                ขอบคุณนะ 💛
              </button>
            </div>
          </div>
        )}

        {/* ===== Locked Modal ===== */}
        {lockedModalOpen && selectedEntry && (
          <div className="modal-overlay" onClick={() => setLockedModalOpen(false)}>
            <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-icon"><IconLock size={48} /></div>
              <h3>ยังเปิดไม่ได้...</h3>
              <p>ยังไม่ถึงเวลาที่จะอ่านบันทึกนี้</p>
              <p style={{ marginTop: '0.5rem', color: 'hsl(45, 90%, 65%)' }}>ลองหายใจเข้าลึกๆ ก่อนไหม?</p>
              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setLockedModalOpen(false)}>รอต่อไป</button>
                <button className="btn-primary" onClick={() => {
                  handleUnlock(selectedEntry.id);
                  setLockedModalOpen(false);
                }}>พร้อมแล้ว</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Delete Confirmation Modal ===== */}
        {showDeleteModal && entryToDelete && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon">🗑️</div>
              <h3>ลบรายการนี้?</h3>
              <p>
                คุณแน่ใจหรือไม่ที่จะลบ "<span className={privacyBlur ? 'blur-text' : ''}>{entryToDelete.title}</span>"?
              </p>
              <p style={{ marginTop: '0.5rem', color: 'hsl(0, 70%, 60%)' }}>การกระทำนี้ไม่สามารถเรียกคืนได้</p>
              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                  ยกเลิก
                </button>
                <button className="btn-danger" onClick={handleDelete}>
                  ลบเลย
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Logout Modal Component */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          setEntries([]);
          setSummaryData(null);
          setUserProfile(null);
          setView('dashboard');
          setShowLogoutModal(false);
        }}
      />

      {/* ===== Auth Modals ===== */}
      {authModal === 'login' && (
        <div className="modal-overlay" onClick={() => setAuthModal('none')}>
          {/* Prevent click inside modal from closing it */}
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <Login
              onLoginSuccess={(username) => {
                console.log("Logged in as", username);
                setIsAuthenticated(true);
                setAuthModal('none');
                fetchEntries();
                // We're already on dashboard or the protected route logic will handle next steps if needed
                // But generally staying on dashboard is fine or we could pass a redirect callback later
              }}
              onNavigateToRegister={() => setAuthModal('register')}
            />
          </div>
        </div>
      )}

      {authModal === 'register' && (
        <div className="modal-overlay" onClick={() => setAuthModal('none')}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <Register
              onRegisterSuccess={() => setAuthModal('login')}
              onNavigateToLogin={() => setAuthModal('login')}
            />
          </div>
        </div>
      )}

    </div>
  )
}

export default App
