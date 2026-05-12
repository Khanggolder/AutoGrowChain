import { useState, useEffect, useRef } from 'react'
import { Line, Doughnut, Bar, Radar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, RadialLinearScale, Filler, Tooltip, Legend } from 'chart.js'
import { API } from '../config'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, RadialLinearScale, Filler, Tooltip, Legend)

const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } } },
    scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B', font: { size: 10 } } }
    }
}

const ZONE_COLORS = {
    healthy: { fill: 'rgba(34,197,94,0.25)', stroke: '#22C55E', text: '#22C55E' },
    attention: { fill: 'rgba(245,158,11,0.25)', stroke: '#F59E0B', text: '#F59E0B' },
    critical: { fill: 'rgba(239,68,68,0.25)', stroke: '#EF4444', text: '#EF4444' },
    inactive: { fill: 'rgba(100,116,139,0.15)', stroke: '#475569', text: '#64748B' },
    'A': { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', stroke: '#22C55E' },
    'B': { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', stroke: '#3B82F6' },
    'C': { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', stroke: '#A855F7' }
}

const RenderNestedData = ({ data }) => {
    if (typeof data !== 'object' || data === null) return <span>{String(data)}</span>;
    return (
        <ul style={{ margin: 0, paddingLeft: 16, marginTop: 4 }}>
            {Object.entries(data).map(([k, v]) => (
                <li key={k} style={{ marginBottom: 4 }}>
                    <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{k.replace(/_/g, ' ')}:</strong>{' '}
                    {typeof v === 'object' && v !== null ? <RenderNestedData data={v} /> : <span style={{ color: 'var(--text-muted)' }}>{String(v)}</span>}
                </li>
            ))}
        </ul>
    );
};

function FarmMap({ zones, thermalCamera, robotPos, onZoneClick }) {
    const canvasRef = useRef(null)
    const [hoveredZone, setHoveredZone] = useState(null)
    const [tooltip, setTooltip] = useState(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !zones.length) return
        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)
        const w = rect.width, h = rect.height

        ctx.fillStyle = '#0a0e1a'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'
        ctx.lineWidth = 1
        for (let i = 0; i < 20; i++) {
            ctx.beginPath(); ctx.moveTo((w / 20) * i, 0); ctx.lineTo((w / 20) * i, h); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(0, (h / 20) * i); ctx.lineTo(w, (h / 20) * i); ctx.stroke()
        }

        zones.forEach(zone => {
            const x = (zone.x / 100) * w, y = (zone.y / 100) * h
            const zw = (zone.w / 100) * w, zh = (zone.h / 100) * h
            const colors = ZONE_COLORS[zone.status] || ZONE_COLORS.healthy
            ctx.fillStyle = colors.fill
            ctx.strokeStyle = hoveredZone === zone.id ? '#fff' : colors.stroke
            ctx.lineWidth = hoveredZone === zone.id ? 2.5 : 1.5
            const r = 8
            ctx.beginPath()
            ctx.moveTo(x + r, y); ctx.lineTo(x + zw - r, y)
            ctx.quadraticCurveTo(x + zw, y, x + zw, y + r); ctx.lineTo(x + zw, y + zh - r)
            ctx.quadraticCurveTo(x + zw, y + zh, x + zw - r, y + zh); ctx.lineTo(x + r, y + zh)
            ctx.quadraticCurveTo(x, y + zh, x, y + zh - r); ctx.lineTo(x, y + r)
            ctx.quadraticCurveTo(x, y, x + r, y)
            ctx.closePath(); ctx.fill(); ctx.stroke()
            ctx.fillStyle = colors.text
            ctx.font = 'bold 14px Inter'
            ctx.fillText(zone.name, x + 10, y + 22)
            ctx.fillStyle = '#94A3B8'
            ctx.font = '11px Inter'
            ctx.fillText(`${zone.plants.length} plants | ${zone.status.toUpperCase()}`, x + 10, y + 40)
            if (zone.alerts.length > 0) { ctx.fillStyle = '#EF4444'; ctx.font = 'bold 11px Inter'; ctx.fillText(`${zone.alerts.length} alert(s)`, x + 10, y + 56) }
        })

        const railY = h * 0.5
        ctx.setLineDash([6, 4])
        ctx.strokeStyle = 'rgba(59,130,246,0.4)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(w * 0.05, railY); ctx.lineTo(w * 0.95, railY); ctx.stroke()
        ctx.setLineDash([])

        if (robotPos) {
            const rx = (robotPos.x / 100) * w * 0.9 + w * 0.05
            ctx.fillStyle = 'rgba(59,130,246,0.2)'
            ctx.beginPath(); ctx.arc(rx, railY, 18, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = '#3B82F6'
            ctx.beginPath(); ctx.arc(rx, railY, 10, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 8px Inter'
            ctx.textAlign = 'center'
            ctx.fillText('R', rx, railY + 3)
            ctx.textAlign = 'left'
            ctx.fillStyle = '#3B82F6'
            ctx.font = '10px Inter'
            const statusText = robotPos.status === 'harvesting' ? 'HARVESTING' : robotPos.status === 'moving' ? 'MOVING' : 'IDLE'
            ctx.fillText(statusText, rx - 20, railY - 22)
        }

        if (thermalCamera) {
            const mode = thermalCamera.mode === 'night_active' ? 'ACTIVE' : 'STANDBY'
            const modeColor = thermalCamera.mode === 'night_active' ? '#EF4444' : '#22C55E'
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(w - 200, h - 60, 190, 50)
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'
            ctx.strokeRect(w - 200, h - 60, 190, 50)
            ctx.fillStyle = '#94A3B8'; ctx.font = '10px Inter'; ctx.fillText('THERMAL CAMERA', w - 190, h - 44)
            ctx.fillStyle = modeColor; ctx.font = 'bold 12px Inter'; ctx.fillText(mode, w - 190, h - 28)
            ctx.fillStyle = '#64748B'; ctx.font = '10px Inter'
            ctx.fillText(`Rodents: ${thermalCamera.rodent_detections_24h} | Equip: ${thermalCamera.equipment_alerts}`, w - 190, h - 16)
        }
    }, [zones, hoveredZone, thermalCamera, robotPos])

    const handleMouse = (e) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left, my = e.clientY - rect.top
        const w = rect.width, h = rect.height
        let found = null
        zones.forEach(zone => {
            const x = (zone.x / 100) * w, y = (zone.y / 100) * h
            const zw = (zone.w / 100) * w, zh = (zone.h / 100) * h
            if (mx >= x && mx <= x + zw && my >= y && my <= y + zh) found = zone
        })
        setHoveredZone(found ? found.id : null)
        if (found) setTooltip({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 10, zone: found })
        else setTooltip(null)
    }

    return (
        <div style={{ position: 'relative' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 360, display: 'block', borderRadius: 12, cursor: hoveredZone ? 'pointer' : 'default' }}
                onMouseMove={handleMouse} onMouseLeave={() => { setHoveredZone(null); setTooltip(null) }}
                onClick={() => hoveredZone && onZoneClick && onZoneClick(hoveredZone)} />
            {tooltip && (
                <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, background: 'rgba(17,24,39,0.95)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#e2e8f0', pointerEvents: 'none', zIndex: 10, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.zone.name}</div>
                    <div>Status: <span style={{ color: ZONE_COLORS[tooltip.zone.status]?.text }}>{tooltip.zone.status}</span></div>
                    <div>Plants: {tooltip.zone.plants.length}</div>
                    {tooltip.zone.alerts.length > 0 && (
                        <div style={{ marginTop: 4, color: '#EF4444' }}>{tooltip.zone.alerts.slice(0, 2).map((a, i) => <div key={i}>- {a}</div>)}</div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function DashboardPage({ showToast }) {
    const [sensors, setSensors] = useState(null)
    const [espOnline, setEspOnline] = useState(false)
    const [counts, setCounts] = useState(null)
    const [products, setProducts] = useState([])
    const [sensorHistory, setSensorHistory] = useState([])
    const [plants, setPlants] = useState([])
    const [waterWeekly, setWaterWeekly] = useState([])
    const [analytics, setAnalytics] = useState(null)
    const [farmZones, setFarmZones] = useState([])
    const [thermalCamera, setThermalCamera] = useState(null)
    const [advisor, setAdvisor] = useState(null)
    const [robotPos, setRobotPos] = useState({ x: 30, zone: 'A', status: 'idle' })
    const [dashTab, setDashTab] = useState('overview')

    useEffect(() => {
        const fetchSensors = async () => {
            try {
                const res = await fetch(`${API.ESP}/api/sensors`, { signal: AbortSignal.timeout(3000) })
                if (res.ok) {
                    const d = await res.json()
                    setSensors(d)
                    setEspOnline(true)
                    setSensorHistory(h => [...h.slice(-19), { ...d, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
                    fetch(`${API.DATA}/sensors/log`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ humidity: d.humidity, soil_moisture: d.humidity, ph: d.ph, rain: d.rain, distance: d.distance, water_level: d.water })
                    }).catch(() => { })
                } else {
                    throw new Error('ESP Offline')
                }
            } catch {
                setEspOnline(false)


                const t = Date.now() / 5000;
                const simD = {
                    humidity: parseFloat((65 + 10 * Math.sin(t)).toFixed(1)),
                    water: parseFloat((70 + 5 * Math.cos(t * 0.8)).toFixed(1)),
                    ph: parseFloat((6.5 + 0.3 * Math.sin(t * 1.2)).toFixed(2)),
                    distance: parseFloat((25 + 2 * Math.cos(t * 0.5)).toFixed(1)),
                    rain: Math.random() > 0.8 ? Math.floor(Math.random() * 200) : 0
                };

                setSensors(simD)
                setSensorHistory(h => [...h.slice(-19), { ...simD, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
            }
        }
        fetchSensors()
        const iv = setInterval(fetchSensors, 5000)
        return () => clearInterval(iv)
    }, [])

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [cRes, pRes, plantRes, waterRes, analyticsRes, zoneRes] = await Promise.all([
                    fetch(`${API.TPL}/counts`).catch(() => null),
                    fetch(`${API.SUPPLY}/products`).catch(() => null),
                    fetch(`${API.DATA}/plants`).catch(() => null),
                    fetch(`${API.DATA}/water/weekly`).catch(() => null),
                    fetch(`${API.DATA}/analytics/summary`).catch(() => null),
                    fetch(`${API.DATA}/farm-zones`).catch(() => null)
                ])
                if (cRes?.ok) setCounts(await cRes.json())
                if (pRes?.ok) { const d = await pRes.json(); setProducts(d.products || []) }
                if (plantRes?.ok) setPlants(await plantRes.json())
                if (waterRes?.ok) setWaterWeekly(await waterRes.json())
                if (analyticsRes?.ok) setAnalytics(await analyticsRes.json())
                if (zoneRes?.ok) {
                    const zd = await zoneRes.json()
                    setFarmZones(zd.zones || [])
                    setThermalCamera(zd.thermal_camera || null)
                }
            } catch { }
        }
        fetchAll()
        fetch(`${API.AI}/api/ai/strategic-advice`).then(r => r.ok ? r.json() : null).then(d => { if (d) setAdvisor(d) }).catch(() => { })
        fetch(`${API.DATA}/robot/position`).then(r => r.ok ? r.json() : null).then(d => { if (d) setRobotPos(d) }).catch(() => { })
    }, [])

    useEffect(() => {
        const iv = setInterval(() => {
            fetch(`${API.DATA}/robot/position`).then(r => r.ok ? r.json() : null).then(d => { if (d) setRobotPos(d) }).catch(() => { })
        }, 3000)
        return () => clearInterval(iv)
    }, [])

    const sensorCards = [
        { label: 'SOIL HUMIDITY', value: sensors?.humidity, unit: '%', color: '#06B6D4' },
        { label: 'WATER LEVEL', value: sensors?.water, unit: '%', color: '#3B82F6' },
        { label: 'PH LEVEL', value: sensors?.ph, unit: 'pH', color: '#22C55E' },
        { label: 'CO2 LEVEL', value: sensors ? Math.round(400 + (sensors.rain || 0) * 0.5) : undefined, unit: 'ppm', color: '#F59E0B' },
        { label: 'DISTANCE', value: sensors?.distance, unit: 'cm', color: '#A855F7' }
    ]

    const trendData = {
        labels: sensorHistory.map(s => s.time),
        datasets: [
            { label: 'Soil Humidity (%)', data: sensorHistory.map(s => s.humidity), borderColor: '#06B6D4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
            { label: 'pH Level', data: sensorHistory.map(s => s.ph), borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
            { label: 'Water Level (%)', data: sensorHistory.map(s => s.water), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 2 }
        ]
    }

    const healthCounts = { Good: 0, 'Needs Attention': 0, Critical: 0 }
    plants.forEach(p => { healthCounts[p.health] = (healthCounts[p.health] || 0) + 1 })
    const healthData = { labels: Object.keys(healthCounts), datasets: [{ data: Object.values(healthCounts), backgroundColor: ['#22C55E', '#F59E0B', '#EF4444'], borderWidth: 0 }] }

    const waterData = {
        labels: waterWeekly.length > 0 ? waterWeekly.map(w => w.day_name) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ label: 'Water Consumption (ml)', data: waterWeekly.length > 0 ? waterWeekly.map(w => w.total_ml) : [0, 0, 0, 0, 0, 0, 0], backgroundColor: ['rgba(6,182,212,0.7)', 'rgba(59,130,246,0.7)', 'rgba(34,197,94,0.7)', 'rgba(245,158,11,0.7)', 'rgba(168,85,247,0.7)', 'rgba(236,72,153,0.7)', 'rgba(14,165,233,0.7)'], borderRadius: 6 }]
    }

    const nutrientData = {
        labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'Calcium (Ca)', 'Micronutrients'],
        datasets: plants.slice(0, 3).map((p, i) => {
            const colors = ['#22C55E', '#3B82F6', '#F59E0B']
            const base = p.health === 'Good' ? 75 : p.health === 'Needs Attention' ? 55 : 40
            const variance = () => base + Math.floor(Math.random() * 20 - 10)
            return { label: p.name.split('—')[0].trim(), data: [variance(), variance(), variance(), variance(), variance()], backgroundColor: `${colors[i]}20`, borderColor: colors[i], pointBackgroundColor: colors[i] }
        })
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Dashboard Overview</h1>
                <p className="page-subtitle">
                    <span className="status-dot online"></span>
                    ESP32 Online | Real-time sensor monitoring
                    {analytics && <> | Total yield: <strong>{analytics.total_yield_kg} kg</strong></>}
                </p>
            </div>

            <div className="diag-tabs" style={{ marginBottom: 20 }}>
                <button className={`diag-tab ${dashTab === 'overview' ? 'active' : ''}`} onClick={() => setDashTab('overview')}>Overview</button>
                <button className={`diag-tab ${dashTab === 'history' ? 'active' : ''}`} onClick={() => setDashTab('history')}>History</button>
            </div>

            {dashTab === 'overview' ? (
                <>
                    {advisor && (
                        <div className="card advisor-card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <div className="card-title" style={{ color: '#60A5FA' }}>
                                AI Strategic Advisor {advisor.is_cached && <span style={{ fontSize: 10, background: '#333', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>Cached</span>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                                <div style={{ padding: 16, background: 'rgba(34,197,94,0.08)', borderRadius: 12, borderLeft: '3px solid #22C55E' }}>
                                    <div style={{ fontSize: 11, color: '#22C55E', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Harvest Prediction</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {typeof advisor.harvest_prediction === 'string' ? advisor.harvest_prediction : <RenderNestedData data={advisor.harvest_prediction} />}
                                    </div>
                                </div>
                                <div style={{ padding: 16, background: 'rgba(245,158,11,0.08)', borderRadius: 12, borderLeft: '3px solid #F59E0B' }}>
                                    <div style={{ fontSize: 11, color: '#F59E0B', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Market Advice</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {typeof advisor.market_advice === 'string' ? advisor.market_advice : <RenderNestedData data={advisor.market_advice} />}
                                    </div>
                                </div>
                                <div style={{ padding: 16, background: 'rgba(139,92,246,0.08)', borderRadius: 12, borderLeft: '3px solid #8B5CF6' }}>
                                    <div style={{ fontSize: 11, color: '#8B5CF6', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Reinvestment Tip</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {typeof advisor.reinvestment_tip === 'string' ? advisor.reinvestment_tip : <RenderNestedData data={advisor.reinvestment_tip} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="stats-grid">
                        {sensorCards.map((c, i) => (
                            <div className="stat-card" key={i} style={{ borderTop: `3px solid ${c.color}` }}>
                                <div className="stat-card-header"><span className="stat-card-label">{c.label}</span></div>
                                <div className="stat-card-value" style={{ color: c.color }}>{c.value !== undefined ? c.value : '--'} <span style={{ fontSize: 14, opacity: 0.6 }}>{c.unit}</span></div>
                            </div>
                        ))}
                    </div>

                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title">Sensor Trends (Real-time)</div>
                        <div style={{ height: 280 }}>
                            {sensorHistory.length > 1 ? <Line data={trendData} options={chartOptions} /> : <div className="empty-state"><p>Waiting for sensor data... {espOnline ? '' : '(ESP32 offline)'}</p></div>}
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title" style={{ justifyContent: 'space-between' }}>
                            <span>Greenhouse Farm Map (2D)</span>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                                {Object.entries(ZONE_COLORS).map(([key, val]) => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 3, background: val.stroke }}></div>
                                        <span style={{ color: '#94A3B8', textTransform: 'capitalize' }}>{key}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }}></div>
                                    <span style={{ color: '#94A3B8' }}>Robot</span>
                                </div>
                            </div>
                        </div>
                        {farmZones.length > 0 ? (
                            <FarmMap zones={farmZones} thermalCamera={thermalCamera} robotPos={robotPos} onZoneClick={(id) => showToast(`Selected ${id}`)} />
                        ) : (
                            <div className="empty-state" style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Loading farm zone data...</p></div>
                        )}
                    </div>

                    <div className="two-col">
                        <div className="card">
                            <div className="card-title">Plant Health Status ({plants.length} plants)</div>
                            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Doughnut data={healthData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94A3B8', font: { family: 'Inter' } } } } }} />
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-title">Water Consumption (Weekly)</div>
                            <div style={{ height: 250 }}><Bar data={waterData} options={chartOptions} /></div>
                        </div>
                    </div>

                    <div className="two-col">
                        <div className="card">
                            <div className="card-title">Nutrient Comparison (N-P-K-Ca-Micro)</div>
                            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Radar data={nutrientData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#94A3B8', font: { size: 11 } }, ticks: { display: false }, suggestedMin: 0, suggestedMax: 100 } }, plugins: { legend: { labels: { color: '#94A3B8' } } } }} />
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-title">Blockchain Stats and System</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                {[
                                    { label: 'IoT Logs', value: counts?.iotData ?? '--' },
                                    { label: 'Contributions', value: counts?.contributions ?? '--' },
                                    { label: 'Backup Data', value: counts?.backupData ?? '--' },
                                    { label: 'Products', value: products.length }
                                ].map((s, i) => (
                                    <div key={i} style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {['ESP32 IoT > :80 (WiFi AP)', 'AI Vision (FastAPI) > :8000', 'Supply Chain API > :3000', 'TPL Data API > :3005', 'Data API (SQLite) > :3010', 'Dashboard (Vite) > :5173'].map((s, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: i % 2 === 0 ? 'var(--bg-secondary)' : 'transparent', borderRadius: 6, marginBottom: 2 }}>
                                        <span>{s.split('>')[0]}</span><code style={{ color: 'var(--accent-cyan)' }}>{s.split('>')[1]}</code>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title">Sensor History (Last 20 readings)</div>
                        <div style={{ height: 300 }}>
                            {sensorHistory.length > 1 ? <Line data={trendData} options={chartOptions} /> : <div className="empty-state"><p>Waiting for sensor data...</p></div>}
                        </div>
                    </div>
                    <div className="two-col">
                        <div className="card">
                            <div className="card-title">Plant Health Status</div>
                            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Doughnut data={healthData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94A3B8' } } } }} />
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-title">Water Usage This Week</div>
                            <div style={{ height: 250 }}><Bar data={waterData} options={chartOptions} /></div>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}


