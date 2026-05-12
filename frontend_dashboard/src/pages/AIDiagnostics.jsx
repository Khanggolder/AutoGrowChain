import { useState, useRef, useEffect, useCallback } from 'react'
import { API } from '../config'

const SEVERITY_CONFIG = {
    'critical': { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    'high': { color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
    'medium': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    'low': { color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
    'good': { color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
    'unknown': { color: '#64748B', bg: 'rgba(100,116,139,0.12)' }
}

export default function AIDiagnosticsPage({ showToast }) {
    const [tab, setTab] = useState('vision')

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">AI Diagnostics</h1>
                <p className="page-subtitle">Plant disease analysis and audio pest detection in one place</p>
            </div>

            <div className="diag-tabs">
                <button className={`diag-tab ${tab === 'vision' ? 'active' : ''}`} onClick={() => setTab('vision')}>Vision Analysis</button>
                <button className={`diag-tab ${tab === 'audio' ? 'active' : ''}`} onClick={() => setTab('audio')}>Audio Pest Detection</button>
            </div>

            {tab === 'vision' ? <VisionTab showToast={showToast} /> : <AudioTab showToast={showToast} />}
        </>
    )
}

function VisionTab({ showToast }) {
    const [mode, setMode] = useState('upload')
    const [preview, setPreview] = useState(null)
    const [diseaseResult, setDiseaseResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [cameraActive, setCameraActive] = useState(false)
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const fileRef = useRef(null)

    const handleFileDisease = async (file) => {
        const form = new FormData()
        form.append('file', file)
        try {
            const res = await fetch(`${API.AI}/api/vision/analyze`, { method: 'POST', body: form })
            if (res.ok) {
                const data = await res.json()
                setDiseaseResult(data)
                showToast(`Disease Analysis: ${data.status} (${data.confidence})`)
            } else showToast('AI Vision Server error', 'error')
        } catch { showToast('AI Server offline', 'error') }
    }

    const handleFile = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setPreview(URL.createObjectURL(file))
        setDiseaseResult(null)
        setLoading(true)
        await handleFileDisease(file)
        setLoading(false)
    }

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            videoRef.current.srcObject = stream
            streamRef.current = stream
            setCameraActive(true)
        } catch { showToast('Camera access denied', 'error') }
    }

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        setCameraActive(false)
    }

    const captureFrame = async () => {
        if (!videoRef.current) return
        setLoading(true)
        setDiseaseResult(null)
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
        setPreview(canvas.toDataURL('image/jpeg'))
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
            await handleFileDisease(file)
            setLoading(false)
        }, 'image/jpeg')
    }

    const sevConfig = diseaseResult?.severity ? SEVERITY_CONFIG[diseaseResult.severity] || SEVERITY_CONFIG.unknown : null

    return (
        <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button className={`toggle-btn ${mode === 'upload' ? 'on' : 'off'}`} onClick={() => { setMode('upload'); stopCamera() }}>Upload Image</button>
                <button className={`toggle-btn ${mode === 'camera' ? 'on' : 'off'}`} onClick={() => setMode('camera')}>Live Camera</button>
            </div>

            <div className="two-col">
                <div>
                    <div className="card">
                        <div className="card-title">{mode === 'upload' ? 'Image Input' : 'Camera Feed'}</div>
                        {mode === 'upload' ? (
                            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', minHeight: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                {preview ? <img src={preview} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} /> : <><div style={{ fontSize: 18, marginBottom: 12, fontWeight: 800, color: 'var(--text-muted)' }}>CLICK TO UPLOAD</div><p style={{ color: 'var(--text-muted)' }}>Upload plant image for analysis</p><p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Supports: JPG, PNG, WEBP</p></>}
                                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
                            </div>
                        ) : (
                            <div>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000' }} />
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    {!cameraActive ? <button className="btn-primary" onClick={startCamera} style={{ flex: 1 }}>Start Camera</button> : <><button className="btn-primary" onClick={captureFrame} style={{ flex: 1 }}>Capture and Detect</button><button className="toggle-btn off" onClick={stopCamera}>Stop</button></>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="card" style={{ borderLeft: diseaseResult ? `4px solid ${sevConfig?.color || '#64748B'}` : '4px solid var(--border-color)' }}>
                        <div className="card-title">Tomato Disease Analysis (Faster R-CNN)</div>
                        {loading ? (
                            <div className="empty-state"><p style={{ animation: 'pulse 1s infinite' }}>Analyzing plant health with PyTorch AI...</p></div>
                        ) : diseaseResult && diseaseResult.status !== 'Error' ? (
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: 20, padding: 20, background: sevConfig?.bg || 'var(--bg-secondary)', borderRadius: 16, border: `1px solid ${sevConfig?.color || 'var(--border-color)'}22` }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Diagnosis Result</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: sevConfig?.color || 'var(--text-primary)', marginBottom: 4 }}>{diseaseResult.name || diseaseResult.status}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{diseaseResult.status}</div>
                                    <div style={{ display: 'inline-flex', gap: 12, marginTop: 12, padding: '6px 16px', background: 'var(--bg-primary)', borderRadius: 20, fontSize: 13 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Confidence:</span>
                                        <span style={{ fontWeight: 700, color: sevConfig?.color }}>{diseaseResult.confidence}</span>
                                        <span style={{ color: 'var(--border-color)' }}>|</span>
                                        <span style={{ color: 'var(--text-muted)' }}>Severity:</span>
                                        <span style={{ fontWeight: 700, color: sevConfig?.color, textTransform: 'uppercase' }}>{diseaseResult.severity}</span>
                                    </div>
                                </div>
                                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, borderLeft: `3px solid ${sevConfig?.color || '#64748B'}`, marginBottom: 16 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Treatment and Recommendation</div>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{diseaseResult.treatment}</p>
                                </div>
                                {diseaseResult.detections?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>All Detections ({diseaseResult.total_detections})</div>
                                        {diseaseResult.detections.map((d, i) => {
                                            const dSev = SEVERITY_CONFIG[d.severity] || SEVERITY_CONFIG.unknown
                                            return (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${dSev.color}` }}>
                                                    <div>
                                                        <strong style={{ color: dSev.color, fontSize: 13 }}>{d.name}</strong>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{d.class}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span className="badge active" style={{ fontSize: 11 }}>{d.confidence}</span>
                                                        <div style={{ fontSize: 10, marginTop: 2, textTransform: 'uppercase', fontWeight: 600, color: dSev.color }}>{d.severity}</div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>Upload an image of tomato plant to receive AI-powered disease diagnosis</p>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.8 }}>
                                    <div>Model: Faster R-CNN + MobileNetV3</div>
                                    <div>Detects: 8 tomato diseases + Healthy</div>
                                    <div>Provides: Treatment recommendations</div>
                                    <div>Output: Confidence score + Severity level</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

function AudioTab({ showToast }) {
    const [mode, setMode] = useState('live')
    const [listening, setListening] = useState(false)
    const [currentDb, setCurrentDb] = useState(0)
    const [aiResult, setAiResult] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [repelActive, setRepelActive] = useState(false)
    const [pestLog, setPestLog] = useState([])
    const canvasRef = useRef(null)
    const audioCtxRef = useRef(null)
    const analyserRef = useRef(null)
    const animFrameRef = useRef(null)
    const streamRef = useRef(null)
    const repelOscRef = useRef(null)
    const repelCtxRef = useRef(null)
    const fileRef = useRef(null)

    useEffect(() => {
        fetch(`${API.DATA}/pest-events`).then(r => r.ok ? r.json() : []).then(setPestLog).catch(() => { })
    }, [aiResult])

    const playRepelTone = useCallback((frequency, duration = 3) => {
        try {
            stopRepelTone()
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            repelCtxRef.current = ctx
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()
            const audibleFreq = frequency > 18000 ? 1000 : frequency
            oscillator.type = 'sine'
            oscillator.frequency.setValueAtTime(audibleFreq, ctx.currentTime)
            gainNode.gain.setValueAtTime(0, ctx.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1)
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + duration - 0.3)
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)
            oscillator.start(ctx.currentTime)
            oscillator.stop(ctx.currentTime + duration)
            repelOscRef.current = oscillator
            setRepelActive(true)
            oscillator.onended = () => { setRepelActive(false); repelOscRef.current = null }
        } catch (e) { console.error(e) }
    }, [])

    const stopRepelTone = useCallback(() => {
        if (repelOscRef.current) { try { repelOscRef.current.stop() } catch { } repelOscRef.current = null }
        if (repelCtxRef.current) { try { repelCtxRef.current.close() } catch { } repelCtxRef.current = null }
        setRepelActive(false)
    }, [])

    const detectInsectFromBlob = async (blob, filename = 'recording.webm') => {
        setAiLoading(true)
        setAiResult(null)
        try {
            const formData = new FormData()
            formData.append('file', new File([blob], filename, { type: blob.type }))
            const res = await fetch(`${API.AI}/api/audio/detect`, { method: 'POST', body: formData })
            if (res.ok) {
                const data = await res.json()
                setAiResult(data)
                showToast(`Detected: ${data.insect} (${data.confidence})`)
                if (data.repel_hz && data.confidence_raw > 50) {
                    playRepelTone(data.repel_hz, 3)
                    fetch(`${API.DATA}/pest-events`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ species: data.insect, confidence: data.confidence_raw, repel_hz: data.repel_hz })
                    }).catch(() => { })
                }
            } else showToast('AI Audio Server error', 'error')
        } catch { showToast('AI Server offline', 'error') }
        setAiLoading(false)
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        await detectInsectFromBlob(file, file.name)
    }

    const startListening = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 2048
            analyser.smoothingTimeConstant = 0.85
            source.connect(analyser)
            analyserRef.current = analyser
            setListening(true)
            drawWaveform()
            showToast('Microphone active - listening for pest sounds')

            const detectInterval = setInterval(async () => {
                if (!analyserRef.current) return
                const data = new Uint8Array(analyserRef.current.frequencyBinCount)
                analyserRef.current.getByteFrequencyData(data)
                const avg = data.reduce((a, b) => a + b) / data.length
                setCurrentDb(Math.round(avg))
                if (avg > 30) {
                    const recorder = new MediaRecorder(stream)
                    const chunks = []
                    recorder.ondataavailable = (e) => chunks.push(e.data)
                    recorder.onstop = async () => {
                        const blob = new Blob(chunks, { type: 'audio/webm' })
                        await detectInsectFromBlob(blob)
                    }
                    recorder.start()
                    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 2000)
                }
            }, 5000)
            streamRef.current._detectInterval = detectInterval
        } catch { showToast('Microphone access denied', 'error') }
    }

    const stopListening = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); clearInterval(streamRef.current._detectInterval) }
        if (audioCtxRef.current) audioCtxRef.current.close()
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        setListening(false)
        setCurrentDb(0)
    }

    const drawWaveform = () => {
        const canvas = canvasRef.current
        if (!canvas || !analyserRef.current) return
        const ctx = canvas.getContext('2d')
        const analyser = analyserRef.current
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        const draw = () => {
            animFrameRef.current = requestAnimationFrame(draw)
            analyser.getByteTimeDomainData(dataArray)
            canvas.width = canvas.offsetWidth * 2
            canvas.height = canvas.offsetHeight * 2
            ctx.scale(2, 2)
            const w = canvas.offsetWidth, h = canvas.offsetHeight
            ctx.fillStyle = 'rgba(10, 14, 26, 0.3)'
            ctx.fillRect(0, 0, w, h)
            ctx.strokeStyle = 'rgba(255,255,255,0.03)'
            ctx.lineWidth = 1
            for (let i = 0; i < 10; i++) { const y = (h / 10) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
            const gradient = ctx.createLinearGradient(0, 0, w, 0)
            gradient.addColorStop(0, '#06B6D4')
            gradient.addColorStop(0.5, '#8B5CF6')
            gradient.addColorStop(1, '#22C55E')
            ctx.strokeStyle = gradient
            ctx.lineWidth = 2
            ctx.beginPath()
            const sliceWidth = w / bufferLength
            let x = 0
            for (let i = 0; i < bufferLength; i++) { const v = dataArray[i] / 128.0; const y = (v * h) / 2; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); x += sliceWidth }
            ctx.lineTo(w, h / 2)
            ctx.stroke()
        }
        draw()
    }

    useEffect(() => { return () => { stopListening(); stopRepelTone() } }, [])

    return (
        <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button className={`toggle-btn ${mode === 'live' ? 'on' : 'off'}`} onClick={() => { setMode('live'); stopListening() }}>Live Monitoring</button>
                <button className={`toggle-btn ${mode === 'upload' ? 'on' : 'off'}`} onClick={() => { setMode('upload'); stopListening() }}>Upload Audio</button>
            </div>

            <div className="two-col" style={{ marginBottom: 20 }}>
                <div className="card">
                    <div className="card-title" style={{ justifyContent: 'space-between' }}>
                        <span>{mode === 'live' ? 'Live Audio Waveform' : 'Audio File Input'}</span>
                        {mode === 'live' && (
                            <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: listening ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)', color: listening ? '#22C55E' : '#64748B' }}>
                                {listening ? `LIVE - ${currentDb} dB` : 'STANDBY'}
                            </div>
                        )}
                    </div>

                    {mode === 'live' ? (
                        <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                            <canvas ref={canvasRef} style={{ width: '100%', height: 200, display: 'block' }} />
                            {!listening && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: 'rgba(10,14,26,0.8)' }}>
                                    <div style={{ fontSize: 18, marginBottom: 12, fontWeight: 800, color: 'var(--text-muted)' }}>MICROPHONE</div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Click Start Listening to begin 24/7 pest monitoring</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 16, background: 'var(--bg-primary)' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
                            <div style={{ fontSize: 18, marginBottom: 8, fontWeight: 800, color: 'var(--text-muted)' }}>UPLOAD AUDIO</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>MP3, WAV, or WEBM files</p>
                            <input ref={fileRef} type="file" accept="audio/*" onChange={handleFileUpload} hidden />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                        {mode === 'live' && (
                            !listening ? (
                                <button className="btn-primary" onClick={startListening} style={{ flex: 1 }}>Start Listening</button>
                            ) : (
                                <button className="toggle-btn off" onClick={stopListening} style={{ flex: 1 }}>Stop Listening</button>
                            )
                        )}
                        {mode === 'upload' && (
                            <button className="btn-primary" onClick={() => fileRef.current?.click()} style={{ flex: 1 }}>Choose Audio File</button>
                        )}
                    </div>

                    {pestLog.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Pest Repellent Log (Blockchain Verified)</div>
                            {pestLog.slice(0, 5).map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                                    <div>
                                        <strong style={{ color: '#8B5CF6' }}>{p.species}</strong>
                                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.repel_hz} Hz</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {p.blockchain_tx && <span className="tx-hash" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.blockchain_tx}</span>}
                                        <span style={{ color: '#22C55E', fontWeight: 600 }}>{p.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-title">AI Insect Detection (ResNet18)</div>
                    {aiLoading ? (
                        <div className="empty-state"><p style={{ animation: 'pulse 1s infinite' }}>Analyzing audio with PyTorch AI...</p></div>
                    ) : aiResult ? (
                        <div>
                            <div style={{ textAlign: 'center', marginBottom: 16, padding: 20, background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,212,0.1))', borderRadius: 16, border: '1px solid rgba(139,92,246,0.2)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Species Identified</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>{aiResult.insect}</div>
                                <div style={{ display: 'inline-flex', gap: 16, marginTop: 12, padding: '8px 20px', background: 'var(--bg-primary)', borderRadius: 20, fontSize: 13 }}>
                                    <div><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Confidence</span><div style={{ fontWeight: 700, color: '#22C55E' }}>{aiResult.confidence}</div></div>
                                    <div style={{ width: 1, background: 'var(--border-color)' }} />
                                    <div><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Model</span><div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{aiResult.model}</div></div>
                                </div>
                            </div>
                            <div style={{ padding: 16, marginBottom: 12, background: repelActive ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', borderRadius: 12, border: `1px solid ${repelActive ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'}`, transition: 'all 0.3s ease' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: repelActive ? '#EF4444' : '#F59E0B' }}>{repelActive ? 'REPEL TONE ACTIVE' : 'Repel Frequency'}</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: repelActive ? '#EF4444' : '#F59E0B' }}>{aiResult.repel_hz?.toLocaleString()} Hz</div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                                    {aiResult.repel_hz > 18000 ? `Ultrasonic (${aiResult.repel_hz} Hz) - Playing 1000 Hz test tone` : `Audible frequency - Playing at ${aiResult.repel_hz} Hz`}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn-primary" onClick={() => playRepelTone(aiResult.repel_hz, 3)} disabled={repelActive} style={{ flex: 1, fontSize: 12, background: repelActive ? '#64748B' : 'linear-gradient(135deg, #EF4444, #F59E0B)', border: 'none', opacity: repelActive ? 0.5 : 1 }}>
                                        {repelActive ? 'Playing...' : 'Play Repel Tone'}
                                    </button>
                                    {repelActive && <button className="toggle-btn off" onClick={stopRepelTone} style={{ fontSize: 12 }}>Stop</button>}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{aiResult.duration_sec}s</div>
                                </div>
                                <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>File</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aiResult.filename}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>{mode === 'live' ? 'Start live monitoring for automatic AI pest identification' : 'Upload an audio file to identify insect species'}</p>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.8 }}>
                                <div>Model: ResNet18 + MelSpectrogram</div>
                                <div>Detects: 66 insect species</div>
                                <div>Output: Species + Repel frequency</div>
                                <div>Auto-plays repel tone on detection</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}


