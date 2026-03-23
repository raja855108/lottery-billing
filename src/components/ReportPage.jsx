import { useState, useMemo } from 'react'
import * as DB from '../DB.js'
import { fmt, num, today, todayISO, CO_CLR, COMPANIES, printSingleBill, printReportPDF, buildCoTotals, waURL, buildWAMsg } from '../utils.js'
import { useAuth } from '../auth/AuthContext.jsx'

const INP = { padding:'8px 12px',borderRadius:8,border:'1.5px solid #ddd',fontSize:13,fontFamily:'inherit',outline:'none' }
const BTN = (bg) => ({ background:bg,color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:13 })

// ── Glassmorphism bill card ───────────────────────────────────────────────────
function BillCard({ b, bi, getCustomerRB, getCustomerTB, isAdmin, userId, onDelete, onPDF, onWA }) {
  const isSeller = b.type === 'seller'
  const rb   = b.runningBill ?? b.subtotal ?? 0
  const tb   = getCustomerTB(b)
  const od   = num(b.oldDue)
  const ct   = num(b.cut)
  const typeClr = isSeller ? '#1565c0' : '#00695c'

  // Old Due display logic
  const odLabel = od > 0 ? `+OD ₹${od.toLocaleString('en-IN')}` : od < 0 ? `Advance ₹${Math.abs(od).toLocaleString('en-IN')}` : null
  const odClr   = od > 0 ? '#e65100' : '#2e7d32'
  const odBg    = od > 0 ? 'linear-gradient(135deg,#fff3e0,#ffe0b2)' : 'linear-gradient(135deg,#e8f5e9,#c8e6c9)'
  const odBorder= od > 0 ? '#ffb74d' : '#81c784'

  const rowCalc = (b.rows||[]).map(r => {
    const sold=num(r.sold),rate=num(r.rate),vc=num(r.vc),pwt=isSeller?0:num(r.pwt)
    const total=parseFloat((Math.round(sold*rate*100)/100).toFixed(2))
    const bill =parseFloat((Math.round((total-pwt-vc)*100)/100).toFixed(2))
    return { ...r, total, bill, pwt }
  })
  const tSold=rowCalc.reduce((a,r)=>a+num(r.sold),0)
  const tAmt =parseFloat((rowCalc.reduce((a,r)=>a+Math.round(r.total*100),0)/100).toFixed(2))
  const tVC  =parseFloat((rowCalc.reduce((a,r)=>a+Math.round(num(r.vc)*100),0)/100).toFixed(2))
  const tPWT =parseFloat((rowCalc.reduce((a,r)=>a+Math.round(r.pwt*100),0)/100).toFixed(2))
  const sub  =parseFloat((tAmt-tPWT-tVC).toFixed(2))

  const cols = isSeller
    ? ['Company','Sold','Rate','Total','VC','Bill']
    : ['Company','Sold','Rate','Total','PWT','VC','Bill']

  return (
    <div style={{
      marginBottom:20,
      borderRadius:20,
      overflow:'hidden',
      background:'linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,245,255,0.95))',
      backdropFilter:'blur(20px)',
      WebkitBackdropFilter:'blur(20px)',
      border:'1.5px solid rgba(255,255,255,0.7)',
      boxShadow:'0 8px 32px rgba(26,35,126,0.10),0 2px 8px rgba(0,0,0,0.06)',
    }}>

      {/* ── Glass header ── */}
      <div style={{
        background:'linear-gradient(135deg,#1a237e 0%,#283593 50%,#3949ab 100%)',
        padding:'14px 20px',
        display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      }}>
        {/* Serial + Avatar */}
        <div style={{ display:'flex',alignItems:'center',gap:10,flex:1,minWidth:200 }}>
          <div style={{ background:'rgba(255,255,255,0.18)',borderRadius:12,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:'#fff',fontSize:15,flexShrink:0 }}>
            {bi+1}
          </div>
          <div>
            <div style={{ fontWeight:900,fontSize:16,color:'#fff',letterSpacing:.3 }}>{b.customerName||'—'}</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2 }}>
              📞 {b.phone||'N/A'} &nbsp;•&nbsp; 📅 {b.date}
            </div>
          </div>
        </div>

        {/* Type badge */}
        <span style={{ background:isSeller?'rgba(33,150,243,0.3)':'rgba(0,150,136,0.3)',border:`1px solid ${isSeller?'rgba(100,181,246,0.6)':'rgba(77,182,172,0.6)'}`,color:'#fff',borderRadius:20,padding:'4px 14px',fontSize:11,fontWeight:800,letterSpacing:.5,flexShrink:0 }}>
          {isSeller ? '✅ SELLER' : '📦 STOCKER'}
        </span>

        {/* OD badge */}
        {odLabel && (
          <div style={{ background:odBg,border:`1.5px solid ${odBorder}`,borderRadius:10,padding:'6px 14px',textAlign:'center',flexShrink:0 }}>
            <div style={{ fontSize:9,color:od>0?'#bf360c':'#1b5e20',fontWeight:700,letterSpacing:.5,marginBottom:2 }}>{od>0?'OLD DUE':'ADVANCE'}</div>
            <div style={{ fontWeight:900,fontSize:14,color:odClr }}>{odLabel}</div>
          </div>
        )}

        {/* Summary boxes */}
        <div style={{ display:'flex',gap:8,flexShrink:0,flexWrap:'wrap' }}>
          {/* Running Bill — Blue glass */}
          <div style={{ background:'linear-gradient(135deg,rgba(21,101,192,0.85),rgba(25,118,210,0.85))',backdropFilter:'blur(10px)',border:'1.5px solid rgba(144,202,249,0.5)',borderRadius:12,padding:'8px 14px',textAlign:'center',minWidth:110 }}>
            <div style={{ fontSize:9,color:'rgba(255,255,255,0.8)',fontWeight:700,letterSpacing:.5,marginBottom:2 }}>🏷️ RUNNING BILL</div>
            <div style={{ fontWeight:900,fontSize:15,color:'#fff' }}>₹{rb.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
          </div>
          {/* Total Bill — Gold glass */}
          <div style={{ background:'linear-gradient(135deg,rgba(180,83,9,0.85),rgba(217,119,6,0.85))',backdropFilter:'blur(10px)',border:'1.5px solid rgba(252,211,77,0.5)',borderRadius:12,padding:'8px 14px',textAlign:'center',minWidth:110 }}>
            <div style={{ fontSize:9,color:'rgba(255,255,255,0.8)',fontWeight:700,letterSpacing:.5,marginBottom:2 }}>💳 TOTAL BILL</div>
            <div style={{ fontWeight:900,fontSize:15,color:'#fff' }}>₹{tb.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex',gap:6,flexShrink:0 }}>
          <button onClick={onPDF} style={{ background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.35)',color:'#fff',borderRadius:8,padding:'7px 12px',cursor:'pointer',fontWeight:700,fontSize:12 }}>📄 PDF</button>
          {b.phone && <button onClick={onWA} style={{ background:'rgba(37,211,102,0.35)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:8,padding:'7px 12px',cursor:'pointer',fontWeight:700,fontSize:12 }}>📲 WA</button>}
          {(isAdmin||b.userId===userId) && <button onClick={onDelete} style={{ background:'rgba(183,28,28,0.35)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',borderRadius:8,padding:'7px 12px',cursor:'pointer',fontWeight:700,fontSize:12 }}>🗑️</button>}
        </div>
      </div>

      {/* ── Company table (glass) ── */}
      <div style={{ padding:'14px 18px 0' }}>
        <div style={{ borderRadius:14,overflow:'hidden',border:'1px solid rgba(26,35,126,0.12)',boxShadow:'0 2px 8px rgba(26,35,126,0.06)' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'linear-gradient(135deg,rgba(26,35,126,0.88),rgba(57,73,171,0.88))' }}>
                {cols.map(h => (
                  <th key={h} style={{ padding:'9px 12px',color:'rgba(255,255,255,0.92)',fontWeight:700,fontSize:11,textAlign:h==='Company'?'left':'center',letterSpacing:.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowCalc.map((r,i) => {
                const hasData = num(r.sold) > 0
                const rowBg = i%2===0 ? 'rgba(255,255,255,0.8)' : 'rgba(240,245,255,0.7)'
                const billClr = r.bill > 0 ? '#c62828' : (hasData ? '#2e7d32' : '#bbb')
                return (
                  <tr key={r.company} style={{ background:rowBg,opacity:hasData?1:0.45,transition:'background .15s' }}>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ background:CO_CLR[r.company]||'#555',color:'#fff',borderRadius:20,padding:'3px 14px',fontSize:11,fontWeight:800,display:'inline-block' }}>{r.company}</span>
                    </td>
                    <td style={{ padding:'9px 12px',textAlign:'center',fontWeight:hasData?700:400,color:hasData?'#1a237e':'#bbb',fontSize:13 }}>{hasData?num(r.sold):'—'}</td>
                    <td style={{ padding:'9px 12px',textAlign:'center',color:'#555',fontSize:13 }}>₹{num(r.rate)}</td>
                    <td style={{ padding:'9px 12px',textAlign:'center',fontWeight:700,color:hasData?'#1565c0':'#bbb',fontSize:13 }}>₹{r.total.toFixed(2)}</td>
                    {!isSeller && <td style={{ padding:'9px 12px',textAlign:'center',color:'#6a1b9a',fontSize:13 }}>{r.pwt||0}</td>}
                    <td style={{ padding:'9px 12px',textAlign:'center',color:hasData?'#4a148c':'#bbb',fontSize:13 }}>VC:₹{num(r.vc).toFixed(2)}</td>
                    <td style={{ padding:'9px 12px',textAlign:'center',fontWeight:700,color:billClr,fontSize:13 }}>₹{r.bill.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Totals footer strip ── */}
      <div style={{ margin:'10px 18px 14px',background:'linear-gradient(135deg,rgba(26,35,126,0.06),rgba(57,73,171,0.1))',borderRadius:12,padding:'12px 18px',display:'flex',gap:18,flexWrap:'wrap',alignItems:'center',border:'1px solid rgba(26,35,126,0.1)' }}>
        <div style={{ display:'flex',gap:4,alignItems:'baseline' }}>
          <span style={{ fontSize:11,color:'#888',fontWeight:600 }}>Sold</span>
          <span style={{ fontWeight:800,color:'#1a237e',fontSize:15 }}>{tSold}</span>
        </div>
        <div style={{ display:'flex',gap:4,alignItems:'baseline' }}>
          <span style={{ fontSize:11,color:'#888',fontWeight:600 }}>Amt</span>
          <span style={{ fontWeight:800,color:'#1565c0',fontSize:15 }}>₹{tAmt.toFixed(2)}</span>
        </div>
        {!isSeller && tPWT>0 && (
          <div style={{ display:'flex',gap:4,alignItems:'baseline' }}>
            <span style={{ fontSize:11,color:'#888',fontWeight:600 }}>PWT</span>
            <span style={{ fontWeight:700,color:'#6a1b9a',fontSize:14 }}>₹{tPWT.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display:'flex',gap:4,alignItems:'baseline' }}>
          <span style={{ fontSize:11,color:'#888',fontWeight:600 }}>VC</span>
          <span style={{ fontWeight:700,color:'#4a148c',fontSize:14 }}>₹{tVC.toFixed(2)}</span>
        </div>
        <div style={{ marginLeft:'auto',background:'linear-gradient(135deg,rgba(230,81,0,0.12),rgba(245,127,23,0.12))',borderRadius:8,padding:'6px 14px',border:'1px solid rgba(245,127,23,0.3)' }}>
          <span style={{ fontSize:11,color:'#e65100',fontWeight:700 }}>Sub: </span>
          <span style={{ fontWeight:900,color:'#bf360c',fontSize:15 }}>₹{sub.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

export default function ReportPage({ onBack, onDeleteAll }) {
  const { user, isAdmin } = useAuth()

  // ── State ─────────────────────────────────────────────────────────────────
  const [bills,       setBills]      = useState(() => isAdmin ? DB.getBills() : DB.getBillsByUser(user.id))
  const [reportType,  setReportType] = useState('seller')   // 'seller' | 'stocker' | 'stocker7'
  const [search,      setSearch]     = useState('')
  const [sortBy,      setSortBy]     = useState('name_asc')
  const [deleteModal, setDeleteModal]= useState(false)
  const [delType,     setDelType]    = useState(null)        // which type to delete

  const refresh = () => setBills(isAdmin ? DB.getBills() : DB.getBillsByUser(user.id))

  // ── 7-day boundary ────────────────────────────────────────────────────────
  const sevenDaysAgo = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0)
    return d.toISOString().slice(0,10)
  })()

  // ── Filtered bills per report type ────────────────────────────────────────
  const filtered = useMemo(() => {
    let b = [...bills]
    // Type filter
    if (reportType === 'seller')   b = b.filter(x => x.type === 'seller')
    if (reportType === 'stocker')  b = b.filter(x => x.type === 'stocker')
    if (reportType === 'stocker7') b = b.filter(x => x.type === 'stocker' && (x.date||'') >= sevenDaysAgo)
    // Search
    const q = search.toLowerCase().trim()
    if (q) b = b.filter(x => (x.customerName||'').toLowerCase().includes(q) || (x.phone||'').includes(q))
    // Sort
    if (sortBy === 'date_desc')     b.sort((a,z) => z.date.localeCompare(a.date))
    else if (sortBy === 'date_asc') b.sort((a,z) => a.date.localeCompare(z.date))
    else if (sortBy === 'bill_desc')b.sort((a,z) => z.finalBill - a.finalBill)
    else                            b.sort((a,z) => (a.customerName||'').localeCompare(z.customerName||'','en',{sensitivity:'base'}))
    return b
  }, [bills, reportType, search, sortBy, sevenDaysAgo])

  const getCustomerRB = b => b.runningBill ?? b.subtotal ?? 0
  const getCustomerTB = b => b.totalBill  ?? b.finalBill ?? 0

  // ── Grand totals for current filtered set ─────────────────────────────────
  const summary = useMemo(() => {
    const mlSold = filtered.reduce((a,b)=>{const r=(b.rows||[]).find(r=>r.company==='ML'); return a+num(r?.sold||0)}, 0)
    const nbSold = filtered.reduce((a,b)=>{const r=(b.rows||[]).find(r=>r.company==='NB'); return a+num(r?.sold||0)}, 0)
    const bkSold = filtered.reduce((a,b)=>{const r=(b.rows||[]).find(r=>r.company==='Booking'); return a+num(r?.sold||0)}, 0)
    const tAmt   = parseFloat((filtered.reduce((a,b)=>{
      return a + (b.rows||[]).reduce((s,r) => s + Math.round(num(r.sold)*num(r.rate)*100)/100, 0)
    }, 0)).toFixed(2))
    const tVC    = parseFloat((filtered.reduce((a,b)=>{
      return a + (b.rows||[]).reduce((s,r) => s + Math.round(num(r.vc)*100)/100, 0)
    }, 0)).toFixed(2))
    const tRB    = parseFloat((filtered.reduce((a,b) => a + Math.round((b.runningBill??b.subtotal??0)*100),0)/100).toFixed(2))
    const tOD    = parseFloat((filtered.reduce((a,b) => a + Math.round(num(b.oldDue)*100),0)/100).toFixed(2))
    const tTB    = parseFloat((filtered.reduce((a,b) => a + Math.round((b.totalBill??b.finalBill??0)*100),0)/100).toFixed(2))
    return { count:filtered.length, mlSold, nbSold, bkSold, tAmt, tVC, tRB, tOD, tTB }
  }, [filtered])

  const coTotals = useMemo(() => {
    const t = {}
    COMPANIES.forEach(co => { t[co] = { sold:0, amt:0, pwt:0, vc:0, amtP:0, pwtP:0, vcP:0 } })
    filtered.forEach(b => {
      ;(b.rows||[]).forEach(r => {
        const co = r.company; if (!t[co]) return
        t[co].sold += num(r.sold)
        t[co].amtP = (t[co].amtP||0) + Math.round(num(r.sold)*num(r.rate)*100)
        t[co].pwtP = (t[co].pwtP||0) + (b.type==='stocker' ? Math.round(num(r.pwt)*100) : 0)
        t[co].vcP  = (t[co].vcP||0)  + Math.round(num(r.vc)*100)
      })
    })
    COMPANIES.forEach(co => {
      if (!t[co]) return
      t[co].amt = parseFloat(((t[co].amtP||0)/100).toFixed(2))
      t[co].pwt = parseFloat(((t[co].pwtP||0)/100).toFixed(2))
      t[co].vc  = parseFloat(((t[co].vcP||0) /100).toFixed(2))
    })
    return t
  }, [filtered])

  const grandTotal    = summary.tTB
  const grandSubtotal = summary.tRB
  const grandOldDue   = summary.tOD

  // ── PDF helpers ───────────────────────────────────────────────────────────
  const makeCoTotalsAndTotals = (billSet) => {
    const ct   = buildCoTotals(billSet)
    const gt   = parseFloat((billSet.reduce((a,b)=>a+Math.round(num(b.totalBill??b.finalBill)*100),0)/100).toFixed(2))
    const gsub = parseFloat((billSet.reduce((a,b)=>a+Math.round(num(b.runningBill??b.subtotal)*100),0)/100).toFixed(2))
    const god  = parseFloat((billSet.reduce((a,b)=>a+Math.round(num(b.oldDue)*100),0)/100).toFixed(2))
    return { ct, gt, gsub, god }
  }

  const exportSellerPDF = () => {
    const b = bills.filter(x => x.type === 'seller')
    if (!b.length) { alert('No seller bills to export.'); return }
    const { ct,gt,gsub,god } = makeCoTotalsAndTotals(b)
    printReportPDF(b, ct, gt, gsub, god, getCustomerRB, '✅ Seller Report', 'Seller_Report')
  }
  const exportStockerPDF = () => {
    const b = bills.filter(x => x.type === 'stocker')
    if (!b.length) { alert('No stocker bills to export.'); return }
    const { ct,gt,gsub,god } = makeCoTotalsAndTotals(b)
    printReportPDF(b, ct, gt, gsub, god, getCustomerRB, '📦 Stocker Report', 'Stocker_Report')
  }
  const exportStocker7PDF = () => {
    const b = bills.filter(x => x.type === 'stocker' && (x.date||'') >= sevenDaysAgo)
    if (!b.length) { alert('No stocker bills in last 7 days.'); return }
    const { ct,gt,gsub,god } = makeCoTotalsAndTotals(b)
    printReportPDF(b, ct, gt, gsub, god, getCustomerRB, '📅 Stocker 7 Days Report', 'Stocker_7Days_Report')
  }
  const exportCurrentPDF = () => {
    if (!filtered.length) { alert('No bills to export.'); return }
    const { ct,gt,gsub,god } = makeCoTotalsAndTotals(filtered)
    const labels = { seller:'✅ Seller Report', stocker:'📦 Stocker Report', stocker7:'📅 Stocker 7 Days Report' }
    const files  = { seller:'Seller_Report', stocker:'Stocker_Report', stocker7:'Stocker_7Days_Report' }
    printReportPDF(filtered, ct, gt, gsub, god, getCustomerRB, labels[reportType], files[reportType])
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  const exportExcel = () => {
    const label = { seller:'Seller', stocker:'Stocker', stocker7:'Stocker_7Days' }[reportType]
    const rows = [
      ['#','Customer Name','Phone','Type','Date','ML Sold','NB Sold','Booking Sold','Total Amount','VC','Today Bill','Old Due','Running Bill','Total Bill'],
      ...filtered.map((b,i) => {
        const mlSold = num((b.rows||[]).find(r=>r.company==='ML')?.sold||0)
        const nbSold = num((b.rows||[]).find(r=>r.company==='NB')?.sold||0)
        const bkSold = num((b.rows||[]).find(r=>r.company==='Booking')?.sold||0)
        const tAmt   = parseFloat(((b.rows||[]).reduce((s,r)=>s+Math.round(num(r.sold)*num(r.rate)*100)/100,0)).toFixed(2))
        const tVC    = parseFloat(((b.rows||[]).reduce((s,r)=>s+Math.round(num(r.vc)*100)/100,0)).toFixed(2))
        return [
          i+1, b.customerName||'—', b.phone||'N/A', b.type, b.date,
          mlSold, nbSold, bkSold, tAmt, tVC,
          getCustomerRB(b), num(b.oldDue), getCustomerRB(b), getCustomerTB(b)
        ]
      }),
      [],
      ['TOTAL','','','','',summary.mlSold,summary.nbSold,summary.bkSold,summary.tAmt,summary.tVC,'',summary.tOD,summary.tRB,summary.tTB]
    ]
    // Build CSV
    const csv = rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const bom  = '\uFEFF'
    const blob = new Blob([bom+csv], { type:'text/csv;charset=utf-8;' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${label}_Report_${todayISO()}.csv`
    a.click()
  }

  // ── Delete by type (bills only — customers untouched) ─────────────────────
  const doDeleteByType = async (dtype) => {
    let toDelete
    if (dtype === 'seller')   toDelete = bills.filter(b => b.type === 'seller')
    if (dtype === 'stocker')  toDelete = bills.filter(b => b.type === 'stocker')
    if (dtype === 'stocker7') toDelete = bills.filter(b => b.type === 'stocker' && (b.date||'') >= sevenDaysAgo)
    if (!toDelete?.length) { alert('No bills found to delete.'); return }
    for (const b of toDelete) { await DB.deleteBill(b.billId) }
    refresh()
  }

  // ── JSON export ───────────────────────────────────────────────────────────
  const exportJSON = () => {
    const blob = new Blob([DB.exportAll()], { type:'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `lottery-db-${todayISO()}.json`; a.click()
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  const TABS = [
    { id:'seller',   label:'✅ Seller',         color:'#1565c0', bg:'linear-gradient(135deg,#1565c0,#1976d2)' },
    { id:'stocker',  label:'📦 Stocker',         color:'#00695c', bg:'linear-gradient(135deg,#00695c,#00897b)' },
    { id:'stocker7', label:'📅 Stocker 7 Days',  color:'#6a1b9a', bg:'linear-gradient(135deg,#6a1b9a,#8e24aa)' },
  ]
  const activeTab = TABS.find(t => t.id === reportType)

  // ── Summary tiles ─────────────────────────────────────────────────────────
  const summaryTiles = [
    { icon:'👥', label:'Total Customers',  val:summary.count,        bg:'#e8eaf6', col:'#1a237e' },
    { icon:'🎫', label:'ML Sold',          val:summary.mlSold,       bg:'#e3f2fd', col:'#1565c0' },
    { icon:'🎟️', label:'NB Sold',          val:summary.nbSold,       bg:'#f3e5f5', col:'#6a1b9a' },
    { icon:'💰', label:'Total Amount',     val:fmt(summary.tAmt),    bg:'#e8f5e9', col:'#2e7d32' },
    { icon:'🎁', label:'Total VC',         val:fmt(summary.tVC),     bg:'#fce4ec', col:'#ad1457' },
    { icon:'🏷️', label:'Total Running Bill',val:fmt(summary.tRB),   bg:'#e3f2fd', col:'#1565c0' },
    { icon:'📌', label:'Total Due',        val:fmt(summary.tOD),     bg:'#fff8e1', col:'#f57f17' },
  ]

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'20px 16px', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>

      {/* Delete type modal */}
      {deleteModal && delType && (
        <DeleteTypeModal
          dtype={delType}
          sevenDaysAgo={sevenDaysAgo}
          onClose={() => { setDeleteModal(false); setDelType(null) }}
          onConfirm={async () => {
            await doDeleteByType(delType)
            if (delType === 'all' && onDeleteAll) onDeleteAll()
            setDeleteModal(false); setDelType(null)
          }}
        />
      )}

      {/* ── Page title ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <button onClick={onBack} style={BTN('#455a64')}>← Back</button>
        <h2 style={{ fontSize:'1.3em', color:'#1a237e', flex:1, fontWeight:900, margin:0 }}>📊 Reports</h2>
        {isAdmin && <button onClick={exportJSON} style={BTN('linear-gradient(135deg,#00695c,#00897b)')}>💾 JSON</button>}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BLOCK 1 — View Report Type buttons                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={{ background:'#fff', borderRadius:16, padding:'16px 18px', marginBottom:14, border:'1px solid #e8eaf6', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>📋 View Report</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setReportType(tab.id); setSearch('') }}
              style={{
                border: reportType===tab.id ? 'none' : '1.5px solid #e0e0e0',
                borderRadius:10, padding:'10px 22px', cursor:'pointer',
                fontWeight:800, fontSize:13,
                background: reportType===tab.id ? tab.bg : '#f8f9ff',
                color: reportType===tab.id ? '#fff' : tab.color,
                boxShadow: reportType===tab.id ? '0 4px 14px rgba(0,0,0,0.2)' : 'none',
                transition:'all .15s',
              }}>
              {tab.label}
              {reportType===tab.id && (
                <span style={{ marginLeft:8, background:'rgba(255,255,255,0.25)', borderRadius:10, padding:'1px 8px', fontSize:11 }}>
                  {filtered.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BLOCK 2 — PDF download buttons                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={{ background:'#fff', borderRadius:16, padding:'16px 18px', marginBottom:14, border:'1px solid #e8eaf6', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>📄 Download PDF</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={exportSellerPDF}
            style={{ border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:12, background:'linear-gradient(135deg,#1565c0,#1976d2)', color:'#fff' }}>
            📥 Seller Report.pdf
          </button>
          <button onClick={exportStockerPDF}
            style={{ border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:12, background:'linear-gradient(135deg,#00695c,#00897b)', color:'#fff' }}>
            📥 Stocker Report.pdf
          </button>
          <button onClick={exportStocker7PDF}
            style={{ border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:12, background:'linear-gradient(135deg,#6a1b9a,#8e24aa)', color:'#fff' }}>
            📥 Stocker 7 Days.pdf
          </button>
          <div style={{ width:1, height:32, background:'#e0e0e0', margin:'0 4px' }}/>
          <button onClick={exportExcel}
            style={{ border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:12, background:'linear-gradient(135deg,#1b5e20,#2e7d32)', color:'#fff' }}>
            📊 Download Excel (.csv)
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BLOCK 3 — Delete buttons                                  */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={{ background:'#fff3f3', borderRadius:16, padding:'16px 18px', marginBottom:20, border:'1.5px solid #ffcdd2', boxShadow:'0 2px 8px rgba(183,28,28,0.06)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#c62828', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>🗑️ Delete Report Data (bills only — customers are NOT deleted)</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {[
            { dtype:'seller',   label:'Delete Seller Report',       bg:'rgba(183,28,28,0.08)', border:'#ef9a9a', col:'#b71c1c' },
            { dtype:'stocker',  label:'Delete Stocker Report',      bg:'rgba(183,28,28,0.08)', border:'#ef9a9a', col:'#b71c1c' },
            { dtype:'stocker7', label:'Delete Stocker 7 Days',      bg:'rgba(183,28,28,0.08)', border:'#ef9a9a', col:'#b71c1c' },
          ].map(({ dtype, label, bg, border, col }) => (
            <button key={dtype}
              onClick={() => { setDelType(dtype); setDeleteModal(true) }}
              style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:12, color:col }}>
              🗑️ {label}
            </button>
          ))}
          <div style={{ marginLeft:'auto' }}>
            <button onClick={() => { setDelType('all'); setDeleteModal(true) }}
              style={{ border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontWeight:700, fontSize:12, background:'linear-gradient(135deg,#b71c1c,#c62828)', color:'#fff', boxShadow:'0 2px 8px rgba(183,28,28,0.3)' }}>
              ⚠️ Delete All Data
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SUMMARY TILES for current report type                     */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={{ background:'#fff', borderRadius:16, padding:'16px 18px', marginBottom:14, border:'1px solid #e8eaf6', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5 }}>📊 Summary —</span>
          <span style={{ background:activeTab.bg, color:'#fff', borderRadius:20, padding:'2px 12px', fontSize:11, fontWeight:800 }}>{activeTab.label}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
          {summaryTiles.map(({ icon,label,val,bg,col }) => (
            <div key={label} style={{ background:bg, borderRadius:12, padding:'12px 10px', textAlign:'center', border:'1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:.3, marginBottom:3, lineHeight:1.3 }}>{label}</div>
              <div style={{ fontWeight:900, fontSize:14, color:col }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + sort bar ── */}
      <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px', marginBottom:16, border:'1px solid #e8e8e8', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{...INP, flex:1, minWidth:160}} placeholder={`🔍 Search in ${activeTab.label}…`} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={INP} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="name_asc">Name A–Z</option>
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="bill_desc">Highest Bill</option>
        </select>
        <button onClick={()=>{setSearch('');setSortBy('name_asc')}} style={BTN('#757575')}>✕ Clear</button>
        <button onClick={exportCurrentPDF}
          style={{ border:'none', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:700, fontSize:12, background:activeTab.bg, color:'#fff' }}>
          📄 PDF This View
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* REPORT TABLE                                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#bbb', background:'#fff', borderRadius:16, border:'1px solid #e8e8e8' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:15 }}>No bills found for {activeTab.label}.</div>
          <div style={{ fontSize:13, marginTop:6 }}>Save bills first using 💾 Save Bill on customer cards.</div>
        </div>
      ) : (
        <>
          {/* Summary table view */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8eaf6', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:20 }}>
            <div style={{ background:'linear-gradient(135deg,#1a237e,#283593,#3949ab)', padding:'12px 18px', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ color:'#fff', fontWeight:900, fontSize:14 }}>📋 {activeTab.label} — Bill Summary</span>
              <span style={{ background:'rgba(255,255,255,0.2)', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{filtered.length} customers</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                <thead>
                  <tr style={{ background:'#f0f4ff', borderBottom:'2px solid #e8eaf6' }}>
                    {['#','Customer Name','ML Sold','NB Sold','Total Amt','VC','Today Bill','Old Due','Running Bill','Total Bill',''].map((h,i) => (
                      <th key={i} style={{ padding:'10px 12px', textAlign:i===0||i===1?'left':'right', fontSize:11, fontWeight:800, color:'#37474f', letterSpacing:.3, whiteSpace:'nowrap', borderBottom:'2px solid #e8eaf6' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, bi) => {
                    const mlSold = num((b.rows||[]).find(r=>r.company==='ML')?.sold||0)
                    const nbSold = num((b.rows||[]).find(r=>r.company==='NB')?.sold||0)
                    const tAmt   = parseFloat(((b.rows||[]).reduce((s,r)=>s+Math.round(num(r.sold)*num(r.rate)*100)/100,0)).toFixed(2))
                    const tVC    = parseFloat(((b.rows||[]).reduce((s,r)=>s+Math.round(num(r.vc)*100)/100,0)).toFixed(2))
                    const rb     = getCustomerRB(b)
                    const tb     = getCustomerTB(b)
                    const od     = num(b.oldDue)
                    const rowBg  = bi%2===0 ? '#fff' : '#fafbff'
                    return (
                      <tr key={b.billId} style={{ background:rowBg, borderBottom:'1px solid #f0f0f0' }}
                        onMouseOver={e=>e.currentTarget.style.background='#f0f4ff'}
                        onMouseOut={e=>e.currentTarget.style.background=rowBg}>
                        <td style={{ padding:'10px 12px', color:'#bbb', fontSize:11, fontWeight:600 }}>{bi+1}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ fontWeight:800, fontSize:13, color:'#1a237e' }}>{b.customerName||'—'}</div>
                          <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{b.phone||'N/A'} • {b.date}</div>
                        </td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'#1565c0' }}>{mlSold||<span style={{color:'#ccc'}}>0</span>}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'#6a1b9a' }}>{nbSold||<span style={{color:'#ccc'}}>0</span>}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'#1a237e' }}>{fmt(tAmt)}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:'#4a148c' }}>{fmt(tVC)}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'#e65100' }}>{fmt(rb)}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:od>0?'#c62828':'#888', fontWeight:od>0?700:400 }}>
                          {od>0?<span style={{color:'#e65100',fontWeight:700}}>+{fmt(od)}</span>:od<0?<span style={{color:'#2e7d32',fontWeight:700}}>ADV {fmt(Math.abs(od))}</span>:<span style={{color:'#bbb'}}>—</span>}
                        </td>
                        <td style={{ padding:'10px 12px', textAlign:'right' }}>
                          <span style={{ background:'linear-gradient(135deg,#1565c0,#1976d2)', color:'#fff', borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:800 }}>{fmt(rb)}</span>
                        </td>
                        <td style={{ padding:'10px 12px', textAlign:'right' }}>
                          <span style={{ background:tb>0?'linear-gradient(135deg,#b45309,#d97706)':'linear-gradient(135deg,#2e7d32,#43a047)', color:'#fff', borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:800 }}>{fmt(tb)}</span>
                        </td>
                        <td style={{ padding:'10px 8px', textAlign:'right' }}>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => printSingleBill(b.type, { ...b, name:b.customerName, rows:b.rows, oldDue:b.oldDue, cut:b.cut })}
                              style={{ background:'#e3f2fd', color:'#1565c0', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>📄</button>
                            {b.phone && (
                              <button onClick={() => window.open(waURL(b.phone, buildWAMsg(b.type, { ...b, name:b.customerName, rows:b.rows, oldDue:b.oldDue, cut:b.cut }, true, rb)), '_blank')}
                                style={{ background:'#e8f5e9', color:'#2e7d32', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>📲</button>
                            )}
                            {(isAdmin||b.userId===user.id) && (
                              <button onClick={()=>{ if(window.confirm('Delete this bill entry?\n\nNote: The customer on the Main Page will NOT be deleted.')){ DB.deleteBill(b.billId); refresh() } }}
                                style={{ background:'#ffebee', color:'#c62828', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Totals footer row */}
                <tfoot>
                  <tr style={{ background:'linear-gradient(135deg,#1a237e,#283593)', borderTop:'2px solid #1a237e' }}>
                    <td colSpan={2} style={{ padding:'12px 14px', color:'#fff', fontWeight:900, fontSize:13 }}>TOTAL ({filtered.length})</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#90caf9', fontWeight:800, fontSize:13 }}>{summary.mlSold}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#ce93d8', fontWeight:800, fontSize:13 }}>{summary.nbSold}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#a5d6a7', fontWeight:800, fontSize:13 }}>{fmt(summary.tAmt)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#f48fb1', fontWeight:800 }}>{fmt(summary.tVC)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#fff', fontWeight:800 }}>{fmt(summary.tRB)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#ffcc80', fontWeight:800 }}>{fmt(summary.tOD)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#90caf9', fontWeight:900, fontSize:14 }}>{fmt(summary.tRB)}</td>
                    <td style={{ padding:'12px 14px', textAlign:'right', color:'#ffb74d', fontWeight:900, fontSize:14 }}>{fmt(summary.tTB)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Detailed BillCards */}
          <div style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#37474f' }}>📋 Detailed View</span>
            <span style={{ fontSize:11, color:'#888' }}>— Full billing breakdown per customer</span>
          </div>
          {filtered.map((b, bi) => (
            <BillCard
              key={b.billId} b={b} bi={bi}
              getCustomerRB={getCustomerRB}
              getCustomerTB={getCustomerTB}
              isAdmin={isAdmin}
              userId={user.id}
              onDelete={() => { if(window.confirm('Delete this bill entry?\n\nNote: The customer on the Main Page will NOT be deleted.')){ DB.deleteBill(b.billId); refresh() } }}
              onPDF={() => printSingleBill(b.type, { ...b, name:b.customerName, rows:b.rows, oldDue:b.oldDue, cut:b.cut })}
              onWA={() => {
                if (!b.phone) { alert('No phone number saved.'); return }
                const rb = getCustomerRB(b)
                window.open(waURL(b.phone, buildWAMsg(b.type, { ...b, name:b.customerName, rows:b.rows, oldDue:b.oldDue, cut:b.cut }, true, rb)), '_blank')
              }}
            />
          ))}
        </>
      )}

    </div>
  )
}

// ── DeleteTypeModal — per-type delete with double confirmation ─────────────────
function DeleteTypeModal({ dtype, sevenDaysAgo, onClose, onConfirm }) {
  const [typed, setTyped] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [shake, setShake] = useState(false)

  const labels = { seller:'Seller Report', stocker:'Stocker Report', stocker7:'Stocker 7 Days Report', all:'All Data' }
  const label  = labels[dtype] || dtype

  const deleteRules = {
    seller:   'DELETE bills WHERE type = "seller"',
    stocker:  'DELETE bills WHERE type = "stocker"',
    stocker7: `DELETE bills WHERE type = "stocker" AND date >= "${sevenDaysAgo}"`,
    all:      'DELETE ALL bills + transactions + customer lists',
  }

  const handleConfirm = async () => {
    if (typed.trim() !== 'DELETE') {
      setShake(true); setTimeout(()=>setShake(false), 500); return
    }
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,backdropFilter:'blur(4px)',padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:460,boxShadow:'0 32px 80px rgba(0,0,0,0.45)',overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#b71c1c,#c62828)',padding:'20px 24px',display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:32 }}>🗑️</span>
          <div>
            <div style={{ color:'#fff',fontWeight:900,fontSize:16 }}>Delete {label}</div>
            <div style={{ color:'rgba(255,255,255,0.75)',fontSize:12,marginTop:2 }}>Bill entries only — customers NOT deleted</div>
          </div>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ background:'#fff3e0',border:'1.5px solid #ffcc80',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#555',lineHeight:1.7 }}>
            <b style={{color:'#e65100'}}>⚠️ This will delete:</b><br/>
            <code style={{background:'#f5f5f5',padding:'2px 6px',borderRadius:4,fontSize:12,color:'#1a237e'}}>{deleteRules[dtype]}</code><br/><br/>
            ✅ Customers on the <b>Main Page</b> will <b>NOT be deleted</b>.<br/>
            ✅ Customer master data stays intact.<br/>
            ✅ Only saved bill/report entries are removed.
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13,fontWeight:700,color:'#333',marginBottom:6 }}>
              Type <code style={{background:'#ffebee',color:'#c62828',padding:'2px 8px',borderRadius:6,fontWeight:900,letterSpacing:2}}>DELETE</code> to confirm:
            </div>
            <input autoFocus value={typed} onChange={e=>{setTyped(e.target.value);setShake(false)}}
              onKeyDown={e=>e.key==='Enter'&&handleConfirm()}
              placeholder="Type DELETE here…"
              style={{ width:'100%',padding:'11px 14px',borderRadius:10,border:`2px solid ${typed==='DELETE'?'#2e7d32':shake?'#c62828':'#ddd'}`,fontSize:15,fontFamily:'monospace',letterSpacing:2,outline:'none',fontWeight:700,
                animation:shake?'shake 0.5s':'none' }}/>
            {typed==='DELETE' && <div style={{color:'#2e7d32',fontSize:12,marginTop:4,fontWeight:600}}>✅ Ready to delete</div>}
          </div>
          <div style={{ display:'flex',gap:10 }}>
            <button onClick={onClose} style={{ flex:1,background:'#f5f5f5',border:'1px solid #ddd',borderRadius:10,padding:'12px',cursor:'pointer',fontWeight:700,fontSize:14,color:'#555' }}>
              ✕ Cancel
            </button>
            <button onClick={handleConfirm} disabled={busy||!typed.trim()}
              style={{ flex:1,background:typed==='DELETE'?'linear-gradient(135deg,#b71c1c,#c62828)':'#bdbdbd',color:'#fff',border:'none',borderRadius:10,padding:'12px',cursor:typed.trim()?'pointer':'not-allowed',fontWeight:800,fontSize:14 }}>
              {busy?'⏳ Deleting…':'🗑️ Delete Now'}
            </button>
          </div>
        </div>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
      </div>
    </div>
  )
}


// ── DeleteAllModal ─────────────────────────────────────────────────────────────
// Double confirmation: button click → type "DELETE" prompt → final warning
function DeleteAllModal({ onClose, onConfirm }) {
  const [step,    setStep]    = useState(1)   // 1=warning, 2=type-confirm, 3=final
  const [typed,   setTyped]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [shaking, setShaking] = useState(false)

  const shake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  const handleConfirmTyped = () => {
    if (typed.trim() !== 'DELETE') { shake(); return }
    setStep(3)
  }

  const handleFinalDelete = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  const overlay = {
    position:'fixed', inset:0,
    background:'rgba(0,0,0,0.72)',
    display:'flex', alignItems:'center', justifyContent:'center',
    zIndex:9999, backdropFilter:'blur(4px)', padding:16,
  }
  const box = {
    background:'#fff', borderRadius:20,
    width:'100%', maxWidth:480,
    boxShadow:'0 32px 80px rgba(0,0,0,0.45)',
    overflow:'hidden',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>

        {/* Red danger header */}
        <div style={{ background:'linear-gradient(135deg,#b71c1c,#c62828)', padding:'22px 24px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:36, filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>⚠️</div>
          <div>
            <div style={{ color:'#fff', fontWeight:900, fontSize:17, letterSpacing:.3 }}>Delete All Saved Data</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:3 }}>
              Step {step} of 3 — This action cannot be undone
            </div>
          </div>
        </div>

        <div style={{ padding:'22px 24px' }}>

          {/* ── Step 1: First warning ── */}
          {step === 1 && (
            <>
              <div style={{ background:'#fff5f5', border:'1.5px solid #ffcdd2', borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
                <div style={{ fontWeight:700, color:'#c62828', fontSize:14, marginBottom:8 }}>⚠️ You are about to permanently delete:</div>
                <ul style={{ margin:0, paddingLeft:20, color:'#555', fontSize:13, lineHeight:2 }}>
                  <li>All saved customer bills</li>
                  <li>All seller customer records</li>
                  <li>All stocker customer records</li>
                  <li>All stocker 7-day records</li>
                  <li>All payment transactions</li>
                  <li>All report history</li>
                </ul>
                <div style={{ marginTop:12, fontWeight:700, color:'#b71c1c', fontSize:13 }}>
                  ❌ This cannot be recovered. User accounts will NOT be deleted.
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={onClose}
                  style={{ flex:1, background:'#f5f5f5', border:'1px solid #ddd', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:700, fontSize:14, color:'#555' }}>
                  ✕ Cancel
                </button>
                <button onClick={() => setStep(2)}
                  style={{ flex:1, background:'linear-gradient(135deg,#c62828,#e53935)', color:'#fff', border:'none', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:800, fontSize:14 }}>
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Type "DELETE" ── */}
          {step === 2 && (
            <>
              <div style={{ marginBottom:18 }}>
                <div style={{ fontWeight:700, color:'#333', fontSize:14, marginBottom:6 }}>
                  Type <code style={{ background:'#ffebee', color:'#c62828', padding:'2px 8px', borderRadius:6, fontWeight:900, letterSpacing:2 }}>DELETE</code> to confirm:
                </div>
                <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
                  This is a safety step. Type exactly in CAPITALS.
                </div>
                <input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmTyped()}
                  placeholder="Type DELETE here…"
                  style={{
                    width:'100%', padding:'12px 14px', borderRadius:10,
                    border:`2px solid ${typed === 'DELETE' ? '#2e7d32' : shaking ? '#c62828' : '#ddd'}`,
                    fontSize:16, fontFamily:'monospace', letterSpacing:2,
                    outline:'none', fontWeight:700, color:'#333',
                    transition:'border-color .15s',
                    animation: shaking ? 'shake 0.5s' : 'none',
                  }}
                />
                {shaking && (
                  <div style={{ color:'#c62828', fontSize:12, fontWeight:600, marginTop:6 }}>
                    ⚠️ Please type DELETE exactly (in capitals)
                  </div>
                )}
                {typed === 'DELETE' && (
                  <div style={{ color:'#2e7d32', fontSize:12, fontWeight:600, marginTop:6 }}>
                    ✅ Confirmed — click Proceed to continue
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={onClose}
                  style={{ flex:1, background:'#f5f5f5', border:'1px solid #ddd', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:700, fontSize:14, color:'#555' }}>
                  ✕ Cancel
                </button>
                <button onClick={handleConfirmTyped}
                  disabled={typed.trim().length === 0}
                  style={{ flex:1, background: typed==='DELETE' ? 'linear-gradient(135deg,#c62828,#e53935)' : '#bdbdbd', color:'#fff', border:'none', borderRadius:10, padding:'12px', cursor: typed.trim().length ? 'pointer':'not-allowed', fontWeight:800, fontSize:14 }}>
                  Proceed →
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Final confirmation ── */}
          {step === 3 && (
            <>
              <div style={{ background:'#fff5f5', border:'2px solid #c62828', borderRadius:12, padding:'16px 18px', marginBottom:20, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>🚨</div>
                <div style={{ fontWeight:900, color:'#b71c1c', fontSize:15, marginBottom:6 }}>
                  LAST CHANCE — Are you absolutely sure?
                </div>
                <div style={{ color:'#555', fontSize:13 }}>
                  All billing data will be permanently erased.<br/>
                  <strong>This cannot be undone.</strong>
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={onClose}
                  style={{ flex:1, background:'#e8f5e9', border:'1.5px solid #a5d6a7', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:700, fontSize:14, color:'#2e7d32' }}>
                  🛡️ No, Keep Data
                </button>
                <button onClick={handleFinalDelete} disabled={busy}
                  style={{ flex:1, background: busy ? '#bdbdbd' : 'linear-gradient(135deg,#7f0000,#b71c1c)', color:'#fff', border:'none', borderRadius:10, padding:'12px', cursor: busy ? 'not-allowed':'pointer', fontWeight:900, fontSize:14, boxShadow:'0 4px 14px rgba(183,28,28,0.4)' }}>
                  {busy ? '⏳ Deleting…' : '🗑️ YES, Delete Everything'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  )
}
