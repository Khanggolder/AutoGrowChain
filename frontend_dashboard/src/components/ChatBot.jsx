import { useState, useRef, useEffect } from 'react'
import { API } from '../config'

export default function ChatBot({ currentPage, selectedPlant }) {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Welcome! I am the AutoGrowChain AI Assistant.\nI can advise on plant care, analyze sensors, control IoT, and query blockchain.\n\nType **"help"** to get started!', source: 'system' }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bodyRef = useRef(null)

    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }, [messages])

    const send = async () => {
        if (!input.trim() || loading) return
        const userMsg = input.trim()
        setInput('')
        setMessages(m => [...m, { role: 'user', text: userMsg }])
        setLoading(true)

        try {
            const res = await fetch(`${API.DATA}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    context: { page: currentPage || 'dashboard', plant: selectedPlant || '' }
                })
            })
            const data = await res.json()
            setMessages(m => [...m, {
                role: 'bot',
                text: data.reply || 'Cannot connect to AI server.',
                source: data.source || 'unknown'
            }])
        } catch {
            setMessages(m => [...m, {
                role: 'bot',
                text: 'Cannot connect to Data Server. Check that the server is running on port 3010.',
                source: 'error'
            }])
        }
        setLoading(false)
    }

    const sourceLabel = (src) => {
        if (src === 'gemini') return 'Gemini AI'
        if (src === 'knowledge_base') return 'Knowledge Base'
        if (src === 'error') return 'Error'
        return ''
    }

    return (
        <>
            <div onClick={() => setOpen(!open)} style={{
                position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #06B6D4, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 20px rgba(6,182,212,0.4)', zIndex: 9999, transition: 'transform 0.3s',
                transform: open ? 'rotate(45deg)' : 'none', fontSize: 14, fontWeight: 800, color: '#fff'
            }}>
                {open ? 'X' : 'AI'}
            </div>

            {open && (
                <div style={{
                    position: 'fixed', bottom: 90, right: 24, width: 400, height: 540, borderRadius: 16,
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.5)', zIndex: 9998, overflow: 'hidden',
                    animation: 'slideUp 0.3s ease'
                }}>
                    <div style={{
                        padding: '16px 20px', background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                        borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>AI Assistant</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Gemini-powered | Context: {currentPage || 'Dashboard'}
                            </div>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }}></div>
                    </div>

                    <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{ maxWidth: '85%' }}>
                                    <div style={{
                                        padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                        background: m.role === 'user' ? 'linear-gradient(135deg, #06B6D4, #8B5CF6)' : 'var(--bg-secondary)',
                                        fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line', color: 'var(--text-primary)',
                                        border: m.role === 'bot' ? '1px solid var(--border-color)' : 'none'
                                    }}>
                                        {m.text.split('**').map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                                    </div>
                                    {m.source && m.role === 'bot' && m.source !== 'system' && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                                            {sourceLabel(m.source)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{
                                    padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                    fontSize: 13, color: 'var(--text-muted)', animation: 'pulse 1s infinite'
                                }}>Thinking...</div>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                            placeholder="Ask about plants, sensors, blockchain..."
                            disabled={loading}
                            style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', opacity: loading ? 0.5 : 1 }}
                        />
                        <button onClick={send} disabled={loading} style={{
                            background: 'linear-gradient(135deg, #06B6D4, #8B5CF6)', border: 'none', borderRadius: 10, width: 40, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff',
                            opacity: loading ? 0.5 : 1
                        }}>Go</button>
                    </div>
                </div>
            )}
        </>
    )
}


