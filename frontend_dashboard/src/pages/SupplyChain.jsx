import { useState, useEffect } from 'react'
import { API } from '../config'

export default function SupplyChainPage({ showToast }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ productID: '', name: '', description: '' })
    const [batchForm, setBatchForm] = useState({ productID: '', batch: '', newProcesses: '', newStatus: '' })
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [batches, setBatches] = useState([])

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API.SUPPLY}/products`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.products || [])
            }
        } catch {
            showToast('Supply Chain Server offline', 'error')
        }
    }

    useEffect(() => { fetchProducts() }, [])

    const addProduct = async (e) => {
        e.preventDefault()
        if (!form.productID || !form.name || !form.description) return
        setLoading(true)
        try {
            const res = await fetch(`${API.SUPPLY}/product/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            const data = await res.json()
            if (data.transactionHash) {
                showToast(`Product added! TX: ${data.transactionHash.slice(0, 20)}...`)
                setForm({ productID: '', name: '', description: '' })
                fetchProducts()
            } else {
                showToast(data.error || 'Failed', 'error')
            }
        } catch {
            showToast('Server error', 'error')
        }
        setLoading(false)
    }

    const updateProcesses = async (e) => {
        e.preventDefault()
        if (!batchForm.productID || !batchForm.batch || !batchForm.newProcesses) return
        setLoading(true)
        try {
            const res = await fetch(`${API.SUPPLY}/product/update/processes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchForm)
            })
            const data = await res.json()
            if (data.transactionHash) {
                showToast(`Processes updated! TX: ${data.transactionHash.slice(0, 20)}...`)
            } else {
                showToast(data.error || 'Failed', 'error')
            }
        } catch {
            showToast('Server error', 'error')
        }
        setLoading(false)
    }

    const updateStatus = async (e) => {
        e.preventDefault()
        if (!batchForm.productID || !batchForm.batch || !batchForm.newStatus) return
        setLoading(true)
        try {
            const res = await fetch(`${API.SUPPLY}/product/update/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchForm)
            })
            const data = await res.json()
            if (data.transactionHash) {
                showToast(`Status updated! TX: ${data.transactionHash.slice(0, 20)}...`)
            } else {
                showToast(data.error || 'Failed', 'error')
            }
        } catch {
            showToast('Server error', 'error')
        }
        setLoading(false)
    }

    const viewBatches = async (productID) => {
        setSelectedProduct(productID)
        try {
            const res = await fetch(`${API.SUPPLY}/product/batches/${productID}`)
            if (res.ok) {
                const data = await res.json()
                setBatches(data.batches || [])
            }
        } catch {}
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Supply Chain</h1>
                <p className="page-subtitle">Manage products & batches on Blockchain (PIONE Zero)</p>
            </div>

            <div className="two-col">
                <div>
                    <div className="card">
                        <div className="card-title">Products on Blockchain ({products.length})</div>
                        {products.length > 0 ? (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Product ID</th>
                                            <th>Name</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((p, i) => (
                                            <tr key={i}>
                                                <td><span className="tx-hash">{p.productID}</span></td>
                                                <td>{p.name}</td>
                                                <td><span className={`badge ${p.isActive ? 'active' : 'inactive'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                                                <td>
                                                    <button
                                                        className="btn-primary"
                                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                                        onClick={() => viewBatches(p.productID)}
                                                    >View Batches</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>No products found. Add one using the form.</p>
                            </div>
                        )}

                        {selectedProduct && (
                            <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                                    Batches for: <span className="tx-hash">{selectedProduct}</span>
                                </div>
                                {batches.length > 0 ? (
                                    batches.map((b, i) => (
                                        <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                                            {b}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No batches yet</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="card">
                        <div className="card-title">Add New Product</div>
                        <form onSubmit={addProduct}>
                            <div className="form-group">
                                <label className="form-label">Product ID</label>
                                <input className="form-input" placeholder="e.g. TOMATO-001" value={form.productID} onChange={e => setForm({ ...form, productID: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Product Name</label>
                                <input className="form-input" placeholder="e.g. Ca Chua Dalat" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <input className="form-input" placeholder="e.g. Organic tomatoes from Da Lat" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                                {loading ? 'Writing to Blockchain...' : 'Add to Blockchain'}
                            </button>
                        </form>
                    </div>

                    <div className="card">
                        <div className="card-title">Update Batch</div>
                        <div className="form-group">
                            <label className="form-label">Product ID</label>
                            <input className="form-input" placeholder="TOMATO-001" value={batchForm.productID} onChange={e => setBatchForm({ ...batchForm, productID: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Batch ID</label>
                            <input className="form-input" placeholder="BATCH-2026-001" value={batchForm.batch} onChange={e => setBatchForm({ ...batchForm, batch: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Processes</label>
                            <input className="form-input" placeholder="Seeded > Harvested > Packed" value={batchForm.newProcesses} onChange={e => setBatchForm({ ...batchForm, newProcesses: e.target.value })} />
                        </div>
                        <button className="btn-primary" onClick={updateProcesses} disabled={loading} style={{ width: '100%', marginBottom: 8 }}>
                            Update Processes
                        </button>
                        <div className="form-group" style={{ marginTop: 12 }}>
                            <label className="form-label">Status</label>
                            <input className="form-input" placeholder="e.g. Harvested" value={batchForm.newStatus} onChange={e => setBatchForm({ ...batchForm, newStatus: e.target.value })} />
                        </div>
                        <button className="btn-primary" onClick={updateStatus} disabled={loading} style={{ width: '100%' }}>
                            Update Status
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}


