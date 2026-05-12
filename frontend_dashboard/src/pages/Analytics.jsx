import { useState, useEffect } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend } from 'chart.js'
import { API } from '../config'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend)

const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } } },
    scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B', font: { size: 10 } } }
    }
}

const SCENARIOS = [
    { name: 'Maximum', area: '1.0 ha', cost: '50,000,000 VND', profit: '80,000,000 VND', roi: '160%', note: 'Ideal conditions, full investment' },
    { name: 'Medium (Recommended)', area: '0.8 ha', cost: '40,000,000 VND', profit: '55,000,000 VND', roi: '137.5%', note: 'Expand only in optimal zones (Zone D)', highlight: true },
    { name: 'Keep Current', area: '0 ha', cost: '0 VND', profit: '0 VND', roi: '0%', note: 'No expansion, maintain current operations' },
    { name: 'Scale Down', area: '-0.3 ha', cost: '0 VND', profit: '-5,000,000 VND', roi: '0%', note: 'If bad season occurs (reduce Zone C)' }
]

const TREND_COLORS = { up: '#22C55E', down: '#EF4444', stable: '#F59E0B' }
const TREND_ARROWS = { up: '\u2191', down: '\u2193', stable: '\u2194' }

export default function AnalyticsPage({ showToast }) {
    const [selectedScenario, setSelectedScenario] = useState(1)
    const [analytics, setAnalytics] = useState(null)
    const [customers, setCustomers] = useState([])
    const [expenses, setExpenses] = useState([])
    
    const [showAddCustomer, setShowAddCustomer] = useState(false)
    const [showAddExpense, setShowAddExpense] = useState(false)
    const [custForm, setCustForm] = useState({ name: '', phone: '', location: '', type: 'regular', orders_per_month: 0, expected_price: 50000 })
    const [expForm, setExpForm] = useState({ category: 'fertilizer', amount: '', description: '' })
    const [marketPrices, setMarketPrices] = useState([])
    const [marketLoading, setMarketLoading] = useState(false)
    const [marketRec, setMarketRec] = useState(null)
    const [marketCrawledAt, setMarketCrawledAt] = useState(null)
    const [aiReport, setAiReport] = useState(null)
    const [aiReportLoading, setAiReportLoading] = useState(false)

    useEffect(() => {
        const fetchAll = async () => {
            const [aRes, cRes, eRes] = await Promise.all([
                fetch(`${API.DATA}/analytics/summary`).catch(() => null),
                fetch(`${API.DATA}/customers`).catch(() => null),
                fetch(`${API.DATA}/expenses`).catch(() => null)
            ])
            if (aRes?.ok) setAnalytics(await aRes.json())
            if (cRes?.ok) setCustomers(await cRes.json())
            if (eRes?.ok) setExpenses(await eRes.json())
        }
        fetchAll()
        fetchMarketPrices()
        fetchAiReport()
    }, [])

    const fetchAiReport = async () => {
        setAiReportLoading(true)
        try {
            const res = await fetch(`${API.DATA}/ai/financial-report`)
            if (res.ok) setAiReport(await res.json())
        } catch {}
        setAiReportLoading(false)
    }

    const fetchMarketPrices = async () => {
        setMarketLoading(true)
        try {
            const res = await fetch(`${API.AI}/api/market-prices`)
            if (res.ok) {
                const data = await res.json()
                setMarketPrices(data.prices || [])
                setMarketRec({ recommendation: data.recommendation, reason: data.recommendation_reason })
                setMarketCrawledAt(data.crawled_at)
            }
        } catch {}
        setMarketLoading(false)
    }

    const submitCustomer = async () => {
        if (!custForm.name) return showToast('Name required', 'error')
        await fetch(`${API.DATA}/customers`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(custForm)
        })
        showToast('Customer added!')
        setShowAddCustomer(false)
        setCustForm({ name: '', phone: '', location: '', type: 'regular', orders_per_month: 0, expected_price: 50000 })
        const c = await fetch(`${API.DATA}/customers`).then(r => r.json())
        setCustomers(c)
        const a = await fetch(`${API.DATA}/analytics/summary`).then(r => r.json())
        setAnalytics(a)
    }

    const submitExpense = async () => {
        if (!expForm.amount) return showToast('Amount required', 'error')
        await fetch(`${API.DATA}/expenses`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...expForm, amount: parseFloat(expForm.amount) })
        })
        showToast('Expense recorded!')
        setShowAddExpense(false)
        setExpForm({ category: 'fertilizer', amount: '', description: '' })
        const e = await fetch(`${API.DATA}/expenses`).then(r => r.json())
        setExpenses(e)
        const a = await fetch(`${API.DATA}/analytics/summary`).then(r => r.json())
        setAnalytics(a)
    }

    const regularCusts = customers.filter(c => c.type === 'regular')
    const potentialCusts = customers.filter(c => c.type === 'potential')

    const monthlyData = analytics?.monthly_harvests || []
    const revenueData = {
        labels: monthlyData.map(m => m.month).reverse(),
        datasets: [
            { label: 'Harvest (g)', data: monthlyData.map(m => m.total_g).reverse(), borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4 }
        ]
    }

    const shareData = {
        labels: regularCusts.map(c => `${c.name} (${c.orders_per_month})`),
        datasets: [{
            data: regularCusts.map(c => c.orders_per_month),
            backgroundColor: ['#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#06B6D4'],
            borderWidth: 0
        }]
    }

    const expByCat = {}
    expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount })
    const expenseData = {
        labels: Object.keys(expByCat),
        datasets: [{ label: 'Expenses (VND)', data: Object.values(expByCat), backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4'], borderRadius: 6 }]
    }

    const sc = SCENARIOS[selectedScenario]
    const fmt = (n) => n ? n.toLocaleString('vi-VN') : '0'

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Business Analytics & CRM</h1>
                <p className="page-subtitle">Revenue, expenses, market prices, and customer data</p>
            </div>

            <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: '#A78BFA' }}>AI Financial Report (LLaMA 3.1)</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {aiReport?.source === 'groq_llama3' && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 600 }}>AI Generated</span>}
                        <button onClick={fetchAiReport} disabled={aiReportLoading} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#A78BFA', cursor: aiReportLoading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {aiReportLoading ? 'Generating...' : 'Refresh Report'}
                        </button>
                    </div>
                </div>
                {aiReportLoading ? (
                    <div className="empty-state"><p style={{ animation: 'pulse 1s infinite' }}>AI is analyzing your financial data...</p></div>
                ) : aiReport ? (
                    <div>
                        {aiReport.summary && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                                {[
                                    { label: 'Yield', value: `${aiReport.summary.total_yield_kg} kg`, color: '#22C55E' },
                                    { label: 'Revenue', value: `${Number(aiReport.summary.total_revenue).toLocaleString()} VND`, color: '#3B82F6' },
                                    { label: 'Expenses', value: `${Number(aiReport.summary.total_expenses).toLocaleString()} VND`, color: '#EF4444' },
                                    { label: 'Net Profit', value: `${Number(aiReport.summary.net_profit).toLocaleString()} VND`, color: Number(aiReport.summary.net_profit) >= 0 ? '#22C55E' : '#EF4444' },
                                    { label: 'Margin', value: `${aiReport.summary.profit_margin}%`, color: '#8B5CF6' },
                                    { label: 'Customers', value: aiReport.summary.customer_count, color: '#F59E0B' }
                                ].map((s, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, borderLeft: `3px solid ${s.color}` }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 16, border: '1px solid rgba(139,92,246,0.15)', fontSize: 14, lineHeight: 1.8, color: '#CBD5E1', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}>
                            {aiReport.report.split('\n').map((line, i) => {
                                if (!line.trim()) return <div key={i} style={{ height: 12 }} />;
                                if (line.startsWith('###')) return <h4 key={i} style={{ color: '#A78BFA', marginTop: 20, marginBottom: 10, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{line.replace('###', '').trim()}</h4>;
                                if (line.startsWith('##') || line.startsWith('**')) {
                                    const clean = line.replace(/[\*#]/g, '').trim();
                                    return <div key={i} style={{ color: '#F8FAFC', fontWeight: 800, fontSize: 15, marginTop: 16, marginBottom: 8, borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: 4 }}>{clean}</div>;
                                }
                                

                                const parts = line.split(/(\*\*.*?\*\*)/g);
                                return (
                                    <div key={i} style={{ marginBottom: 6 }}>
                                        {parts.map((part, j) => {
                                            if (part.startsWith('**') && part.endsWith('**')) {
                                                return <strong key={j} style={{ color: '#F1F5F9', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
                                            }
                                            return part;
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                        {aiReport.generated_at && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
                                Generated: {new Date(aiReport.generated_at).toLocaleString()} | Source: {aiReport.source}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="empty-state"><p>Click Refresh Report to generate AI financial analysis</p></div>
                )}
            </div>

            <div className="stats-grid">
                {[
                    { label: 'TOTAL YIELD', value: analytics ? `${analytics.total_yield_kg} kg` : '--', color: '#22C55E' },
                    { label: 'AVG MARKET PRICE', value: analytics ? `${fmt(analytics.avg_market_price)} VND/kg` : '--', color: '#3B82F6' },
                    { label: 'EST. REVENUE', value: analytics ? `${fmt(analytics.estimated_revenue)} VND` : '--', color: '#8B5CF6' },
                    { label: 'TOTAL EXPENSES', value: analytics ? `${fmt(analytics.total_expenses)} VND` : '--', color: '#EF4444' },
                    { label: 'CUSTOMERS', value: regularCusts.length.toString(), color: '#F59E0B' }
                ].map((c, i) => (
                    <div className="stat-card" key={i} style={{ borderTop: `3px solid ${c.color}` }}>
                        <div className="stat-card-header">
                            <span className="stat-card-label">{c.label}</span>
                        </div>
                        <div className="stat-card-value" style={{ color: c.color, fontSize: 18 }}>{c.value}</div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                    <span>Live Market Prices (AI Crawler)</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {marketCrawledAt && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updated: {new Date(marketCrawledAt).toLocaleTimeString()}</span>}
                        <button className="btn-primary" onClick={fetchMarketPrices} disabled={marketLoading} style={{ padding: '4px 12px', fontSize: 12 }}>
                            {marketLoading ? 'Crawling...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {marketRec && (
                    <div style={{
                        padding: '14px 20px', marginBottom: 16, borderRadius: 10,
                        background: marketRec.recommendation === 'HARVEST_NOW' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${marketRec.recommendation === 'HARVEST_NOW' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                background: marketRec.recommendation === 'HARVEST_NOW' ? '#22C55E' : '#F59E0B',
                                color: '#000'
                            }}>
                                {marketRec.recommendation === 'HARVEST_NOW' ? 'HARVEST NOW' : 'HOLD & WAIT'}
                            </div>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{marketRec.reason}</span>
                        </div>
                    </div>
                )}

                <div className="table-container" style={{ maxHeight: 500, overflowY: 'auto' }}>
                    <table>
                        <thead><tr><th>Product</th><th>Price</th><th>Trend</th><th>Source</th></tr></thead>
                        <tbody>
                            {marketPrices.length > 0 ? marketPrices.map((p, i) => (
                                <tr key={i}>
                                    <td><strong>{p.product}</strong></td>
                                    <td style={{ color: '#22C55E', fontWeight: 600 }}>{p.price}</td>
                                    <td>
                                        <span style={{ color: TREND_COLORS[p.trend] || '#94A3B8', fontWeight: 600 }}>
                                            {TREND_ARROWS[p.trend] || '-'} {(p.trend || 'N/A').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.source}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                    {marketLoading ? 'Fetching market data...' : 'No market data available. Start AI Server on port 8000.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="two-col">
                <div className="card">
                    <div className="card-title">Harvest by Month</div>
                    <div style={{ height: 280 }}>
                        {monthlyData.length > 0 ? <Line data={revenueData} options={chartOpts} /> : <div className="empty-state"><p>No harvest data yet</p></div>}
                    </div>
                </div>
                <div className="card">
                    <div className="card-title">Customer Orders Share</div>
                    <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {regularCusts.length > 0 ? <Doughnut data={shareData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94A3B8' } } } }} /> : <div className="empty-state"><p>No customers yet</p></div>}
                    </div>
                </div>
            </div>

            <div className="two-col">
                <div className="card">
                    <div className="card-title">Expense Breakdown</div>
                    <div style={{ height: 250 }}>
                        {expenses.length > 0 ? <Bar data={expenseData} options={chartOpts} /> : <div className="empty-state"><p>No expenses recorded</p></div>}
                    </div>
                    <button className="toggle-btn on" onClick={() => setShowAddExpense(!showAddExpense)} style={{ marginTop: 12, width: '100%' }}>Add Expense</button>
                    {showAddExpense && (
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
                            <select className="form-input" value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
                                <option value="fertilizer">Fertilizer</option><option value="pesticide">Pesticide</option><option value="water">Water</option><option value="equipment">Equipment</option><option value="seed">Seed</option><option value="labor">Labor</option><option value="other">Other</option>
                            </select>
                            <input className="form-input" type="number" placeholder="Amount (VND)" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-input" placeholder="Description" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} />
                                <button className="btn-primary" onClick={submitExpense}>Save</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-title">Regular Customers ({regularCusts.length})</div>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Name</th><th>Phone</th><th>Location</th><th>Orders/Mo</th><th>Price</th></tr></thead>
                            <tbody>
                                {regularCusts.map((c, i) => (
                                    <tr key={i}><td><strong>{c.name}</strong></td><td>{c.phone}</td><td>{c.location}</td><td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{c.orders_per_month}</td><td style={{ color: '#22C55E' }}>{fmt(c.expected_price)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {potentialCusts.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', marginBottom: 6 }}>Potential ({potentialCusts.length})</div>
                            {potentialCusts.map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 3, fontSize: 12 }}>
                                    <span>{p.name} — {p.location}</span><span style={{ color: '#22C55E' }}>{fmt(p.expected_price)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="toggle-btn on" onClick={() => setShowAddCustomer(!showAddCustomer)} style={{ marginTop: 12, width: '100%' }}>Add Customer</button>
                    {showAddCustomer && (
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <input className="form-input" placeholder="Name *" value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} />
                            <input className="form-input" placeholder="Phone" value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} />
                            <input className="form-input" placeholder="Location" value={custForm.location} onChange={e => setCustForm({ ...custForm, location: e.target.value })} />
                            <select className="form-input" value={custForm.type} onChange={e => setCustForm({ ...custForm, type: e.target.value })}>
                                <option value="regular">Regular</option><option value="potential">Potential</option>
                            </select>
                            <input className="form-input" type="number" placeholder="Orders/month" value={custForm.orders_per_month} onChange={e => setCustForm({ ...custForm, orders_per_month: parseInt(e.target.value) || 0 })} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-input" type="number" placeholder="Expected price" value={custForm.expected_price} onChange={e => setCustForm({ ...custForm, expected_price: parseFloat(e.target.value) || 0 })} />
                                <button className="btn-primary" onClick={submitCustomer}>Save</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>Expansion Simulation</div>

            <div className="two-col">
                <div className="card">
                    <div className="card-title">Scenario Comparison</div>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Scenario</th><th>Area</th><th>Cost</th><th>Profit</th><th>ROI</th></tr></thead>
                            <tbody>
                                {SCENARIOS.map((s, i) => (
                                    <tr key={i} onClick={() => setSelectedScenario(i)} style={{ cursor: 'pointer', background: selectedScenario === i ? 'rgba(59,130,246,0.1)' : 'transparent', borderLeft: selectedScenario === i ? '3px solid var(--accent-blue)' : '3px solid transparent' }}>
                                        <td><strong>{s.name}</strong></td><td>{s.area}</td><td>{s.cost}</td><td style={{ color: s.profit.includes('-') ? '#EF4444' : '#22C55E', fontWeight: 600 }}>{s.profit}</td><td>{s.roi}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, color: 'var(--accent-cyan)' }}>{sc.name}</div>
                    {[
                        { label: 'Area Change', value: sc.area },
                        { label: 'Total Cost', value: sc.cost },
                        { label: 'Additional Profit', value: sc.profit, color: sc.profit.includes('-') ? '#EF4444' : '#22C55E' },
                        { label: 'ROI', value: sc.roi, color: '#60A5FA' }
                    ].map((r, i) => (
                        <div key={i} style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>{r.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: r.color || 'var(--text-primary)' }}>{r.value}</div>
                        </div>
                    ))}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{sc.note}</div>
                </div>
            </div>
        </>
    )
}


