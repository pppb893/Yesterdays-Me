
import { useState, useEffect } from 'react'
import './App.css'

// Types
type ViewState = 'dashboard' | 'write' | 'read' | 'summary' | 'calendar';

type SummaryData = {
  stats: {
    total: number;
    overIt: number;
    stillDealing: number;
    needHelp: number;
    pending: number;
    needHelpStreak: number;
  };
  mentalScore: number;
  mentalState: string;
  mentalEmoji: string;
  aiSummary: string;
};

type DiaryEntry = {
  id: number;
  title: string;
  content: string;
  mood: string;
  reflection: string;
  status: string;
  preview: string;
  isLocked: boolean;
  unlockAt: string;
  createdAt: string;
};

// Icons
const IconBook = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);
const IconPlus = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IconHome = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
);
const IconLock = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const IconBack = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);

const API_URL = "/api";

// Countdown Component
const Countdown = ({ target }: { target: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(target).getTime() - new Date().getTime();
      if (diff <= 0) return "Ready!";
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    setTimeLeft(calculate());
    const timer = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(timer);
  }, [target]);

  return <div className="countdown">{timeLeft}</div>;
}

function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [lockedModalOpen, setLockedModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  // Read View state
  const [readEntry, setReadEntry] = useState<DiaryEntry | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<'over_it' | 'still_dealing' | 'need_help' | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [showResultModal, setShowResultModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showEncourageModal, setShowEncourageModal] = useState(false);

  // Summary state
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Mood picker
  const [writeMood, setWriteMood] = useState("");
  const MOOD_OPTIONS = ["😊", "😢", "😠", "😰", "😴", "🤔", "💪", "❤️"];

  // Speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Check if Speech API is supported
  useEffect(() => {
    setSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }, []);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH'; // Thai language
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setWriteContent(prev => prev + transcript);
    };

    recognition.start();

    // Store recognition instance to stop later
    (window as any).currentRecognition = recognition;
  };

  const stopListening = () => {
    const recognition = (window as any).currentRecognition;
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);

  const handleDelete = async () => {
    if (!entryToDelete) return;
    try {
      await fetch(`${API_URL}/entries/${entryToDelete.id}`, { method: 'DELETE' });
      fetchEntries();
      setShowDeleteModal(false);
      setEntryToDelete(null);
      if (readEntry?.id === entryToDelete.id) {
        setView('dashboard');
        setReadEntry(null);
      }
    } catch (err) { console.error(err); }
  };

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check for unlocked entries and notify
  useEffect(() => {
    const checkUnlocked = () => {
      const now = new Date();
      entries.forEach(entry => {
        if (entry.isLocked) {
          const unlockTime = new Date(entry.unlockAt);
          const timeDiff = unlockTime.getTime() - now.getTime();
          // If unlocking in next 5 seconds or just unlocked
          if (timeDiff <= 5000 && timeDiff > -60000) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('📖 Entry Ready!', {
                body: `"${entry.title}" is ready to reflect on!`,
                icon: '📔'
              });
            }
          }
        }
      });
    };
    const interval = setInterval(checkUnlocked, 10000);
    return () => clearInterval(interval);
  }, [entries]);

  // AI Features state
  type AIQuestion = { id: number; text: string; category: string };
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [aiAlerts, setAiAlerts] = useState<Array<{ type: string; title: string; message: string }>>([]);

  // Fetch AI features on load
  useEffect(() => {
    const fetchAIFeatures = async () => {
      try {
        // Fetch AI questions (interactive Q&A)
        const questionsRes = await fetch(`${API_URL}/ai/questions`);
        if (questionsRes.ok) {
          const data = await questionsRes.json();
          // Parse questions - could be JSON string or array
          if (typeof data.questions === 'string') {
            try {
              const parsed = JSON.parse(data.questions);
              setAiQuestions(Array.isArray(parsed) ? parsed : []);
            } catch { setAiQuestions([]); }
          } else if (Array.isArray(data.questions)) {
            setAiQuestions(data.questions);
          }
        }

        // Fetch pattern alerts
        const alertsRes = await fetch(`${API_URL}/ai/alerts`);
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          setAiAlerts(data.alerts || []);
        }
      } catch (err) { console.error(err); }
    };

    fetchAIFeatures();
  }, [entries]);

  // Save answer to a question (AI learning)
  const saveAnswer = async (question: AIQuestion, answer: string) => {
    try {
      await fetch(`${API_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.text, answer, category: question.category })
      });
      // Remove answered question from list
      setAiQuestions(prev => prev.filter(q => q.id !== question.id));
      setQuestionAnswers(prev => { const n = { ...prev }; delete n[question.id]; return n; });
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    try {
      const res = await fetch(`${API_URL}/entries`);
      if (res.ok) setEntries(await res.json());
    } catch (err) { console.error("Failed to fetch entries", err); }
  };

  const fetchSingleEntry = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/entries/${id}`);
      if (res.ok) {
        const entry = await res.json();
        setReadEntry(entry);
        setReflectionText(entry.reflection || "");
        setSelectedStatus(null);
        setAiResponse("");
      }
    } catch (err) { console.error("Failed to fetch entry", err); }
  };

  const handleSealEntry = async () => {
    if (!writeTitle || !writeContent) return;
    try {
      const res = await fetch(`${API_URL}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: writeTitle, content: writeContent, mood: writeMood })
      });
      if (res.ok) {
        setWriteTitle(""); setWriteContent(""); setWriteMood("");
        await fetchEntries();
        setView('dashboard');
      }
    } catch (err) { console.error("Failed to post entry", err); }
  };

  const handleCardClick = (entry: DiaryEntry) => {
    if (entry.isLocked) {
      setSelectedEntry(entry);
      setLockedModalOpen(true);
    } else {
      // Open Read View
      fetchSingleEntry(entry.id);
      setView('read');
    }
  };

  const handleUnlock = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/entries/${id}/unlock`, { method: 'POST' });
      if (res.ok) {
        await fetchEntries();
      }
    } catch (err) { console.error("Failed to unlock entry", err); }
  };

  const handleSubmitReflection = async () => {
    if (!readEntry || !selectedStatus) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/entries/${readEntry.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus, reflection: reflectionText })
      });

      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.aiResponse);
        setShowResultModal(true);
        await fetchEntries();
      }
    } catch (err) {
      console.error("Failed to respond", err);
      setAiResponse("ขอบคุณที่แบ่งปันความรู้สึก เราอยู่ตรงนี้นะ 💛");
      setShowResultModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeResultAndGoBack = () => {
    setShowResultModal(false);
    setView('dashboard');
    setReadEntry(null);
    setSelectedStatus(null);
    setAiResponse("");
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header"><h3>H</h3></div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <IconBook /><span>My Diary</span>
          </button>
          <button className={`nav-item ${view === 'summary' ? 'active' : ''}`} onClick={() => setView('summary')}>
            <IconHome /><span>Summary</span>
          </button>
          <button className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
            📅<span>Calendar</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {view === 'dashboard' ? (
          <div className="dashboard-view container">
            <header className="view-header">
              <h1>My Diary</h1>
              <p className="subtitle">Your safe space for thoughts.</p>
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
                          onChange={(e) => setQuestionAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && questionAnswers[q.id]?.trim()) {
                              saveAnswer(q, questionAnswers[q.id]);
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
              <div className="entry-card create-card" onClick={() => setView('write')}>
                <div className="icon-wrapper"><IconPlus /></div>
                <span>New Entry</span>
              </div>

              {entries.map(entry => (
                <div
                  key={entry.id}
                  className={`entry-card ${entry.isLocked ? 'locked-card' : ''}`}
                  onClick={() => handleCardClick(entry)}
                >
                  {entry.isLocked ? (
                    <div className="locked-card-content">
                      <div className="locked-title">{entry.title}</div>
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
                      </div>
                      <h3>{entry.title}</h3>
                      <p className="preview-text">{entry.preview}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button className="fab-button mobile-only" onClick={() => setView('write')}><IconPlus /></button>
          </div>
        ) : view === 'summary' ? (
          <div className="summary-view container">
            <header className="view-header">
              <h1>Mental Health Summary</h1>
              <p className="subtitle">ภาพรวมสุขภาพจิตของคุณ</p>
              {summaryData && (
                <button
                  className="btn-text"
                  onClick={async () => {
                    setLoadingSummary(true);
                    try {
                      const res = await fetch(`${API_URL}/summary`);
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
            </header>

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
                    <div
                      className="score-fill"
                      style={{ width: `${summaryData.mentalScore}%` }}
                    ></div>
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
                      <span className="legend-item"><span className="dot green"></span>จบแล้ว</span>
                      <span className="legend-item"><span className="dot yellow"></span>กำลังสู้</span>
                      <span className="legend-item"><span className="dot red"></span>ต้องช่วย</span>
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {summaryData.aiSummary && (
                  <div className="glass-panel ai-summary-section">
                    <h3>🤖 AI วิเคราะห์</h3>
                    <div className="ai-summary-text">
                      {summaryData.aiSummary}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>กดปุ่มเพื่อวิเคราะห์สรุปสุขภาพจิตของคุณ</p>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    setLoadingSummary(true);
                    try {
                      const res = await fetch(`${API_URL}/summary`);
                      if (res.ok) setSummaryData(await res.json());
                    } catch (err) { console.error(err); }
                    setLoadingSummary(false);
                  }}
                  disabled={loadingSummary}
                >
                  {loadingSummary ? 'กำลังประมวลผล...' : '✨ เริ่มการวิเคราะห์'}
                </button>
              </div>
            )}
          </div>

        ) : view === 'calendar' ? (
          <div className="calendar-view container">
            <header className="view-header">
              <h1>📅 Calendar</h1>
              <p className="subtitle">ดูประวัติบันทึกของคุณ</p>
            </header>

            <div className="glass-panel calendar-panel">
              {/* Month Navigation */}
              <div className="calendar-nav">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>&lt;</button>
                <span>{currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>&gt;</button>
              </div>

              {/* Day Headers */}
              <div className="calendar-grid">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                  <div key={d} className="calendar-day-header">{d}</div>
                ))}

                {/* Calendar Days */}
                {(() => {
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days = [];

                  // Empty cells for days before month starts
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
                  }

                  // Actual days
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEntries = entries.filter(e => e.createdAt.startsWith(dateStr));
                    const hasMood = dayEntries.some(e => e.mood);
                    const moodEmoji = dayEntries.find(e => e.mood)?.mood || '';
                    const hasNeedHelp = dayEntries.some(e => e.status === 'need_help');
                    const hasStillDealing = dayEntries.some(e => e.status === 'still_dealing');
                    const hasOverIt = dayEntries.some(e => e.status === 'over_it');

                    let statusClass = '';
                    if (hasNeedHelp) statusClass = 'status-red';
                    else if (hasStillDealing) statusClass = 'status-yellow';
                    else if (hasOverIt) statusClass = 'status-green';

                    days.push(
                      <div
                        key={day}
                        className={`calendar-day ${dayEntries.length > 0 ? 'has-entry' : ''} ${statusClass}`}
                        onClick={() => {
                          if (dayEntries.length > 0) {
                            fetchSingleEntry(dayEntries[0].id);
                            setView('read');
                          }
                        }}
                      >
                        <span className="day-number">{day}</span>
                        {hasMood && <span className="day-mood">{moodEmoji}</span>}
                        {dayEntries.length > 1 && <span className="day-count">+{dayEntries.length - 1}</span>}
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
            </div>
          </div>

        ) : view === 'write' ? (
          <div className="writer-view container">
            <div className="glass-panel writer-panel">
              <div className="writer-header">
                <h2>New Entry</h2>
                <button className="btn-text" onClick={() => setView('dashboard')}>Cancel</button>
              </div>
              <input type="text" className="diary-title-input" placeholder="Title your thought..." value={writeTitle} onChange={(e) => setWriteTitle(e.target.value)} />

              {/* Mood Picker */}
              <div className="mood-picker">
                <span className="mood-label">How are you feeling?</span>
                <div className="mood-options">
                  {MOOD_OPTIONS.map(mood => (
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
                  placeholder={isListening ? "🎤 กำลังฟัง... พูดได้เลย!" : "What's on your mind today? Let it all out..."}
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
                <button className="btn-primary" onClick={handleSealEntry}>Seal & Release</button>
              </div>
            </div>
          </div>

        ) : view === 'read' && readEntry ? (
          /* ====== READ VIEW - SIDE BY SIDE ====== */
          <div className="read-view container">
            <div className="read-header-actions">
              <button className="btn-back" onClick={() => { setView('dashboard'); setReadEntry(null); }}>
                <IconBack /> Back
              </button>
              <button className="btn-delete" onClick={() => { setEntryToDelete(readEntry); setShowDeleteModal(true); }}>
                🗑️ ลบ
              </button>
            </div>

            <div className="read-layout">
              {/* LEFT: Past Entry */}
              <div className="glass-panel read-card past-card">
                <div className="read-card-header">
                  <span className="read-label">📜 Your Past Self</span>
                  <span className="read-date">{new Date(readEntry.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className="read-title">{readEntry.title}</h2>
                <div className="read-content">
                  {readEntry.content}
                </div>
              </div>

              {/* RIGHT: Reflection */}
              <div className="glass-panel read-card reflection-card">
                <div className="read-card-header">
                  <span className="read-label">💭 Reflection</span>
                </div>

                <div className="reflection-prompts">
                  <p>• ตอนนี้รู้สึกยังไงกับเรื่องนั้น?</p>
                  <p>• แก้ได้หรือยัง?</p>
                  <p>• มันไม่ได้แย่อย่างที่คิดใช่ไหม?</p>
                </div>

                <textarea
                  className="reflection-input"
                  placeholder="เขียนสิ่งที่อยากบอกตัวเองในอดีต..."
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                ></textarea>

                <div className="response-section">
                  <p className="response-label">เลือกสถานะของคุณ:</p>
                  <div className="response-options">
                    <label className={`response-option ${selectedStatus === 'over_it' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="status"
                        value="over_it"
                        checked={selectedStatus === 'over_it'}
                        onChange={() => setSelectedStatus('over_it')}
                      />
                      <span className="response-icon">✅</span>
                      <div>
                        <span className="response-title">เรื่องจิ๊บจ๊อย</span>
                        <span className="response-desc">Over it! ไม่ได้รู้สึกแย่แล้ว</span>
                      </div>
                    </label>

                    <label className={`response-option ${selectedStatus === 'still_dealing' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="status"
                        value="still_dealing"
                        checked={selectedStatus === 'still_dealing'}
                        onChange={() => setSelectedStatus('still_dealing')}
                      />
                      <span className="response-icon">⏳</span>
                      <div>
                        <span className="response-title">ยังสู้อยู่</span>
                        <span className="response-desc">Still dealing แต่โอเคขึ้นแล้ว (กลับมาใน 12 ชม.)</span>
                      </div>
                    </label>

                    <label className={`response-option ${selectedStatus === 'need_help' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="status"
                        value="need_help"
                        checked={selectedStatus === 'need_help'}
                        onChange={() => setSelectedStatus('need_help')}
                      />
                      <span className="response-icon">🆘</span>
                      <div>
                        <span className="response-title">ไม่ไหวช่วยด้วย</span>
                        <span className="response-desc">Need help ยังเครียดมาก (กลับมาใน 6 ชม.)</span>
                      </div>
                    </label>
                  </div>

                  <button
                    className="btn-primary submit-btn"
                    onClick={handleSubmitReflection}
                    disabled={!selectedStatus || isSubmitting}
                  >
                    {isSubmitting ? 'กำลังประมวลผล...' : 'ส่งคำตอบ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* AI Result Modal */}
        {showResultModal && (
          <div className="modal-overlay" onClick={closeResultAndGoBack}>
            <div className="modal-content glass-panel ai-result-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-icon">🤖</div>
              <h3>จากใจ AI</h3>
              <div className="ai-response-text">
                {aiResponse}
              </div>

              {selectedStatus === 'need_help' && (
                <div className="help-resources">
                  <div className="help-item">
                    <span>📞</span>
                    <div>
                      <strong>สายด่วนสุขภาพจิต</strong>
                      <p>1323 (24 ชั่วโมง)</p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedStatus === 'still_dealing' || selectedStatus === 'need_help') && (
                <p className="timer-note">
                  ⏰ เราจะกลับมาเช็คอีกครั้งใน {selectedStatus === 'need_help' ? '6' : '12'} ชั่วโมง
                </p>
              )}

              <button className="btn-primary" onClick={closeResultAndGoBack}>
                ขอบคุณนะ 💛
              </button>
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelpModal && (
          <div className="modal-overlay" onClick={() => { setShowHelpModal(false); setView('dashboard'); setReadEntry(null); }}>
            <div className="modal-content glass-panel help-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-icon">🤗</div>
              <h3>เราอยู่ตรงนี้นะ</h3>
              <p>ถ้ารู้สึกหนักมาก ลองหายใจเข้าลึกๆ หรือติดต่อขอความช่วยเหลือ</p>

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

              <div className="breathing-exercise">
                <h4>🌬️ ลองหายใจตามนี้</h4>
                <p>หายใจเข้า 4 วินาที → กลั้น 4 วินาที → หายใจออก 4 วินาที</p>
              </div>

              <p className="help-timer-note">เราจะกลับมาเช็คอีกครั้งใน 6 ชั่วโมง 💛</p>

              <button className="btn-primary" onClick={() => { setShowHelpModal(false); setView('dashboard'); setReadEntry(null); }}>
                ขอบคุณนะ
              </button>
            </div>
          </div>
        )}

        {/* Encouragement Modal */}
        {showEncourageModal && (
          <div className="modal-overlay" onClick={() => { setShowEncourageModal(false); setView('dashboard'); setReadEntry(null); }}>
            <div className="modal-content glass-panel encourage-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-icon">💪</div>
              <h3>สู้ๆ นะ!</h3>
              <p>ดีใจที่รู้สึกดีขึ้นแล้ว ค่อยๆ ก้าวไปทีละนิด</p>
              <p className="encourage-timer-note">เราจะกลับมาเช็คอีกครั้งใน 12 ชั่วโมง 💛</p>
              <button className="btn-primary" onClick={() => { setShowEncourageModal(false); setView('dashboard'); setReadEntry(null); }}>
                ไปเลย!
              </button>
            </div>
          </div>
        )}

        {/* Locked Modal */}
        {lockedModalOpen && selectedEntry && (
          <div className="modal-overlay" onClick={() => setLockedModalOpen(false)}>
            <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-icon"><IconLock size={48} /></div>
              <h3>Not yet...</h3>
              <p>It's not the right time to read this yet.</p>
              <p style={{ marginTop: '0.5rem', color: 'hsl(45, 90%, 65%)' }}>Maybe you should take a deep breath first?</p>
              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setLockedModalOpen(false)}>I'll wait</button>
                <button className="btn-primary" onClick={() => {
                  handleUnlock(selectedEntry.id);
                  setLockedModalOpen(false);
                }}>I'm Ready</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && entryToDelete && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-icon">🗑️</div>
              <h3>ลบรายการนี้?</h3>
              <p>คุณแน่ใจหรือไม่ที่จะลบ "{entryToDelete.title}"?</p>
              <p style={{ marginTop: '0.5rem', color: 'hsl(0, 70%, 60%)' }}>การกระทำนี้ไม่สามารถเรียกคืนได้</p>
              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>ยกเลิก</button>
                <button className="btn-danger" onClick={handleDelete}>ลบเลย</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
