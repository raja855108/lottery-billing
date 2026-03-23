import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { SevenDayCtx } from './SevenDayContext.js'
import { useAuth }          from './auth/AuthContext.jsx'
import LoginPage            from './auth/LoginPage.jsx'
import AdminUserManager     from './auth/AdminUserManager.jsx'
import ChangePasswordModal  from './auth/ChangePasswordModal.jsx'
import Modal                from './components/Modal.jsx'
import SellerCard           from './components/SellerCard.jsx'
import StockerCard          from './components/StockerCard.jsx'
import WABlastModal         from './components/WABlastModal.jsx'
import ReportPage           from './components/ReportPage.jsx'
import DailyReport          from './components/DailyReport.jsx'
import ProfitDashboard      from './components/ProfitDashboard.jsx'
import BulkPDFUploadModal   from './components/BulkPDFUploadModal.jsx'
import * as DB              from './DB.js'
// DB.deleteAllData is called to wipe all billing data
import { fmt, today, todayISO, nextId, newSeller, newStocker,
         calcSeller, calcStocker, CO_CLR } from './utils.js'

// ── Alphabetical sort ─────────────────────────────────────────────────────────
const sortAlpha = arr =>
  [...arr].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' })
  )

// ── 7-day date boundary ───────────────────────────────────────────────────────
const get7DaysBoundary = () => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)   // returns "YYYY-MM-DD"
}

// Tab definitions — seller | stocker | stocker7
const TABS = [
  { id: 'seller',   label: '✅ Seller',         color: '#1a237e' },
  { id: 'stocker',  label: '📦 Stocker',        color: '#00695c' },
  { id: 'stocker7', label: '📅 Stocker 7 Days', color: '#6a1b9a' },
]

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
                  justifyContent:'center', background:'linear-gradient(135deg,#1a237e,#3949ab)' }}>
      <div style={{ textAlign:'center', color:'#fff' }}>
        <div style={{ fontSize:56, marginBottom:12 }}>🎲</div>
        <div style={{ fontWeight:700, fontSize:18, opacity:.8 }}>Loading…</div>
      </div>
    </div>
  )
  if (!user) return <LoginPage />
  return <BillingApp />
}

// ── Saved Bills Panel ─────────────────────────────────────────────────────────
function SavedBillsPanel({ userId, isAdmin, onRefresh, tick }) {
  const [expanded, setExpanded] = useState(false)
  const bills    = isAdmin ? DB.getBills() : DB.getBillsByUser(userId)
  const sellers  = bills.filter(b => b.type === 'seller')
  const stockers = bills.filter(b => b.type === 'stocker')
  const grandRunningBill = bills.reduce((a,b) => a + (b.runningBill ?? b.subtotal  ?? 0), 0)
  const grandTotalBill   = bills.reduce((a,b) => a + (b.totalBill  ?? b.finalBill  ?? 0), 0)

  const coTotals = { ML:{sold:0,amt:0,vc:0}, NB:{sold:0,amt:0,vc:0}, Booking:{sold:0,amt:0,vc:0} }
  bills.forEach(b => (b.rows||[]).forEach(r => {
    const co = r.company; if (!coTotals[co]) return
    const sold = parseFloat(r.sold)||0, rate = parseFloat(r.rate)||0, vc = parseFloat(r.vc)||0
    coTotals[co].sold += sold; coTotals[co].amt += sold*rate; coTotals[co].vc += vc
  }))

  if (bills.length === 0) return null

  const sortedBills = [...bills].sort((a,b) =>
    (a.customerName||'').localeCompare(b.customerName||'', 'en', { sensitivity:'base' })
  )

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8eaf6',
                  marginBottom:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,0.07)' }}>
      <div style={{ background:'linear-gradient(135deg,#1a237e,#3949ab)', padding:'14px 20px',
                    display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ color:'#fff', fontWeight:800, fontSize:15 }}>📊 Saved Bills Dashboard</div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,0.18)', color:'#fff', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>{bills.length} bills</span>
          <span style={{ background:'rgba(255,255,255,0.18)', color:'#fff', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>✅ {sellers.length} sellers</span>
          <span style={{ background:'rgba(255,255,255,0.18)', color:'#fff', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>📦 {stockers.length} stockers</span>
          <button onClick={() => setExpanded(v=>!v)}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:8, padding:'5px 14px', cursor:'pointer', fontWeight:700, fontSize:12 }}>
            {expanded ? '▲ Hide' : '▼ Details'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:0, borderBottom:'1px solid #f0f0f0' }}>
        {[
          { icon:'💳', label:'Grand Total Bill',  val:fmt(grandTotalBill),   bg:'#e8eaf6', col:'#1a237e' },
          { icon:'🏷️', label:'Total Running Bill', val:fmt(grandRunningBill), bg:'#e3f2fd', col:'#1565c0' },
          { icon:'✅', label:'Seller Bills',       val:sellers.length,        bg:'#e3f2fd', col:'#1565c0' },
          { icon:'📦', label:'Stocker Bills',      val:stockers.length,       bg:'#e0f2f1', col:'#00695c' },
          { icon:'🎟️', label:'ML Sold',            val:coTotals.ML.sold,      bg:'#e3f2fd', col:CO_CLR.ML },
          { icon:'🎟️', label:'NB Sold',            val:coTotals.NB.sold,      bg:'#f3e5f5', col:CO_CLR.NB },
          { icon:'🎟️', label:'Booking Sold',       val:coTotals.Booking.sold, bg:'#e0f2f1', col:CO_CLR.Booking },
        ].map(({ icon,label,val,bg,col }) => (
          <div key={label} style={{ background:bg, padding:'14px 16px', textAlign:'center', borderRight:'1px solid #f0f0f0' }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
            <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
            <div style={{ fontWeight:900, fontSize:15, color:col }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:0, borderBottom:'1px solid #f0f0f0' }}>
        {Object.entries(coTotals).map(([co,v]) => (
          <div key={co} style={{ flex:1, padding:'10px 14px', borderRight:'1px solid #f0f0f0', background:'#fafafa' }}>
            <span style={{ background:CO_CLR[co], color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{co}</span>
            <div style={{ display:'flex', gap:12, marginTop:6, fontSize:12, flexWrap:'wrap' }}>
              <span>Sold: <b>{v.sold}</b></span>
              <span>Amt: <b style={{ color:'#1565c0' }}>{fmt(v.amt)}</b></span>
              <span>VC: <b style={{ color:'#6a1b9a' }}>{fmt(v.vc)}</b></span>
            </div>
          </div>
        ))}
      </div>

      {expanded && (
        <div style={{ maxHeight:420, overflowY:'auto' }}>
          {sortedBills.map((b,bi) => (
            <div key={b.billId} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px', borderBottom:'1px solid #f5f5f5', background:bi%2===0?'#fff':'#fafafa', flexWrap:'wrap' }}>
              <span style={{ background:b.type==='seller'?'#1565c0':'#00695c', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, flexShrink:0 }}>{b.type}</span>
              <div style={{ flex:1, minWidth:120 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#1a237e' }}>{b.customerName||'—'}</div>
                <div style={{ fontSize:11, color:'#888' }}>{b.phone||''} • {b.date}</div>
              </div>
              {(b.rows||[]).map(r => parseFloat(r.sold)>0 ? (
                <span key={r.company} style={{ background:CO_CLR[r.company]+'22', color:CO_CLR[r.company], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                  {r.company}: {r.sold}
                </span>
              ) : null)}
              <div style={{ display:'flex', gap:6 }}>
                <div style={{ background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:8, padding:'4px 10px', textAlign:'center', minWidth:96 }}>
                  <div style={{ fontSize:9, color:'#1565c0', fontWeight:600 }}>🏷️ Running Bill</div>
                  <div style={{ fontWeight:800, fontSize:12, color:'#1565c0' }}>{fmt(b.runningBill ?? b.subtotal ?? 0)}</div>
                </div>
                <div style={{ background:'#ffebee', border:'1px solid #ffcdd2', borderRadius:8, padding:'4px 10px', textAlign:'center', minWidth:96 }}>
                  <div style={{ fontSize:9, color:'#888', fontWeight:600 }}>💳 Total Bill</div>
                  <div style={{ fontWeight:800, fontSize:12, color:'#b71c1c' }}>{fmt(b.totalBill ?? b.finalBill)}</div>
                </div>
              </div>
              <button onClick={() => { if(window.confirm('Delete this saved bill?')) { DB.deleteBill(b.billId); onRefresh() } }}
                style={{ background:'none', border:'none', color:'#e0e0e0', cursor:'pointer', fontSize:16, padding:'2px 6px' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Saved All Page ────────────────────────────────────────────────────────────
function SavedAllPage({ userId, isAdmin, onBack }) {
  const [search,     setSearch]   = useState('')
  const [typeFilter, setType]     = useState('all')
  const [tick,       setTick]     = useState(0)

  const allBills = isAdmin ? DB.getBills() : DB.getBillsByUser(userId)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let b = allBills
    if (q)                 b = b.filter(x => (x.customerName||'').toLowerCase().includes(q) || (x.phone||'').includes(q))
    if (typeFilter!=='all') b = b.filter(x => x.type === typeFilter)
    return [...b].sort((a,z) =>
      (a.customerName||'').localeCompare(z.customerName||'', 'en', { sensitivity:'base' })
    )
  }, [allBills, search, typeFilter, tick]) // eslint-disable-line

  const grandRunning = filtered.reduce((a,b) => a + (b.runningBill ?? b.subtotal  ?? 0), 0)
  const grandTotal   = filtered.reduce((a,b) => a + (b.totalBill  ?? b.finalBill  ?? 0), 0)
  const sellers  = filtered.filter(b => b.type === 'seller').length
  const stockers = filtered.filter(b => b.type === 'stocker').length

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#eef0f5', minHeight:'100vh' }}>
      <div style={{ background:'linear-gradient(135deg,#1a237e,#283593,#3949ab)', color:'#fff', padding:'0 20px', boxShadow:'0 3px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ maxWidth:1500, margin:'0 auto', padding:'14px 0 10px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={onBack} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:9, padding:'8px 16px', cursor:'pointer', fontWeight:700, fontSize:13 }}>← Back</button>
            <div>
              <div style={{ fontWeight:800, fontSize:'1.2em', letterSpacing:.5 }}>💾 Saved All Customers</div>
              <div style={{ fontSize:11, opacity:.7 }}>All saved customers A→Z • {today()}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name / phone…"
              style={{ padding:'7px 12px', borderRadius:9, border:'none', fontSize:13, width:180, outline:'none', background:'rgba(255,255,255,0.18)', color:'#fff' }} />
            <select value={typeFilter} onChange={e => setType(e.target.value)}
              style={{ padding:'7px 12px', borderRadius:9, border:'none', fontSize:13, outline:'none', background:'rgba(255,255,255,0.2)', color:'#fff', cursor:'pointer' }}>
              <option value="all"     style={{ color:'#111' }}>All Types</option>
              <option value="seller"  style={{ color:'#111' }}>Sellers Only</option>
              <option value="stocker" style={{ color:'#111' }}>Stockers Only</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1500, margin:'0 auto', padding:'20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:22 }}>
          {[
            { icon:'👥', label:'Total Customers',   val:filtered.length,  bg:'#e8eaf6', col:'#1a237e' },
            { icon:'✅', label:'Sellers',            val:sellers,          bg:'#e3f2fd', col:'#1565c0' },
            { icon:'📦', label:'Stockers',           val:stockers,         bg:'#e0f2f1', col:'#00695c' },
            { icon:'🏷️', label:'Total Running Bill', val:fmt(grandRunning),bg:'#e3f2fd', col:'#1565c0' },
            { icon:'💳', label:'Grand Total Bill',   val:fmt(grandTotal),  bg:'#ffebee', col:'#b71c1c' },
          ].map(({ icon,label,val,bg,col }) => (
            <div key={label} style={{ background:bg, borderRadius:12, padding:'16px', textAlign:'center', border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 1px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
              <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
              <div style={{ fontWeight:900, fontSize:17, color:col }}>{val}</div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#bbb' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
            <div style={{ fontSize:16 }}>No saved bills found</div>
            <div style={{ fontSize:13, marginTop:6 }}>Save bills first using 💾 Save Bill on any customer card.</div>
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8eaf6', overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,0.07)' }}>
            <div style={{ background:'linear-gradient(135deg,#1a237e,#3949ab)', display:'grid', gridTemplateColumns:'48px 1fr 90px 140px 160px 170px 42px', alignItems:'center', padding:'11px 18px', gap:8 }}>
              {['#','Customer Name & Date','Type','Running Bill','Total Bill','Company Sold',''].map((h,i) => (
                <div key={i} style={{ color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:700, textTransform:'uppercase', textAlign:i>=3?'right':'left' }}>{h}</div>
              ))}
            </div>
            {filtered.map((b,bi) => (
              <div key={b.billId} style={{ display:'grid', gridTemplateColumns:'48px 1fr 90px 140px 160px 170px 42px', alignItems:'center', padding:'12px 18px', gap:8, borderBottom:'1px solid #f0f0f0', background:bi%2===0?'#fff':'#fafbff' }}>
                <div style={{ fontWeight:700, color:'#bbb', fontSize:12 }}>{bi+1}</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:'#1a237e' }}>{b.customerName||'—'}</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{b.phone||'—'} • 📅 {b.date}</div>
                </div>
                <div><span style={{ background:b.type==='seller'?'#1565c0':'#00695c', color:'#fff', borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{b.type}</span></div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'#1565c0', fontWeight:600, marginBottom:2 }}>🏷️ RUNNING BILL</div>
                  <div style={{ fontWeight:800, fontSize:14, color:'#1565c0' }}>{fmt(b.runningBill ?? b.subtotal ?? 0)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'#888', fontWeight:600, marginBottom:2 }}>💳 TOTAL BILL</div>
                  <div style={{ fontWeight:900, fontSize:15, color:(b.totalBill??b.finalBill)>0?'#b71c1c':'#2e7d32' }}>{fmt(b.totalBill ?? b.finalBill)}</div>
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {(b.rows||[]).filter(r => parseFloat(r.sold)>0).map(r => (
                    <span key={r.company} style={{ background:CO_CLR[r.company]+'20', color:CO_CLR[r.company], border:`1px solid ${CO_CLR[r.company]}44`, borderRadius:6, padding:'2px 7px', fontSize:11, fontWeight:700 }}>
                      {r.company}: {r.sold}
                    </span>
                  ))}
                </div>
                <button onClick={() => { if(window.confirm('Delete this saved bill?')) { DB.deleteBill(b.billId); setTick(t=>t+1) } }}
                  style={{ background:'none', border:'none', color:'#e0e0e0', cursor:'pointer', fontSize:16, padding:'2px' }}>✕</button>
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'48px 1fr 90px 140px 160px 170px 42px', alignItems:'center', padding:'12px 18px', gap:8, background:'#f0f4ff', borderTop:'2px solid #e8eaf6' }}>
              <div/><div style={{ fontWeight:700, fontSize:13, color:'#37474f' }}>TOTALS — {filtered.length} customer{filtered.length!==1?'s':''} <span style={{ marginLeft:12, fontSize:11, color:'#888', fontWeight:400 }}>sorted A → Z</span></div>
              <div/>
              <div style={{ textAlign:'right', fontWeight:800, color:'#1565c0', fontSize:14 }}>{fmt(grandRunning)}</div>
              <div style={{ textAlign:'right', fontWeight:900, color:'#b71c1c', fontSize:16 }}>{fmt(grandTotal)}</div>
              <div/><div/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main BillingApp ───────────────────────────────────────────────────────────
function BillingApp() {
  const { user, logout, isAdmin } = useAuth()
  const uid  = user.id
  const meta = DB.getMeta(uid)

  const [page,        setPage]        = useState('billing')
  const [tab,         setTab]         = useState(meta.tab || 'seller')
  const [sLock,       setSLock]       = useState(isAdmin ? (meta.sellerLock||false) : false)
  const [tLock,       setTLock]       = useState(isAdmin ? (meta.stockerLock||false) : false)

  // ── Customer lists — always sorted alphabetically ─────────────────────────
  const [sellers,  setSellers]  = useState(() => sortAlpha(DB.getSellers(uid).length  ? DB.getSellers(uid)  : [newSeller(nextId(),uid)]))
  const [stockers, setStockers] = useState(() => sortAlpha(DB.getStockers(uid).length ? DB.getStockers(uid) : [newStocker(nextId(),uid)]))

  // ── "Stocker 7 Days" uses its own independent list stored under key "stocker7" ──
  // This is a SEPARATE customer list (not a filtered view of stockers)
  // Customers are added here independently. The "7 days" label in the tab title
  // means the Running Bill panel auto-reads only bills from the last 7 days.
  // The customer cards themselves work identically to Stocker.
  const [stockers7, setStockers7] = useState(() => {
    const saved = DB.getStockers7(uid)
    return sortAlpha(saved.length ? saved : [newStocker(nextId(), uid)])
  })

  const [search,      setSearch]      = useState('')
  const [modal,       setModal]       = useState(null)
  const [toast,       setToast]       = useState(null)
  const [waOpen,      setWaOpen]      = useState(false)
  const [bulkOpen,    setBulkOpen]    = useState(false)
  const [dailyOpen,   setDailyOpen]   = useState(false)
  const [userMgr,     setUserMgr]     = useState(false)
  const [changePw,    setChangePw]    = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [dashTick,    setDashTick]    = useState(0)

  // Persist to DB
  useEffect(() => { DB.setSellers(uid, sellers)    }, [sellers,   uid])
  useEffect(() => { DB.setStockers(uid, stockers)  }, [stockers,  uid])
  useEffect(() => { DB.setStockers7(uid, stockers7)}, [stockers7, uid])
  useEffect(() => { DB.setMeta(uid, { tab, sellerLock:sLock, stockerLock:tLock }) }, [tab, sLock, tLock, uid])

  const sellersRef   = useRef(sellers)
  const stockersRef  = useRef(stockers)
  const stockers7Ref = useRef(stockers7)
  useEffect(() => { sellersRef.current   = sellers   }, [sellers])
  useEffect(() => { stockersRef.current  = stockers  }, [stockers])
  useEffect(() => { stockers7Ref.current = stockers7 }, [stockers7])
  useEffect(() => {
    const flush = () => {
      DB.setSellers(uid, sellersRef.current)
      DB.setStockers(uid, stockersRef.current)
      DB.setStockers7(uid, stockers7Ref.current)
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [uid])

  const toastTimer = useRef(null)
  const showToast  = useCallback((msg, color='#2e7d32') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, color })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const ask   = (msg, fn) => setModal({ msg, fn })
  const close = () => setModal(null)

  // ── Add customer (sorted) ─────────────────────────────────────────────────
  const addS  = () => setSellers(s  => sortAlpha([...s,  newSeller(nextId(), uid)]))
  const addT  = () => setStockers(s => sortAlpha([...s,  newStocker(nextId(), uid)]))
  const addT7 = () => setStockers7(s => sortAlpha([...s, newStocker(nextId(), uid)]))

  // ── Bulk import ───────────────────────────────────────────────────────────
  const bulkAdd = (customers) => {
    const mapped = customers.map(c => ({ ...c, id: nextId(), userId: uid }))
    if (tab === 'seller') {
      setSellers(prev => { const n = sortAlpha([...prev, ...mapped]); DB.setSellers(uid,n); return n })
    } else if (tab === 'stocker') {
      setStockers(prev => { const n = sortAlpha([...prev, ...mapped]); DB.setStockers(uid,n); return n })
    } else {
      setStockers7(prev => { const n = sortAlpha([...prev, ...mapped]); DB.setStockers7(uid,n); return n })
    }
  }

  // ── Update (re-sort on name change) ──────────────────────────────────────
  const updS  = useCallback((id, d) => { setSellers(p => { const n=sortAlpha(p.map(c=>c.id===id?d:c)); DB.setSellers(uid,n); return n }) }, [uid])
  const updT  = useCallback((id, d) => { setStockers(p => { const n=sortAlpha(p.map(c=>c.id===id?d:c)); DB.setStockers(uid,n); return n }) }, [uid])
  const updT7 = useCallback((id, d) => { setStockers7(p => { const n=sortAlpha(p.map(c=>c.id===id?d:c)); DB.setStockers7(uid,n); return n }) }, [uid])

  // ── Delete ────────────────────────────────────────────────────────────────
  const delS  = id => ask('Delete this customer?', () => { setSellers(p=>{const n=p.filter(c=>c.id!==id); DB.setSellers(uid,n); return n}); close() })
  const delT  = id => ask('Delete this customer?', () => { setStockers(p=>{const n=p.filter(c=>c.id!==id); DB.setStockers(uid,n); return n}); close() })
  const delT7 = id => ask('Delete this customer?', () => { setStockers7(p=>{const n=p.filter(c=>c.id!==id); DB.setStockers7(uid,n); return n}); close() })

  // ── One Click Clean ───────────────────────────────────────────────────────
  const cleanS  = () => ask('Clear Sold, VC & Due? Names kept.', () => { setSellers(p=>{const n=p.map(c=>({...c,oldDue:'',cut:'',rows:c.rows.map(r=>({...r,sold:'',vc:''}))})); DB.setSellers(uid,n); return n}); close() })
  const cleanT  = () => ask('Clear Sold, PWT, VC & Due? Names kept.', () => { setStockers(p=>{const n=p.map(c=>({...c,oldDue:'',cut:'',rows:c.rows.map(r=>({...r,sold:'',pwt:'',vc:''}))})); DB.setStockers(uid,n); return n}); close() })
  const cleanT7 = () => ask('Clear Sold, PWT, VC & Due? Names kept.', () => { setStockers7(p=>{const n=p.map(c=>({...c,oldDue:'',cut:'',rows:c.rows.map(r=>({...r,sold:'',pwt:'',vc:''}))})); DB.setStockers7(uid,n); return n}); close() })

  // ── Save Bill ─────────────────────────────────────────────────────────────
  const saveBill = useCallback(async (c, type) => {
    const calc       = type==='seller' ? calcSeller(c) : calcStocker(c)
    const runningDue = DB.getLiveRunningDue(c.id, calc.finalBill)
    const bill = {
      billId:      `bill_${c.id}_${todayISO()}`,
      customerId:  c.id,
      customerName: c.name||'Unnamed',
      phone:       c.phone||'',
      type,  userId: uid,
      date:        todayISO(),
      rows:        c.rows,
      subtotal:    calc.subtotal,
      oldDue:      calc.od,
      cut:         calc.ct,
      finalBill:   calc.finalBill,
      runningBill: calc.runningBill,
      totalBill:   calc.totalBill,
      runningDue,
      savedAt:     new Date().toISOString(),
    }
    try {
      await DB.saveBill(bill)
      DB.saveCustomer({ id:c.id, name:c.name, phone:c.phone, type, userId:uid })
      showToast(`✅ Bill saved for ${c.name||'customer'}!`)
      setDashTick(t => t+1)
    } catch { showToast('⚠️ Save failed','#c62828') }
  }, [uid, showToast])

  // ── Live grand totals (paise-safe) ────────────────────────────────────────
  const gSRaw  = sellers.reduce((a,c)=>{const x=calcSeller(c); return {sold:a.sold+x.tSold,amtP:a.amtP+Math.round(x.tAmt*100),vcP:a.vcP+Math.round(x.tVC*100),rbP:a.rbP+Math.round(x.runningBill*100),tbP:a.tbP+Math.round(x.totalBill*100)}},{sold:0,amtP:0,vcP:0,rbP:0,tbP:0})
  const gS     = {sold:gSRaw.sold,amt:gSRaw.amtP/100,vc:gSRaw.vcP/100,rb:parseFloat((gSRaw.rbP/100).toFixed(2)),tb:parseFloat((gSRaw.tbP/100).toFixed(2))}

  const gTRaw  = stockers.reduce((a,c)=>{const x=calcStocker(c); return {sold:a.sold+x.tSold,amtP:a.amtP+Math.round(x.tAmt*100),pwtP:a.pwtP+Math.round((x.tPWT||0)*100),vcP:a.vcP+Math.round(x.tVC*100),rbP:a.rbP+Math.round(x.runningBill*100),tbP:a.tbP+Math.round(x.totalBill*100)}},{sold:0,amtP:0,pwtP:0,vcP:0,rbP:0,tbP:0})
  const gT     = {sold:gTRaw.sold,amt:gTRaw.amtP/100,pwt:gTRaw.pwtP/100,vc:gTRaw.vcP/100,rb:parseFloat((gTRaw.rbP/100).toFixed(2)),tb:parseFloat((gTRaw.tbP/100).toFixed(2))}

  // Stocker 7 Days — live totals show only last 7 days customers
  const sevenDaysBoundary = get7DaysBoundary()
  const s7Active = stockers7.filter(c => (c.createdAt||'') >= sevenDaysBoundary || !c.createdAt)
  const gT7Raw = s7Active.reduce((a,c)=>{const x=calcStocker(c); return {sold:a.sold+x.tSold,amtP:a.amtP+Math.round(x.tAmt*100),pwtP:a.pwtP+Math.round((x.tPWT||0)*100),vcP:a.vcP+Math.round(x.tVC*100),rbP:a.rbP+Math.round(x.runningBill*100),tbP:a.tbP+Math.round(x.totalBill*100)}},{sold:0,amtP:0,pwtP:0,vcP:0,rbP:0,tbP:0})
  const gT7    = {sold:gT7Raw.sold,amt:gT7Raw.amtP/100,pwt:gT7Raw.pwtP/100,vc:gT7Raw.vcP/100,rb:parseFloat((gT7Raw.rbP/100).toFixed(2)),tb:parseFloat((gT7Raw.tbP/100).toFixed(2))}

  // ── Search filter ─────────────────────────────────────────────────────────
  const q   = search.toLowerCase()
  const fS  = sellers.filter(c  => (c.name||'').toLowerCase().includes(q))
  const fT  = stockers.filter(c => (c.name||'').toLowerCase().includes(q))
  // Stocker 7 Days: show ALL customers but filter saved bills to 7 days in RunningBill
  const fT7 = stockers7.filter(c => (c.name||'').toLowerCase().includes(q))

  const lk = tab==='seller' ? sLock : tLock
  const togLock = () => tab==='seller' ? setSLock(v=>!v) : setTLock(v=>!v)

  // Active WA blast list
  const waCustomers = tab==='seller' ? fS : tab==='stocker' ? fT : fT7
  const waType      = tab==='stocker7' ? 'stocker' : tab

  // ── Page routing ──────────────────────────────────────────────────────────
  if (page==='report') return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#eef0f5', minHeight:'100vh' }}>
      <SimpleHeader />
      <ReportPage
        onBack={() => setPage('billing')}
        onDeleteAll={() => {
          // After full delete, reset all live card state to a clean single card
          const emptyS = [newSeller(nextId(), uid)]
          const emptyT = [newStocker(nextId(), uid)]
          setSellers(emptyS);  DB.setSellers(uid, emptyS)
          setStockers(emptyT); DB.setStockers(uid, emptyT)
          setStockers7(emptyT); DB.setStockers7(uid, emptyT)
          setDashTick(t => t+1)
        }}
      />
    </div>
  )
  if (page==='dashboard') return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#eef0f5', minHeight:'100vh' }}>
      <SimpleHeader /><ProfitDashboard onBack={() => setPage('billing')} />
    </div>
  )
  if (page==='savedall') return (
    <SavedAllPage userId={uid} isAdmin={isAdmin} onBack={() => setPage('billing')} />
  )

  // ── Live strip content per tab ────────────────────────────────────────────
  const stripContent = () => {
    if (tab==='seller') return (
      <><span>📊 Sold: <b>{gS.sold}</b></span><span>💰 Amt: <b>{fmt(gS.amt)}</b></span><span>🎁 VC: <b>{fmt(gS.vc)}</b></span><span style={{ color:'#1565c0',fontWeight:700 }}>🏷️ Running Bill: <b>{fmt(gS.rb)}</b></span><span style={{ fontWeight:800,color:gS.tb>0?'#b71c1c':'#1b5e20',fontSize:14 }}>💳 Total Bill: {fmt(gS.tb)}</span></>
    )
    if (tab==='stocker') return (
      <><span>📦 Sold: <b>{gT.sold}</b></span><span>💰 Amt: <b>{fmt(gT.amt)}</b></span><span>📦 PWT: <b style={{ color:'#4a148c' }}>{fmt(gT.pwt)}</b></span><span>🎁 VC: <b>{fmt(gT.vc)}</b></span><span style={{ color:'#1565c0',fontWeight:700 }}>🏷️ Running Bill: <b>{fmt(gT.rb)}</b></span><span style={{ fontWeight:800,color:gT.tb>0?'#b71c1c':'#1b5e20',fontSize:14 }}>💳 Total Bill: {fmt(gT.tb)}</span></>
    )
    // stocker7 strip — shows count + 7-day indicator
    return (
      <><span style={{ background:'#6a1b9a22',color:'#6a1b9a',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700 }}>📅 Last 7 Days</span>
      <span>📦 Sold: <b>{gT7.sold}</b></span><span>💰 Amt: <b>{fmt(gT7.amt)}</b></span><span>📦 PWT: <b style={{ color:'#4a148c' }}>{fmt(gT7.pwt)}</b></span><span>🎁 VC: <b>{fmt(gT7.vc)}</b></span><span style={{ color:'#1565c0',fontWeight:700 }}>🏷️ Running Bill: <b>{fmt(gT7.rb)}</b></span><span style={{ fontWeight:800,color:gT7.tb>0?'#b71c1c':'#1b5e20',fontSize:14 }}>💳 Total Bill: {fmt(gT7.tb)}</span>
      <span style={{ color:'#888',fontSize:11 }}>({stockers7.length} total customers, showing {s7Active.length} from last 7 days)</span></>
    )
  }

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:'#eef0f5', minHeight:'100vh' }}>
      {modal    && <Modal msg={modal.msg} onOk={modal.fn} onNo={close} />}
      {userMgr  && <AdminUserManager onClose={() => setUserMgr(false)} />}
      {changePw && <ChangePasswordModal userId={uid} onClose={() => setChangePw(false)} />}
      {waOpen   && <WABlastModal customers={waCustomers} type={waType} onClose={()=>setWaOpen(false)} showToast={showToast}/>}
      {dailyOpen && <DailyReport onClose={() => setDailyOpen(false)} />}
      {bulkOpen && <BulkPDFUploadModal type={waType} onBulkAdd={bulkAdd} onClose={()=>setBulkOpen(false)} />}

      {toast && (
        <div style={{ position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.color,color:'#fff',padding:'12px 28px',borderRadius:12,fontWeight:700,fontSize:14,zIndex:9998,boxShadow:'0 4px 20px rgba(0,0,0,0.25)',whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background:'linear-gradient(135deg,#1a237e 0%,#283593 60%,#3949ab 100%)', color:'#fff', padding:'0 20px', boxShadow:'0 3px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ maxWidth:1500, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, padding:'14px 0 10px' }}>

            {/* Logo */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:30 }}>🎲</span>
              <div>
                <div style={{ fontWeight:800, fontSize:'1.2em', letterSpacing:.5 }}>Lottery Billing System</div>
                <div style={{ fontSize:11, opacity:.7 }}>📅 {today()}</div>
              </div>
            </div>

            {/* Nav */}
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input style={{ padding:'7px 12px', borderRadius:9, border:'none', fontSize:13, width:160, outline:'none', background:'rgba(255,255,255,0.18)', color:'#fff' }}
                placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)}/>
              <button onClick={()=>setWaOpen(true)}    style={btnSt('#25d366','#1da851')}>📲 WA All</button>
              <button onClick={()=>setBulkOpen(true)}  style={btnSt('#e65100','#f57c00')}>📂 Bulk Import</button>
              <button onClick={()=>setDailyOpen(true)} style={btnSt('#1b5e20','#2e7d32')}>📈 Daily</button>
              <button onClick={()=>setPage('report')}  style={{ ...btnSt('#fff','#fff'), background:'rgba(255,255,255,0.2)', color:'#fff' }}>📊 Reports</button>
              <button onClick={()=>setPage('savedall')} style={{ border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontWeight:800, fontSize:13, background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', boxShadow:'0 2px 8px rgba(245,158,11,0.4)' }}>💾 Saved All</button>
              <button onClick={()=>setPage('dashboard')} style={btnSt('#7b1fa2','#9c27b0')}>📉 P&L</button>
              {isAdmin && (
                <button onClick={togLock} style={{ border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontWeight:700, fontSize:13, background:lk?'#ffcdd2':'#c8e6c9', color:lk?'#b71c1c':'#1b5e20' }}>
                  {lk ? '🔒 Locked' : '🔓 Rates'}
                </button>
              )}

              {/* Profile */}
              <div style={{ position:'relative' }}>
                <button onClick={()=>setProfileOpen(v=>!v)}
                  style={{ border:'none', borderRadius:9, padding:'7px 13px', cursor:'pointer', fontWeight:700, fontSize:13, background:'rgba(255,255,255,0.15)', color:'#fff', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:26, height:26, borderRadius:'50%', background:isAdmin?'#ffd54f':'#80cbc4', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#333', fontWeight:800, fontSize:13 }}>
                    {user.displayName?.[0]?.toUpperCase()}
                  </span>
                  <span>{user.displayName}</span>
                  <span style={{ fontSize:10, opacity:.7 }}>▾</span>
                </button>
                {profileOpen && (
                  <div className="slide-down" style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#fff', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', minWidth:200, zIndex:9999, overflow:'hidden', border:'1px solid #f0f0f0' }}>
                    <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,#f8f9ff,#f0f4ff)', borderBottom:'1px solid #f0f0f0' }}>
                      <div style={{ fontWeight:700, color:'#1a237e' }}>{user.displayName}</div>
                      <div style={{ fontSize:12, color:'#888', marginTop:2 }}>@{user.username}</div>
                      <span style={{ display:'inline-block', marginTop:6, background:isAdmin?'#e8eaf6':'#e8f5e9', color:isAdmin?'#1a237e':'#2e7d32', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{user.role}</span>
                    </div>
                    <div style={{ padding:'6px 0' }}>
                      {isAdmin && <ProfileBtn icon="👥" label="Manage Users" onClick={()=>{setProfileOpen(false);setUserMgr(true)}} />}
                      <ProfileBtn icon="🔑" label="Change Password" onClick={()=>{setProfileOpen(false);setChangePw(true)}} />
                      <div style={{ height:1, background:'#f0f0f0', margin:'4px 0' }}/>
                      <ProfileBtn icon="🚪" label="Sign Out" danger onClick={()=>{setProfileOpen(false);if(window.confirm('Sign out?')) logout()}} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Tab bar: Seller | Stocker | Stocker 7 Days ── */}
          <div style={{ display:'flex', gap:4 }}>
            {TABS.map(({ id, label }) => {
              const active = tab === id
              const is7    = id === 'stocker7'
              return (
                <button key={id} onClick={() => setTab(id)}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '10px 10px 0 0',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: is7 ? 13 : 14,
                    background: active ? (is7 ? '#f3e5f5' : '#fff') : 'rgba(255,255,255,0.12)',
                    color: active ? (is7 ? '#6a1b9a' : '#1a237e') : 'rgba(255,255,255,0.9)',
                    position: 'relative',
                  }}>
                  {label}
                  {is7 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -4,
                      background: '#f59e0b', color: '#fff',
                      borderRadius: 10, padding: '1px 6px',
                      fontSize: 9, fontWeight: 800, lineHeight: 1.6,
                    }}>7d</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Live totals strip ── */}
      <div style={{ background: tab==='stocker7' ? '#fdf4ff' : '#fff', borderBottom:'1px solid #e8e8e8', padding:'9px 20px', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ maxWidth:1500, margin:'0 auto', display:'flex', gap:16, flexWrap:'wrap', fontSize:13, alignItems:'center' }}>
          {stripContent()}
          <span style={{ marginLeft:'auto', fontSize:11, color:'#888' }}>
            A→Z sorted &nbsp;•&nbsp; 👤 {user.displayName}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:1500, margin:'0 auto', padding:'18px 20px' }}>

        {/* Stocker 7 Days — purple info banner */}
        {tab === 'stocker7' && (
          <div style={{ background:'linear-gradient(135deg,#f3e5f5,#ede7f6)', border:'1.5px solid #ce93d8', borderRadius:12, padding:'12px 20px', marginBottom:18, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <span style={{ fontSize:22 }}>📅</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#6a1b9a' }}>Stocker 7 Days</div>
              <div style={{ fontSize:12, color:'#7b1fa2', marginTop:2 }}>
                This tab is a separate stocker section. The Running Bill panel automatically shows only bills saved in the last 7 days (since <b>{sevenDaysBoundary}</b>). All features identical to Stocker.
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'#7b1fa2' }}>7-day boundary</div>
              <div style={{ fontWeight:800, color:'#6a1b9a' }}>{sevenDaysBoundary}</div>
            </div>
          </div>
        )}

        <SavedBillsPanel userId={uid} isAdmin={isAdmin} onRefresh={() => setDashTick(t=>t+1)} tick={dashTick} />

        <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <button
            onClick={tab==='seller' ? addS : tab==='stocker' ? addT : addT7}
            style={{ background:'linear-gradient(135deg,#1565c0,#1976d2)', color:'#fff', border:'none', borderRadius:10, padding:'9px 22px', cursor:'pointer', fontWeight:700, fontSize:14, boxShadow:'0 3px 10px rgba(21,101,192,0.3)' }}>
            ➕ Add Customer
          </button>
          <button
            onClick={tab==='seller' ? cleanS : tab==='stocker' ? cleanT : cleanT7}
            style={{ background:'linear-gradient(135deg,#c62828,#e53935)', color:'#fff', border:'none', borderRadius:10, padding:'9px 22px', cursor:'pointer', fontWeight:700, fontSize:14, boxShadow:'0 3px 10px rgba(198,40,40,0.3)' }}>
            🧹 One Click Clean
          </button>
          <span style={{ fontSize:12, color:'#999', marginLeft:'auto' }}>
            {tab==='seller' ? sellers.length : tab==='stocker' ? stockers.length : stockers7.length} customers
            &nbsp;<span style={{ fontSize:11, color:'#bbb' }}>• sorted A→Z</span>
            {tab==='stocker7' && <span style={{ fontSize:11, color:'#7b1fa2', marginLeft:6, fontWeight:600 }}>• 7-day filter active</span>}
          </span>
        </div>

        {/* Seller */}
        {tab==='seller' && (fS.length===0
          ? <Empty icon="📋" text="No seller customers yet" />
          : fS.map(c => <SellerCard key={c.id} c={c} rLock={isAdmin?sLock:false} onChange={d=>updS(c.id,d)} onDel={()=>delS(c.id)} onSaveBill={saveBill}/>)
        )}

        {/* Stocker */}
        {tab==='stocker' && (fT.length===0
          ? <Empty icon="📦" text="No stocker customers yet" />
          : fT.map(c => <StockerCard key={c.id} c={c} rLock={isAdmin?tLock:false} onChange={d=>updT(c.id,d)} onDel={()=>delT(c.id)} onSaveBill={saveBill}/>)
        )}

        {/* Stocker 7 Days — exact same StockerCard, 7-day filter in RunningBill is handled via DB */}
        {tab==='stocker7' && (fT7.length===0
          ? <Empty icon="📅" text="No Stocker 7 Days customers yet" />
          : fT7.map(c => (
              <StockerCard7Days
                key={c.id} c={c}
                rLock={isAdmin?tLock:false}
                onChange={d => updT7(c.id, d)}
                onDel={() => delT7(c.id)}
                onSaveBill={saveBill}
                sevenDaysBoundary={sevenDaysBoundary}
              />
            ))
        )}
      </div>

      <div style={{ textAlign:'center', padding:'18px 20px', color:'#aaa', fontSize:12, borderTop:'1px solid #e8e8e8', background:'#fff' }}>
        🎲 Lottery Billing System &nbsp;•&nbsp; {user.displayName} &nbsp;•&nbsp; {today()}
      </div>
    </div>
  )
}

// ── StockerCard7Days — wraps StockerCard with 7-day boundary context ──

function StockerCard7Days({ c, rLock, onChange, onDel, onSaveBill, sevenDaysBoundary }) {
  return (
    <SevenDayCtx.Provider value={sevenDaysBoundary}>
      <StockerCard c={c} rLock={rLock} onChange={onChange} onDel={onDel} onSaveBill={onSaveBill} />
    </SevenDayCtx.Provider>
  )
}

const btnSt = (c1, c2) => ({ border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontWeight:700, fontSize:13, background:`linear-gradient(135deg,${c1},${c2})`, color:'#fff' })

function SimpleHeader() {
  return (
    <div style={{ background:'linear-gradient(135deg,#1a237e,#3949ab)', color:'#fff', padding:'14px 20px', boxShadow:'0 3px 16px rgba(0,0,0,0.2)' }}>
      <div style={{ maxWidth:1500, margin:'0 auto', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:26 }}>🎲</span>
        <span style={{ fontWeight:800, fontSize:'1.15em' }}>Lottery Billing System</span>
        <span style={{ marginLeft:'auto', fontSize:12, opacity:.7 }}>📅 {today()}</span>
      </div>
    </div>
  )
}
function ProfileBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ width:'100%', background:'none', border:'none', padding:'10px 16px', cursor:'pointer', textAlign:'left', fontSize:13, color:danger?'#c62828':'#333', display:'flex', alignItems:'center', gap:10 }}
      onMouseOver={e => e.currentTarget.style.background = danger?'#fff5f5':'#f5f5f5'}
      onMouseOut={e  => e.currentTarget.style.background = 'none'}>
      {icon} {label}
    </button>
  )
}
function Empty({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'#bbb' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:16 }}>{text}</div>
      <div style={{ fontSize:13, marginTop:6 }}>Click ➕ Add Customer to begin</div>
    </div>
  )
}
