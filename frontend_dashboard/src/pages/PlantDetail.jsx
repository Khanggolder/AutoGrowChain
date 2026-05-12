import { useState, useEffect, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { API } from '../config'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const HEALTH_COLORS = { 'Good': '#22C55E', 'Needs Attention': '#F59E0B', 'Critical': '#EF4444' }
const TYPE_COLORS = { harvest: '#22C55E', care: '#3B82F6', inspect: '#8B5CF6', alert: '#F59E0B' }

function CameraView({ canvasRef, health, mode }) {
    const videoRef = useRef(null);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        let pc = null;
        let ws = null;
        let video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        videoRef.current = video;

        const startWebRTC = async () => {
            try {
                const clientId = 'viewer_' + Math.random().toString(36).substr(2, 9);
                ws = new WebSocket(`${API.AI.replace('http', 'ws')}/stream/ws/garden/${clientId}`);

                ws.onopen = () => {
                    ws.send(JSON.stringify({ type: 'join_as_viewer' }));
                };

                ws.onmessage = async (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'offer') {
                        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

                        pc.ontrack = (e) => {
                            if (e.track.kind === 'video') {
                                video.srcObject = e.streams[0];
                                video.onloadedmetadata = () => {
                                    setIsLive(true);
                                    video.play();
                                };
                            }
                        };

                        pc.onicecandidate = (e) => {
                            if (e.candidate) {
                                ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
                            }
                        };

                        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
                    } else if (data.type === 'candidate') {
                        await pc?.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                };

                ws.onerror = () => setIsLive(false);
                ws.onclose = () => setIsLive(false);

            } catch (err) {
                console.error("WebRTC Error:", err);
                setIsLive(false);
            }
        };

        startWebRTC();

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const staticImg = new Image();
        staticImg.src = mode === 'thermal' ? '/9.png' : '/8.png';

        let animId, frame = 0;

        const draw = () => {
            frame++;
            const w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            if (isLive && video.readyState >= 2) {
                ctx.drawImage(video, 0, 0, w, h);
            } else if (staticImg.complete) {
                ctx.drawImage(staticImg, 0, 0, w, h);
            } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, w, h);
            }


            if (mode === 'thermal') {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                ctx.fillRect(0, 0, w, h);
                if (isLive) {
                    ctx.globalCompositeOperation = 'screen';
                    ctx.fillStyle = 'rgba(255, 100, 0, 0.05)';
                    ctx.fillRect(0, 0, w, h);
                    ctx.globalCompositeOperation = 'source-over';
                }
            } else {
                ctx.fillStyle = 'rgba(0, 255, 128, 0.03)';
                ctx.fillRect(0, 0, w, h);
            }


            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);


            ctx.strokeStyle = mode === 'thermal' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(20, 20, w - 40, h - 40);

            ctx.fillStyle = mode === 'thermal' ? '#EF4444' : '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`STREAM: ${isLive ? 'LIVE_WEB_RTC' : 'LOCAL_BACKUP'}`, 35, 45);
            ctx.fillText(`MODE: ${mode.toUpperCase()}`, 35, 60);
            ctx.fillText(new Date().toLocaleTimeString(), 35, 75);
            ctx.fillText(`SIGNAL: ${isLive ? 'STABLE' : 'SCANNING...'}`, 35, 90);
            if (!isLive) ctx.fillText(`ERR: NO_SIGNAL_DETECTED`, 35, 105);

            if (frame % 60 < 30) {
                ctx.fillStyle = isLive ? '#22C55E' : '#ff4d4d';
                ctx.beginPath(); ctx.arc(w - 45, 45, 5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = isLive ? '#22C55E' : (mode === 'thermal' ? '#EF4444' : '#fff');
            ctx.fillText(isLive ? 'CONNECTED' : 'DISCONNECTED', w - 125, 50);

            animId = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(animId);
            ws?.close();
            pc?.close();
            video.srcObject = null;
        };
    }, [canvasRef, health, mode, isLive]);

    return null;
}

export default function PlantDetailPage({ showToast, isPublicTrace }) {
    const [plants, setPlants] = useState([])
    const [selectedPlant, setSelectedPlant] = useState(0)
    const [detail, setDetail] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showAddHarvest, setShowAddHarvest] = useState(false)
    const [showAddActivity, setShowAddActivity] = useState(false)
    const [harvestForm, setHarvestForm] = useState({ weight_g: '', fruits_count: '', batch_id: '' })
    const [activityForm, setActivityForm] = useState({ event: '', type: 'care' })
    const [actionLoading, setActionLoading] = useState(false)
    const [nftOwner, setNftOwner] = useState(null)
    const [cameraActive, setCameraActive] = useState(false)
    const [cameraMode, setCameraMode] = useState('normal')
    const [showHarvestVideo, setShowHarvestVideo] = useState(false)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)

    useEffect(() => {
        fetch(`${API.DATA}/plants`).then(r => r.json()).then(d => {
            setPlants(d)


            const hash = window.location.hash
            if (hash.startsWith('#trace/')) {
                const targetId = parseInt(hash.split('/')[1])
                if (!isNaN(targetId)) {
                    const idx = d.findIndex(p => p.id === targetId)
                    if (idx !== -1) setSelectedPlant(idx)
                }
            }

            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (plants.length === 0) return
        const plantId = plants[selectedPlant]?.id
        if (!plantId) return
        fetch(`${API.DATA}/plants/${plantId}`)
            .then(r => r.json())
            .then(d => setDetail(d))
            .catch(() => { })
    }, [selectedPlant, plants])

    useEffect(() => {
        if (plants.length === 0) return
        const plantId = plants[selectedPlant]?.id
        if (!plantId) return
        fetch(`${API.DATA}/nft/owner/${plantId}`)
            .then(r => r.json())
            .then(d => setNftOwner(d.owned ? d : null))
            .catch(() => setNftOwner(null))
    }, [selectedPlant, plants])

    const submitHarvest = async () => {
        if (!harvestForm.weight_g) return showToast('Weight is required', 'error')
        const plantId = plants[selectedPlant]?.id
        await fetch(`${API.DATA}/harvests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plant_id: plantId, ...harvestForm, weight_g: parseFloat(harvestForm.weight_g), fruits_count: parseInt(harvestForm.fruits_count) || 0 })
        })
        showToast('Harvest recorded!')
        setShowAddHarvest(false)
        setHarvestForm({ weight_g: '', fruits_count: '', batch_id: '' })
        const d = await fetch(`${API.DATA}/plants/${plantId}`).then(r => r.json())
        setDetail(d)
        const p = await fetch(`${API.DATA}/plants`).then(r => r.json())
        setPlants(p)
    }

    const submitActivity = async () => {
        if (!activityForm.event) return showToast('Event description required', 'error')
        const plantId = plants[selectedPlant]?.id
        await fetch(`${API.DATA}/activities`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plant_id: plantId, ...activityForm })
        })
        showToast('Activity logged!')
        setShowAddActivity(false)
        setActivityForm({ event: '', type: 'care' })
        const d = await fetch(`${API.DATA}/plants/${plantId}`).then(r => r.json())
        setDetail(d)
    }

    const executeQuickAction = async (action) => {
        if (action === 'harvest') {
            setShowHarvestVideo(true)
        }
        setActionLoading(true)
        const plantId = plants[selectedPlant]?.id
        try {
            const res = await fetch(`${API.DATA}/actions/quick`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plant_id: plantId, action })
            })
            const data = await res.json()
            if (data.success) {
                showToast(data.event)
                const d = await fetch(`${API.DATA}/plants/${plantId}`).then(r => r.json())
                setDetail(d)
                const p = await fetch(`${API.DATA}/plants`).then(r => r.json())
                setPlants(p)
            } else {
                showToast('Action failed', 'error')
            }
        } catch {
            showToast('Server not connected', 'error')
        }
        setActionLoading(false)
    }

    const updatePlantHealth = async (health) => {
        const plantId = plants[selectedPlant]?.id
        await fetch(`${API.DATA}/plants/${plantId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ health })
        })
        showToast(`Health updated to: ${health}`)
        const p = await fetch(`${API.DATA}/plants`).then(r => r.json())
        setPlants(p)
    }

    if (loading) return <div className="empty-state"><p>Loading plants...</p></div>
    if (plants.length === 0) return <div className="empty-state"><p>No plants found. Start Data Server first (port 3010).</p></div>

    const plant = plants[selectedPlant]
    const hc = HEALTH_COLORS[plant?.health] || '#64748B'

    const harvests = detail?.harvests || []
    const harvestsByMonth = {}
    harvests.forEach(h => {
        const month = h.harvested_at?.substring(0, 7) || 'unknown'
        harvestsByMonth[month] = (harvestsByMonth[month] || 0) + h.weight_g
    })
    const months = Object.keys(harvestsByMonth).sort()

    const growthChartData = {
        labels: months.length > 0 ? months : ['No data'],
        datasets: [{
            label: `${plant.name} Yield (g)`, data: months.map(m => harvestsByMonth[m]),
            borderColor: hc, backgroundColor: `${hc}20`, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: hc
        }]
    }

    const compareData = {
        labels: months.length > 0 ? months : ['No data'],
        datasets: plants.map((p, i) => {
            const c = HEALTH_COLORS[p.health] || '#64748B'
            return { label: p.name.split('\u2014')[0].trim(), data: months.map(() => p.total_yield / Math.max(months.length, 1)), borderColor: c, tension: 0.4, pointRadius: 2, borderWidth: selectedPlant === i ? 3 : 1, borderDash: selectedPlant === i ? [] : [5, 5] }
        })
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">{isPublicTrace ? 'Verified Traceability Report' : 'Plant Details'}</h1>
                <p className="page-subtitle">
                    <span className="status-dot online"></span>
                    ESP32 Online | Real-time sensor monitoring
                </p>
            </div>

            {!isPublicTrace && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    {plants.map((p, i) => (
                        <button key={i} onClick={() => setSelectedPlant(i)} style={{
                            flex: 1, padding: '16px 20px', borderRadius: 12, border: `2px solid ${selectedPlant === i ? HEALTH_COLORS[p.health] || '#64748B' : 'var(--border-color)'}`,
                            background: selectedPlant === i ? `${HEALTH_COLORS[p.health]}15` : 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.3s',
                            transform: selectedPlant === i ? 'translateY(-2px)' : 'none', boxShadow: selectedPlant === i ? `0 4px 16px ${HEALTH_COLORS[p.health]}30` : 'none'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name.split('\u2014')[0]}</span>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${HEALTH_COLORS[p.health]}20`, color: HEALTH_COLORS[p.health] }}>{p.health}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'left' }}>Stage: {p.stage} | Yield: {p.total_yield}g | Fruits: {p.total_fruits}</div>
                        </button>
                    ))}
                </div>
            )}

            <div className="card" style={{ borderLeft: `4px solid ${hc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{plant.name}</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{plant.species}</p>
                        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 12 }}>
                            <span><span style={{ color: 'var(--text-muted)' }}>Location:</span> <strong>{plant.location}</strong></span>
                            <span><span style={{ color: 'var(--text-muted)' }}>Planted:</span> <strong>{plant.planted_date}</strong></span>
                            <span><span style={{ color: 'var(--text-muted)' }}>Watered:</span> <strong>{plant.last_watered}</strong></span>
                            <span><span style={{ color: 'var(--text-muted)' }}>Fertilized:</span> <strong>{plant.last_fertilized}</strong></span>
                        </div>
                        {!isPublicTrace && (
                            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Set health:</span>
                                {['Good', 'Needs Attention', 'Critical'].map(h => (
                                    <button key={h} onClick={() => updatePlantHealth(h)} style={{
                                        padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, border: `1px solid ${HEALTH_COLORS[h]}`,
                                        background: plant.health === h ? `${HEALTH_COLORS[h]}30` : 'transparent', color: HEALTH_COLORS[h], cursor: 'pointer'
                                    }}>{h}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {[
                            { label: 'Total Yield', value: `${plant.total_yield}g`, color: '#22C55E' },
                            { label: 'Fruits', value: plant.total_fruits, color: '#F59E0B' },
                            { label: 'Avg Weight', value: `${plant.avg_weight}g`, color: '#3B82F6' }
                        ].map((s, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--bg-secondary)', borderRadius: 12 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {!isPublicTrace && (
                <div className="card" style={{ marginBottom: 20, background: nftOwner ? 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(6,182,212,0.06))' : 'var(--bg-card)', border: nftOwner ? '1px solid rgba(6,182,212,0.2)' : '1px solid var(--border-color)' }}>
                    <div className="card-title" style={{ justifyContent: 'space-between' }}>
                        <span style={{ color: '#06B6D4', display: 'flex', alignItems: 'center', gap: 10 }}>
                            Live Camera Feed (WebRTC)
                            {cameraActive && (
                                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <button
                                        onClick={() => setCameraMode('normal')}
                                        style={{ padding: '2px 8px', fontSize: 10, borderRadius: 6, border: 'none', background: cameraMode === 'normal' ? 'rgba(6,182,212,0.2)' : 'transparent', color: cameraMode === 'normal' ? '#06B6D4' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                                    >NORMAL</button>
                                    <button
                                        onClick={() => setCameraMode('thermal')}
                                        style={{ padding: '2px 8px', fontSize: 10, borderRadius: 6, border: 'none', background: cameraMode === 'thermal' ? 'rgba(239,68,68,0.2)' : 'transparent', color: cameraMode === 'thermal' ? '#EF4444' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                                    >THERMAL</button>
                                </div>
                            )}
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {nftOwner && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 600 }}>NFT Owner: {nftOwner.renter_name}</span>}
                            <button onClick={() => setCameraActive(!cameraActive)} style={{
                                padding: '6px 14px', borderRadius: 8, border: `1px solid ${cameraActive ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.3)'}`,
                                background: cameraActive ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.1)',
                                color: cameraActive ? '#EF4444' : '#06B6D4', cursor: 'pointer', fontSize: 12, fontWeight: 600
                            }}>{cameraActive ? 'Stop Stream' : 'Start Stream'}</button>
                        </div>
                    </div>
                    {cameraActive ? (
                        <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', height: 320 }}>
                            <canvas ref={canvasRef} width={640} height={320} style={{ width: '100%', height: '100%', display: 'block' }} />
                            <CameraView canvasRef={canvasRef} health={plant.health} mode={cameraMode} />
                            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cameraMode === 'thermal' ? '#EF4444' : '#22C55E', animation: 'pulse 1s infinite' }} />
                                <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                    {cameraMode === 'thermal' ? 'NIGHT_THERMAL_ACTIVE' : 'LIVE'}
                                </span>
                            </div>
                            <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                <span>Tree #{plant.id} | {plant.location}</span>
                                <span>{new Date().toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <p>Click Start Stream to view live camera feed</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>WebRTC stream from ESP32-CAM | Low latency (&lt;0.5s)</p>
                        </div>
                    )}
                </div>
            )}

            <div className="two-col">
                <div className="card">
                    <div className="card-title">Harvest Yield by Month</div>
                    <div style={{ height: 280 }}>
                        {months.length > 0 ? (
                            <Line data={growthChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94A3B8' } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B' } } } }} />
                        ) : (
                            <div className="empty-state"><p>No harvest data yet</p></div>
                        )}
                    </div>
                </div>
                <div className="card">
                    <div className="card-title">Yield Comparison (All Plants)</div>
                    <div style={{ height: 280 }}>
                        <Line data={compareData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94A3B8' } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B' } } } }} />
                    </div>
                </div>
            </div>

            {!isPublicTrace && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-title">Quick Actions — {plant.name.split('\u2014')[0]}</div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                        Each action is automatically logged to the activity timeline and database.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                        {[
                            { action: 'water', label: 'Water (100ml)', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
                            { action: 'fertilize', label: 'Fertilize (10g)', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
                            { action: 'inspect', label: 'Inspect', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
                            { action: 'refill', label: 'Refill Tank', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
                            { action: 'pesticide', label: 'Pesticide', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
                            { action: 'harvest', label: 'Robot Harvest', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' }
                        ].map(btn => (
                            <button
                                key={btn.action}
                                onClick={() => executeQuickAction(btn.action)}
                                disabled={actionLoading}
                                style={{
                                    padding: '14px 12px', borderRadius: 12, border: `1px solid ${btn.color}40`,
                                    background: btn.bg, color: btn.color, fontSize: 13, fontWeight: 700,
                                    cursor: actionLoading ? 'not-allowed' : 'pointer', transition: 'all 0.3s',
                                    opacity: actionLoading ? 0.5 : 1
                                }}
                            >{btn.label}</button>
                        ))}
                    </div>
                </div>
            )}

            {!isPublicTrace && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <button className="btn-primary" onClick={() => setShowAddHarvest(!showAddHarvest)}>Record Harvest (manual)</button>
                    <button className="toggle-btn on" onClick={() => setShowAddActivity(!showAddActivity)}>Custom Log Entry</button>
                </div>
            )}

            {!isPublicTrace && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-title">QR Traceability — Blockchain Verified</div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${window.location.origin}/#trace/${plant.id}`)}&bgcolor=ffffff&color=000000`}
                                alt="QR Code"
                                style={{ width: 160, height: 160, display: 'block' }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Scan to verify plant history</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                                <div>All care actions are logged on <strong>PIONE Zero blockchain</strong></div>
                                <div>Immutable audit trail for organic certification</div>
                                <div>Plant ID: <strong>{plant.id}</strong> | Created: <strong>{plant.planted_date}</strong></div>
                                <div>Total activities: <strong>{detail?.activities?.length || 0}</strong> logged events</div>
                            </div>
                            <button onClick={() => {
                                const url = `${window.location.origin}/#trace/${plant.id}`
                                navigator.clipboard.writeText(url)
                                showToast('Trace URL copied to clipboard!')
                            }} style={{
                                marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)'
                            }}>Copy Trace URL</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddHarvest && (
                <div className="card" style={{ borderLeft: '4px solid #22C55E' }}>
                    <div className="card-title">Record New Harvest for {plant.name.split('\u2014')[0]}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Weight (g) *</label>
                            <input className="form-input" type="number" value={harvestForm.weight_g} onChange={e => setHarvestForm({ ...harvestForm, weight_g: e.target.value })} placeholder="e.g. 35" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fruits Count</label>
                            <input className="form-input" type="number" value={harvestForm.fruits_count} onChange={e => setHarvestForm({ ...harvestForm, fruits_count: e.target.value })} placeholder="e.g. 6" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Batch ID</label>
                            <input className="form-input" value={harvestForm.batch_id} onChange={e => setHarvestForm({ ...harvestForm, batch_id: e.target.value })} placeholder="e.g. BATCH-008" />
                        </div>
                    </div>
                    <button className="btn-primary" onClick={submitHarvest} style={{ marginTop: 8 }}>Save Harvest</button>
                </div>
            )}

            {showAddActivity && (
                <div className="card" style={{ borderLeft: '4px solid #3B82F6' }}>
                    <div className="card-title">Log Activity for {plant.name.split('\u2014')[0]}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Event Description *</label>
                            <input className="form-input" value={activityForm.event} onChange={e => setActivityForm({ ...activityForm, event: e.target.value })} placeholder="e.g. Fertilizer applied: NPK 15-15-15" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-input" value={activityForm.type} onChange={e => setActivityForm({ ...activityForm, type: e.target.value })}>
                                <option value="care">Care</option>
                                <option value="harvest">Harvest</option>
                                <option value="inspect">Inspect</option>
                                <option value="alert">Alert</option>
                            </select>
                        </div>
                    </div>
                    <button className="btn-primary" onClick={submitActivity} style={{ marginTop: 8 }}>Save Activity</button>
                </div>
            )}

            <div className="card">
                <div className="card-title">Activity Timeline ({detail?.activities?.length || 0} records)</div>
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                    <div style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: 'var(--border-color)' }} />
                    {(detail?.activities || []).map((h, i) => (
                        <div key={i} style={{ position: 'relative', marginBottom: 16, paddingLeft: 20 }}>
                            <div style={{ position: 'absolute', left: -24, top: 4, width: 24, height: 24, borderRadius: '50%', background: `${TYPE_COLORS[h.type] || '#64748B'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, border: `2px solid ${TYPE_COLORS[h.type] || '#64748B'}`, color: TYPE_COLORS[h.type] || '#64748B' }}>
                                {(h.type || 'C')[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 14 }}>{h.event}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{h.created_at?.substring(0, 16)}</span>
                            </div>
                        </div>
                    ))}
                    {(!detail?.activities || detail.activities.length === 0) && <p style={{ color: 'var(--text-muted)', paddingLeft: 8 }}>No activities recorded yet</p>}
                </div>
            </div>
            {showHarvestVideo && (
                <div
                    onClick={() => setShowHarvestVideo(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'relative', width: '85%', maxWidth: 900, background: '#111', borderRadius: 20, overflow: 'hidden', boxShadow: '0 0 60px rgba(34,197,94,0.4)', cursor: 'default' }}
                    >
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
                            <span style={{ fontWeight: 800, color: '#22C55E', letterSpacing: '0.5px' }}>ROBOT HARVESTING PROCESS — Tree #{plant.id}</span>
                            <button onClick={() => setShowHarvestVideo(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>&times;</button>
                        </div>
                        <video autoPlay controls onEnded={() => setShowHarvestVideo(false)} style={{ width: '100%', display: 'block' }}>
                            <source src="/video.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        <div style={{ padding: '14px', color: '#64748B', fontSize: 11, textAlign: 'center', background: '#0a0a0a', borderTop: '1px solid #222' }}>
                            AI Vision identifies ripe fruit • Precision arm execution • Blockchain log initiated
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}


