import { useState, useEffect } from 'react'
import { API } from '../config'

export default function Sidebar({ pages, currentPage, onNavigate }) {
    const [services, setServices] = useState({ ai: false, supply: false, tpl: false, data: false })

    useEffect(() => {
        const checkServices = async () => {
            const checks = {}
            try {
                const r = await fetch(`${API.AI}/api/status`, { signal: AbortSignal.timeout(3000) })
                checks.ai = r.ok
            } catch { checks.ai = false }
            try {
                const r = await fetch(`${API.SUPPLY}/info/owner`, { signal: AbortSignal.timeout(3000) })
                checks.supply = r.ok
            } catch { checks.supply = false }
            try {
                const r = await fetch(`${API.TPL}/counts`, { signal: AbortSignal.timeout(3000) })
                checks.tpl = r.ok
            } catch { checks.tpl = false }
            try {
                const r = await fetch(`${API.DATA}/plants`, { signal: AbortSignal.timeout(3000) })
                checks.data = r.ok
            } catch { checks.data = false }
            setServices(checks)
        }
        checkServices()
        const interval = setInterval(checkServices, 15000)
        return () => clearInterval(interval)
    }, [])

    const visiblePages = Object.entries(pages)

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon" style={{ background: 'var(--gradient-primary)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>AG</div>
                <span className="sidebar-logo-text">AutoGrowChain</span>
            </div>

            <nav className="sidebar-nav">
                {visiblePages.map(([key, page]) => (
                    <button
                        key={key}
                        className={`sidebar-link ${currentPage === key ? 'active' : ''}`}
                        onClick={() => onNavigate(key)}
                    >
                        {page.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-status">
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
                    Service Status
                </div>
                {[
                    { key: 'ai', label: 'AI Server :8000' },
                    { key: 'supply', label: 'Supply API :3000' },
                    { key: 'tpl', label: 'TPL API :3005' },
                    { key: 'data', label: 'Data API :3010' }
                ].map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <span className={`sidebar-status-dot ${services[s.key] ? 'online' : 'offline'}`}></span>
                        <span className="sidebar-status-text">{s.label}</span>
                    </div>
                ))}
            </div>
        </aside>
    )
}


