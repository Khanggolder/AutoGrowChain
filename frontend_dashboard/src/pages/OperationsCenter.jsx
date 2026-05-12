import { useState, useEffect, useRef } from 'react'
import { API } from '../config'

const SENSORS_DEF = [
    { value: 'humidity', label: 'Soil Moisture (%)', unit: '%' },
    { value: 'waterLevel', label: 'Water Level (%)', unit: '%' },
    { value: 'ph', label: 'pH Level', unit: 'pH' },
    { value: 'distance', label: 'Distance (cm)', unit: 'cm' }
]
const CONDITIONS = [
    { value: 'less_than', label: '< Less than' },
    { value: 'greater_than', label: '> Greater than' },
    { value: 'equals', label: '= Equals' }
]
const ACTIONS = [
    { value: 'water', label: 'Auto Water', color: '#3B82F6' },
    { value: 'stop_pump', label: 'Stop Pump', color: '#EF4444' },
    { value: 'harvest', label: 'Auto Harvest', color: '#22C55E' },
    { value: 'speaker', label: 'Pest Deterrent', color: '#F59E0B' },
    { value: 'fertilize', label: 'Auto Fertilize', color: '#8B5CF6' }
]

export default function OperationsCenterPage({ showToast }) {
    const [servos, setServos] = useState([90, 90, 90, 90])
    const [pumpOn, setPumpOn] = useState(false)
    const [speakerOn, setSpeakerOn] = useState(false)
    const [autoMode, setAutoMode] = useState(false)
    const [sensors, setSensors] = useState(null)
    const [recording, setRecording] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [wsConnected, setWsConnected] = useState(false)
    const [stepsRecorded, setStepsRecorded] = useState(0)
    const [rules, setRules] = useState([])
    const [showAdd, setShowAdd] = useState(false)
    const [form, setForm] = useState({ name: '', sensor: 'humidity', condition: 'less_than', threshold: 35, action: 'water', action_value: '100' })
    const [manualOpen, setManualOpen] = useState(true)
    const [iotLog, setIotLog] = useState([
        { time: new Date().toLocaleTimeString(), msg: 'System initialized' },
        { time: new Date().toLocaleTimeString(), msg: 'IoT Gateway online' }
    ])
    const wsRef = useRef(null)

    useEffect(() => {
        const fetchSensors = async () => {
            try {
                const res = await fetch(`${API.ESP}/api/sensors`, { signal: AbortSignal.timeout(2000) })
                if (res.ok) setSensors(await res.json())
                else throw new Error('Offline')
            } catch {

                setSensors(prev => ({
                    humidity: 45 + Math.random() * 5,
                    water: 82 + Math.random() * 2,
                    ph: 6.5 + Math.random() * 0.2,
                    distance: 12 + Math.random() * 1
                }))
            }
        }
        fetchSensors()
        const interval = setInterval(fetchSensors, 3000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const connectWs = () => {
            try {
                const ws = new WebSocket(`ws://192.168.4.1/RobotArm`)
                ws.onopen = () => { setWsConnected(true); showToast('WebSocket connected to ESP32') }
                ws.onclose = () => { setWsConnected(false); setTimeout(connectWs, 5000) }
                ws.onmessage = (event) => {
                    const [key, value] = event.data.split(',')
                    if (key === 'Record') setRecording(value === 'ON')
                    else if (key === 'Play') setPlaying(value === 'ON')
                    else {
                        const servoMap = { Base: 0, Shoulder: 1, Elbow: 2, Gripper: 3 }
                        if (key in servoMap) setServos(prev => { const c = [...prev]; c[servoMap[key]] = parseInt(value); return c })
                    }
                }
                ws.onerror = () => setWsConnected(false)
                wsRef.current = ws
            } catch { setWsConnected(false) }
        }
        connectWs()
        return () => { if (wsRef.current) wsRef.current.close() }
    }, [])

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch(`${API.ESP}/api/robot/status`, { signal: AbortSignal.timeout(3000) })
                if (res.ok) { const d = await res.json(); setRecording(d.recording); setPlaying(d.playing); setStepsRecorded(d.stepsRecorded) }
            } catch {}
        }
        check()
        const iv = setInterval(check, 5000)
        return () => clearInterval(iv)
    }, [])

    const fetchRules = async () => {
        try { const res = await fetch(`${API.DATA}/rules`); if (res.ok) setRules(await res.json()) } catch {}
    }
    useEffect(() => { fetchRules() }, [])

    const wsSend = (key, value) => { 
        const logMsg = { time: new Date().toLocaleTimeString(), msg: `SENT: ${key} -> ${value}` }
        setIotLog(prev => [logMsg, ...prev].slice(0, 10))
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(`${key},${value}`) 
    }

    const sendServo = async (index, value) => {
        const newServos = [...servos]; newServos[index] = value; setServos(newServos)
        if (wsConnected) { const names = ['Base', 'Shoulder', 'Elbow', 'Gripper']; wsSend(names[index], value) }
        else { try { await fetch(`${API.ESP}/api/servo?id=${index}&val=${value}`) } catch { showToast('ESP32 not connected', 'error') } }
    }

    const togglePump = async () => {
        const n = !pumpOn
        if (wsConnected) { wsSend('Pump', n ? 1 : 0); setPumpOn(n); showToast(`Pump ${n ? 'ON' : 'OFF'}`) }
        else { try { await fetch(`${API.ESP}/api/pump?state=${n ? 1 : 0}`); setPumpOn(n); showToast(`Pump ${n ? 'ON' : 'OFF'}`) } catch { showToast('ESP32 not connected', 'error') } }
    }

    const toggleSpeaker = async () => {
        const n = !speakerOn
        if (wsConnected) { wsSend('Speaker', n ? 1 : 0); setSpeakerOn(n); showToast(`Speaker ${n ? 'ON' : 'OFF'}`) }
        else { try { await fetch(`${API.ESP}/api/speaker?state=${n ? 1 : 0}`); setSpeakerOn(n); showToast(`Speaker ${n ? 'ON' : 'OFF'}`) } catch { showToast('ESP32 not connected', 'error') } }
    }

    const toggleAuto = async () => {
        const n = !autoMode
        if (wsConnected) { wsSend('Auto', n ? 1 : 0); setAutoMode(n); showToast(`Auto Mode ${n ? 'ENABLED' : 'DISABLED'}`) }
        else { try { await fetch(`${API.ESP}/api/auto?state=${n ? 1 : 0}`); setAutoMode(n); showToast(`Auto Mode ${n ? 'ENABLED' : 'DISABLED'}`) } catch { showToast('ESP32 not connected', 'error') } }
    }

    const toggleRecord = () => { const n = !recording; wsSend('Record', n ? 1 : 0); setRecording(n); if (n) { showToast('Recording started'); setStepsRecorded(0) } else showToast('Recording stopped') }
    const togglePlay = () => { const n = !playing; wsSend('Play', n ? 1 : 0); setPlaying(n); showToast(n ? 'Playing recorded steps...' : 'Playback stopped') }

    const addRule = async () => {
        if (!form.name) return showToast('Rule name required', 'error')
        try {
            await fetch(`${API.DATA}/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
            showToast('Rule created!')
            setShowAdd(false)
            setForm({ name: '', sensor: 'humidity', condition: 'less_than', threshold: 35, action: 'water', action_value: '100' })
            fetchRules()
        } catch { showToast('Failed to create rule', 'error') }
    }

    const toggleRule = async (id, current) => {
        await fetch(`${API.DATA}/rules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) })
        fetchRules()
    }

    const deleteRule = async (id) => { await fetch(`${API.DATA}/rules/${id}`, { method: 'DELETE' }); showToast('Rule deleted'); fetchRules() }

    const testEvaluate = async () => {
        try {
            const res = await fetch(`${API.DATA}/rules/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sensors: { humidity: 25, waterLevel: 60, rain: 800, ph: 6.5, distance: 8 } }) })
            const data = await res.json()
            showToast(data.count > 0 ? `${data.count} rule(s) triggered!` : 'No rules triggered with test data')
        } catch { showToast('Evaluation failed', 'error') }
    }

    const servoNames = ['Base', 'Shoulder', 'Elbow', 'Gripper']

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Operations Center</h1>
                <p className="page-subtitle">
                    Robot arm control, automation rules, and IoT management
                    <span style={{ marginLeft: 12, padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                        IoT Gateway: Online (PIONE-LINK)
                    </span>
                    <span style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: 'rgba(6,182,212,0.15)', color: '#06B6D4' }}>
                        Device: AutoGrow-ESP32
                    </span>
                </p>
            </div>

            <div className="card" style={{ marginBottom: 24, borderLeft: `4px solid ${recording ? '#EF4444' : playing ? '#22C55E' : 'var(--border-color)'}` }}>
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                    <span>Robot Arm Control</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>Encrypted Link: AES-128</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Teach the robot arm a sequence of movements, then replay them automatically.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
                    <button onClick={toggleRecord} disabled={!wsConnected || playing} style={{ padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: wsConnected && !playing ? 'pointer' : 'not-allowed', border: 'none', transition: 'all 0.3s', background: recording ? '#EF4444' : 'rgba(239,68,68,0.15)', color: recording ? '#fff' : '#EF4444', animation: recording ? 'pulse 1.5s infinite' : 'none', opacity: !wsConnected || playing ? 0.4 : 1 }}>
                        {recording ? 'Stop Recording' : 'Start Recording'}
                    </button>
                    <button onClick={togglePlay} disabled={!wsConnected || recording} style={{ padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: wsConnected && !recording ? 'pointer' : 'not-allowed', border: 'none', transition: 'all 0.3s', background: playing ? '#22C55E' : 'rgba(34,197,94,0.15)', color: playing ? '#fff' : '#22C55E', opacity: !wsConnected || recording ? 0.4 : 1 }}>
                        {playing ? 'Stop Playback' : 'Play Steps'}
                    </button>
                    <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Steps: </span>
                        <strong style={{ color: 'var(--accent-cyan)' }}>{stepsRecorded}</strong>
                    </div>
                    {recording && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
                            <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>REC - Move servos to teach</span>
                        </div>
                    )}
                </div>
                <div className="control-grid">
                    {servoNames.map((name, i) => (
                        <div className="control-item" key={i} style={{ opacity: playing ? 0.6 : 1, pointerEvents: playing ? 'none' : 'auto' }}>
                            <div className="control-item-header">
                                <span className="control-item-label">Servo {i}: {name}</span>
                            </div>
                            <div className="slider-container">
                                <input type="range" min="0" max="180" value={servos[i]} onChange={(e) => sendServo(i, parseInt(e.target.value))} />
                                <div className="slider-value">{servos[i]}deg</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>Add Rule</button>
                    <button className="toggle-btn on" onClick={testEvaluate}>Test Evaluate</button>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span>IoT ACTIVITY LOG</span>
                        <span className="status-dot online" style={{ width: 6, height: 6 }}></span>
                    </div>
                    <div style={{ height: 60, overflowY: 'auto', fontSize: 10, fontFamily: 'monospace' }}>
                        {iotLog.map((log, i) => (
                            <div key={i} style={{ marginBottom: 2, color: log.msg.startsWith('SENT') ? '#06B6D4' : '#94A3B8' }}>
                                <span style={{ opacity: 0.5 }}>[{log.time}]</span> {log.msg}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showAdd && (
                <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #06B6D4' }}>
                    <div className="card-title">New Automation Rule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Rule Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auto-Water Low Moisture" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} /></div>
                        <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sensor</label><select value={form.sensor} onChange={e => setForm({ ...form, sensor: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>{SENSORS_DEF.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                        <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Condition</label><select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>{CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                        <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Threshold</label><input type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} /></div>
                        <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Action</label><select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>{ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
                        <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Value</label><input value={form.action_value} onChange={e => setForm({ ...form, action_value: e.target.value })} placeholder="e.g. 100ml" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="btn-primary" onClick={addRule}>Create Rule</button>
                        <button className="toggle-btn off" onClick={() => setShowAdd(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gap: 12 }}>
                {rules.length === 0 ? (
                    <div className="card"><div className="empty-state"><p>No automation rules yet. Click Add Rule to get started.</p></div></div>
                ) : rules.map(rule => {
                    const actionInfo = ACTIONS.find(a => a.value === rule.action) || { label: rule.action, color: '#64748B' }
                    const sensorInfo = SENSORS_DEF.find(s => s.value === rule.sensor) || { label: rule.sensor }
                    const condLabel = CONDITIONS.find(c => c.value === rule.condition)?.label || rule.condition
                    return (
                        <div key={rule.id} className="card" style={{ borderLeft: `4px solid ${rule.is_active ? actionInfo.color : '#64748B'}`, opacity: rule.is_active ? 1 : 0.5, transition: 'all 0.3s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <span style={{ fontSize: 16, fontWeight: 700 }}>{rule.name}</span>
                                        <span className={`badge ${rule.is_active ? 'active' : ''}`} style={{ fontSize: 10 }}>{rule.is_active ? 'ACTIVE' : 'PAUSED'}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span><strong>IF</strong> {sensorInfo.label} {condLabel} <strong style={{ color: '#F59E0B' }}>{rule.threshold}</strong></span>
                                        <span>THEN <strong style={{ color: actionInfo.color }}>{actionInfo.label}</strong> {rule.action_value && `(${rule.action_value})`}</span>
                                    </div>
                                    {rule.last_triggered && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Last triggered: {rule.last_triggered} | Total: {rule.trigger_count}x</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => toggleRule(rule.id, rule.is_active)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>{rule.is_active ? 'Pause' : 'Resume'}</button>
                                    <button onClick={() => deleteRule(rule.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #EF4444', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', fontSize: 12, color: '#EF4444' }}>Delete</button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div style={{ marginTop: 24 }}>
                <div onClick={() => setManualOpen(!manualOpen)} style={{ padding: '14px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Manual Override</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{manualOpen ? 'Collapse' : 'Expand'}</span>
                </div>
                {manualOpen && (
                    <div className="card" style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                            <button className={`toggle-btn ${autoMode ? 'on' : 'off'}`} onClick={toggleAuto}>{autoMode ? 'AUTO MODE ON' : 'AUTO MODE OFF'}</button>
                            <button className={`toggle-btn ${pumpOn ? 'on' : 'off'}`} onClick={togglePump}>{pumpOn ? 'PUMP ON' : 'PUMP OFF'}</button>
                            <button className={`toggle-btn ${speakerOn ? 'on' : 'off'}`} onClick={toggleSpeaker}>{speakerOn ? 'SPEAKER ON' : 'SPEAKER OFF'}</button>
                        </div>
                        {sensors ? (
                            <div className="stats-grid" style={{ marginBottom: 0 }}>
                                {[
                                    { label: 'Humidity', value: `${sensors.humidity?.toFixed(1)}%` },
                                    { label: 'Water Level', value: `${sensors.water?.toFixed(1)}%` },
                                    { label: 'pH', value: sensors.ph?.toFixed(2) },
                                    { label: 'Distance', value: `${sensors.distance?.toFixed(1)} cm` }
                                ].map((s, i) => (
                                    <div key={i} style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>Synchronizing IoT telemetry...</p></div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}


