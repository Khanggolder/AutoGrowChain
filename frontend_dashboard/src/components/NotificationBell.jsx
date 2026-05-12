import { useState, useEffect, useRef } from 'react'
import { API } from '../config'

const TYPE_COLORS = { harvest: '#22C55E', care: '#3B82F6', inspect: '#8B5CF6', alert: '#F59E0B' }

function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const lastChecked = useRef(Date.now())
    const panelRef = useRef(null)

    const fetchNotifications = async () => {
        try {
            const res = await fetch(`${API.DATA}/notifications?limit=15`, { signal: AbortSignal.timeout(3000) })
            if (res.ok) {
                const data = await res.json()
                setNotifications(data)
                const newOnes = data.filter(n => new Date(n.created_at).getTime() > lastChecked.current).length
                setUnreadCount(prev => open ? 0 : prev + newOnes)
            }
        } catch { }
    }

    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 10000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (open) {
            setUnreadCount(0)
            lastChecked.current = Date.now()
        }
    }, [open])

    useEffect(() => {
        const handleClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
        }
        if (open) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    return (
        <div ref={panelRef} style={{ position: 'fixed', top: 18, right: 24, zIndex: 9999 }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-color)',
                    background: open ? 'var(--accent-blue)' : 'var(--bg-card)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff',
                    position: 'relative', transition: 'all 0.3s',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
                }}
            >
                N
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4, width: 20, height: 20,
                        borderRadius: '50%', background: '#EF4444', color: '#fff',
                        fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'pulse 1.5s infinite'
                    }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 52, right: 0, width: 380,
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    maxHeight: 480, overflow: 'hidden', animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>Activity Log</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {notifications.length} recent
                        </span>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                No activity recorded yet
                            </div>
                        ) : (
                            notifications.map((n, i) => (
                                <div key={i} style={{
                                    display: 'flex', gap: 12, padding: '10px 20px', alignItems: 'flex-start',
                                    borderBottom: i < notifications.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    transition: 'background 0.2s'
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                        background: `${TYPE_COLORS[n.type] || '#64748B'}20`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 800, color: TYPE_COLORS[n.type] || '#64748B',
                                        border: `1.5px solid ${TYPE_COLORS[n.type] || '#64748B'}50`
                                    }}>
                                        {(n.type || 'E')[0].toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, lineHeight: 1.4 }}>
                                            {n.event}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {n.plant_name && (
                                                <span style={{
                                                    fontSize: 10, padding: '1px 7px', borderRadius: 8,
                                                    background: 'rgba(59,130,246,0.1)', color: '#60A5FA', fontWeight: 600
                                                }}>{n.plant_name.split('\u2014')[0].trim()}</span>
                                            )}
                                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                {timeAgo(n.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


