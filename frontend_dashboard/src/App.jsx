import { useState } from 'react'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/Dashboard'
import AIDiagnosticsPage from './pages/AIDiagnostics'
import OperationsCenterPage from './pages/OperationsCenter'
import SupplyChainPage from './pages/SupplyChain'
import DataLogsPage from './pages/DataLogs'
import AnalyticsPage from './pages/Analytics'
import PlantDetailPage from './pages/PlantDetail'
import MarketplacePage from './pages/Marketplace'
import ChatBot from './components/ChatBot'
import NotificationBell from './components/NotificationBell'

const PAGES = {
    dashboard: { component: DashboardPage, label: 'Dashboard' },
    plants: { component: PlantDetailPage, label: 'Plant Details' },
    marketplace: { component: MarketplacePage, label: 'Tree Marketplace' },
    operations: { component: OperationsCenterPage, label: 'Operations Center' },
    analytics: { component: AnalyticsPage, label: 'Business Analytics' },
    supply: { component: SupplyChainPage, label: 'Supply Chain' },
    logs: { component: DataLogsPage, label: 'Data Logs' },
    ai: { component: AIDiagnosticsPage, label: 'AI Diagnostics' }
}

export default function App() {
    const [currentPage, setCurrentPage] = useState(() => {
        return window.location.hash.startsWith('#trace') ? 'plants' : 'dashboard'
    })
    const [toast, setToast] = useState(null)

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleNavigate = (page) => {
        setCurrentPage(page)
    }

    const PageComponent = PAGES[currentPage].component
    const isPublicTrace = window.location.hash.startsWith('#trace')

    if (isPublicTrace) {
        return (
            <div style={{ background: 'var(--bg-main)', minHeight: '100vh', padding: '20px' }}>
                <PageComponent showToast={showToast} isPublicTrace={true} />
                {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
            </div>
        )
    }

    return (
        <div className="app-layout">
            <Sidebar
                pages={PAGES}
                currentPage={currentPage}
                onNavigate={handleNavigate}
            />
            <main className="main-content">
                <PageComponent showToast={showToast} />
            </main>
            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}
            <ChatBot currentPage={currentPage} />
            <NotificationBell />
        </div>
    )
}


