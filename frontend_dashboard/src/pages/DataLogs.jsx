import { useState, useEffect } from 'react'
import { API } from '../config'

export default function DataLogsPage({ showToast }) {
    const [counts, setCounts] = useState(null)
    const [activeTab, setActiveTab] = useState('iot')
    const [records, setRecords] = useState([])
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [manualData, setManualData] = useState('')
    const [sending, setSending] = useState(false)

    const tabs = [
        { key: 'iot', label: 'IoT Data' },
        { key: 'contributions', label: 'Contributions' },
        { key: 'collection', label: 'Collection' },
        { key: 'backup', label: 'Backup' },
        { key: 'primary', label: 'Primary' }
    ]

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await fetch(`${API.TPL}/counts`)
                if (res.ok) setCounts(await res.json())
            } catch {}
        }
        fetchCounts()
    }, [])

    const fetchRecords = async (type, count) => {
        setLoadingRecords(true)
        setRecords([])
        const endpoint = type === 'contributions' ? 'contributions' : type
        const total = count || 0
        const fetched = []

        const start = Math.max(0, total - 10)
        for (let i = total - 1; i >= start; i--) {
            try {
                const res = await fetch(`${API.TPL}/${endpoint}/${i}`)
                if (res.ok) {
                    const data = await res.json()
                    fetched.push({ index: i, ...data })
                }
            } catch { break }
        }
        setRecords(fetched)
        setLoadingRecords(false)
    }

    useEffect(() => {
        if (!counts) return
        const countMap = {
            iot: counts.iotData,
            contributions: counts.contributions,
            collection: counts.collectionData,
            backup: counts.backupData,
            primary: counts.primaryData
        }
        fetchRecords(activeTab, countMap[activeTab])
    }, [activeTab, counts])

    const sendManualData = async () => {
        if (!manualData.trim()) return
        setSending(true)
        const endpointMap = {
            iot: 'iot/add',
            contributions: 'contributions/add',
            collection: 'collection/add',
            backup: 'backup/add',
            primary: 'primary/add'
        }
        const bodyKey = activeTab === 'contributions' ? 'cid' : 'data'

        try {
            const res = await fetch(`${API.TPL}/${endpointMap[activeTab]}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [bodyKey]: manualData })
            })
            const data = await res.json()
            if (data.transactionHash) {
                showToast(`Saved! TX: ${data.transactionHash.slice(0, 20)}...`)
                setManualData('')
                const res2 = await fetch(`${API.TPL}/counts`)
                if (res2.ok) setCounts(await res2.json())
            } else {
                showToast(data.error || 'Failed', 'error')
            }
        } catch {
            showToast('TPL Server offline', 'error')
        }
        setSending(false)
    }

    const formatTimestamp = (ts) => {
        if (!ts) return '--'
        return new Date(ts * 1000).toLocaleString('en-US')
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Data Logs</h1>
                <p className="page-subtitle">Browse & add immutable records on TPLContract (PIONE Zero)</p>
            </div>

            {counts && (
                <div className="stats-grid">
                    {[
                        { label: 'IoT Records', value: counts.iotData, color: 'blue' },
                        { label: 'Contributions', value: counts.contributions, color: 'green' },
                        { label: 'Collection', value: counts.collectionData, color: 'orange' },
                        { label: 'Backup', value: counts.backupData, color: 'purple' },
                        { label: 'Primary', value: counts.primaryData, color: 'red' }
                    ].map((c, i) => (
                        <div className={`stat-card ${c.color}`} key={i}>
                            <div className="stat-card-header">
                                <span className="stat-card-label">{c.label}</span>
                            </div>
                            <div className="stat-card-value">{c.value}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="card">
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            className={`toggle-btn ${activeTab === tab.key ? 'on' : 'off'}`}
                            onClick={() => setActiveTab(tab.key)}
                            style={{ fontSize: 13 }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <input
                        className="form-input"
                        placeholder={`Enter ${activeTab} data to save on Blockchain...`}
                        value={manualData}
                        onChange={e => setManualData(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button className="btn-primary" onClick={sendManualData} disabled={sending}>
                        {sending ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {loadingRecords ? (
                    <div className="empty-state">
                        <p>Loading records from Blockchain...</p>
                    </div>
                ) : records.length > 0 ? (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Data</th>
                                    <th>Timestamp</th>
                                    <th>Sender</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{r.index}</td>
                                        <td style={{ maxWidth: 400, wordBreak: 'break-all', fontSize: 13 }}>{r.data}</td>
                                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatTimestamp(r.timestamp)}</td>
                                        <td><span className="tx-hash" style={{ fontSize: 11 }}>{r.sender?.slice(0, 10)}...{r.sender?.slice(-6)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No records found for this category</p>
                    </div>
                )}
            </div>
        </>
    )
}


