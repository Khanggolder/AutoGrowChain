import { useState, useEffect } from 'react'
import { API } from '../config'

const HEALTH_COLORS = { 'Good': '#22C55E', 'Needs Attention': '#F59E0B', 'Critical': '#EF4444' }

export default function MarketplacePage({ showToast }) {
    const [trees, setTrees] = useState([])
    const [loading, setLoading] = useState(true)
    const [mintingId, setMintingId] = useState(null)
    const [walletForm, setWalletForm] = useState({ name: '', wallet: '' })
    const [walletConnected, setWalletConnected] = useState(false)
    const [walletAddress, setWalletAddress] = useState('')
    const [visibleCount, setVisibleCount] = useState(15)

    useEffect(() => {
        fetchTrees()
    }, [])

    const fetchTrees = async () => {
        try {
            const res = await fetch(`${API.DATA}/nft/trees`)
            if (res.ok) {
                const data = await res.json()
                setTrees(data.slice(0, 30))
            }
        } catch {}
        setLoading(false)
    }

    const connectWallet = () => {
        const demoAddr = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
        setWalletAddress(demoAddr)
        setWalletConnected(true)
        showToast('Wallet connected (Hardhat Account #0)')
    }

    const mintTree = async (plantId) => {
        if (!walletConnected) {
            showToast('Please connect your wallet first', 'error')
            return
        }
        setMintingId(plantId)
        try {
            const res = await fetch(`${API.DATA}/nft/mint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plant_id: plantId,
                    wallet_address: walletAddress,
                    renter_name: walletForm.name || 'Anonymous'
                })
            })
            const data = await res.json()
            if (data.success) {
                showToast(`Tree #${plantId} rented! TX: ${data.tx_hash.slice(0,18)}...`)
                fetchTrees()
            } else {
                showToast(data.error || 'Mint failed', 'error')
            }
        } catch {
            showToast('Server error', 'error')
        }
        setMintingId(null)
    }

    const releaseTree = async (plantId) => {
        try {
            await fetch(`${API.DATA}/nft/release/${plantId}`, { method: 'DELETE' })
            showToast(`Tree #${plantId} released`)
            fetchTrees()
        } catch {
            showToast('Release failed', 'error')
        }
    }

    const availableTrees = trees.filter(t => !t.wallet_address)
    const rentedTrees = trees.filter(t => t.wallet_address)
    const visibleAvailable = availableTrees.slice(0, visibleCount)

    if (loading) return <div className="empty-state"><p>Loading marketplace...</p></div>

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Tree Marketplace (NFT)</h1>
                <p className="page-subtitle">Rent a real tree on the farm. Each tree is an NFT on the blockchain.</p>
            </div>

            <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(59,130,246,0.06))', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Wallet Connection</div>
                        {walletConnected ? (
                            <div style={{ fontSize: 12, color: '#22C55E' }}>
                                Connected: <code style={{ background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 6 }}>{walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</code>
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Connect wallet to rent trees</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {!walletConnected && (
                            <input
                                className="form-input"
                                placeholder="Your name (optional)"
                                value={walletForm.name}
                                onChange={e => setWalletForm({ ...walletForm, name: e.target.value })}
                                style={{ width: 180, height: 36, fontSize: 12 }}
                            />
                        )}
                        <button
                            onClick={connectWallet}
                            disabled={walletConnected}
                            style={{
                                padding: '8px 20px', borderRadius: 10,
                                background: walletConnected ? 'rgba(34,197,94,0.15)' : 'var(--gradient-primary)',
                                color: '#fff',
                                border: walletConnected ? '1px solid rgba(34,197,94,0.3)' : 'none',
                                fontSize: 13, fontWeight: 700, cursor: walletConnected ? 'default' : 'pointer'
                            }}
                        >
                            {walletConnected ? 'Connected' : 'Connect Wallet'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 16 }}>
                    {[
                        { label: 'Total Trees', value: trees.length, color: '#3B82F6' },
                        { label: 'Available', value: availableTrees.length, color: '#22C55E' },
                        { label: 'Rented', value: rentedTrees.length, color: '#F59E0B' },
                        { label: 'Mint Price', value: '0.01 ETH', color: '#8B5CF6' }
                    ].map((s, i) => (
                        <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, borderLeft: `3px solid ${s.color}` }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {availableTrees.length > 0 && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-title" style={{ color: '#22C55E' }}>Available Trees ({availableTrees.length})</div>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: 16,
                        maxHeight: '70vh',
                        overflowY: 'auto',
                        paddingRight: 10,
                        paddingBottom: 20
                    }}>
                        {visibleAvailable.map(tree => (
                            <div key={tree.id} style={{
                                padding: 20, borderRadius: 14,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                transition: 'all 0.3s',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                    background: `linear-gradient(90deg, ${HEALTH_COLORS[tree.health] || '#64748B'}, transparent)`
                                }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Tree #{tree.id}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{tree.name}</div>
                                    </div>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                                        background: `${HEALTH_COLORS[tree.health]}20`, color: HEALTH_COLORS[tree.health]
                                    }}>{tree.health}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 14 }}>
                                    <div>Species: <strong>{tree.species}</strong></div>
                                    <div>Location: <strong>{tree.location}</strong></div>
                                    <div>Stage: <strong>{tree.stage}</strong></div>
                                    <div>Planted: <strong>{tree.planted_date}</strong></div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#8B5CF6' }}>0.01 ETH</div>
                                    <button
                                        onClick={() => mintTree(tree.id)}
                                        disabled={mintingId === tree.id || !walletConnected}
                                        style={{
                                            padding: '8px 20px', borderRadius: 10, border: 'none',
                                            background: walletConnected ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                                            color: walletConnected ? '#fff' : 'var(--text-muted)',
                                            fontSize: 13, fontWeight: 700,
                                            cursor: walletConnected ? 'pointer' : 'not-allowed',
                                            opacity: mintingId === tree.id ? 0.5 : 1
                                        }}
                                    >
                                        {mintingId === tree.id ? 'Minting...' : 'Rent This Tree'}
                                    </button>
                                </div>
                            </div>
                        ))}
                        {availableTrees.length > visibleCount && (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0' }}>
                                <button 
                                    className="btn-primary" 
                                    onClick={() => setVisibleCount(prev => prev + 15)}
                                    style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}
                                >
                                    Load More Trees...
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {rentedTrees.length > 0 && (
                <div className="card">
                    <div className="card-title" style={{ color: '#F59E0B' }}>Rented Trees (NFT Owners)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                        {rentedTrees.map(tree => (
                            <div key={tree.id} style={{
                                padding: 20, borderRadius: 14,
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(139,92,246,0.04))',
                                border: '1px solid rgba(245,158,11,0.2)',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 12, right: 12,
                                    padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 700,
                                    background: 'rgba(245,158,11,0.15)', color: '#F59E0B'
                                }}>NFT OWNED</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Tree #{tree.id}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{tree.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 10 }}>
                                    <div>Owner: <strong style={{ color: '#F59E0B' }}>{tree.renter_name}</strong></div>
                                    <div>Wallet: <code style={{ fontSize: 10, background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>{tree.wallet_address?.slice(0,10)}...</code></div>
                                    <div>Minted: <strong>{tree.nft_minted_at}</strong></div>
                                    <div>TX: <code style={{ fontSize: 9, color: 'var(--text-muted)' }}>{tree.tx_hash?.slice(0,24)}...</code></div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => releaseTree(tree.id)}
                                        style={{
                                            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                            border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                                            color: '#EF4444', cursor: 'pointer'
                                        }}
                                    >Release NFT</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}


