/**
 * RunningBill.jsx — v8
 *
 * NEW DEFINITIONS (final, locked):
 *   Running Bill = Subtotal  (today's sale, BEFORE old due + cut)
 *   Total Bill   = Subtotal + Old Due + Cut
 *
 * Three tiles shown:
 *   [Previous Due]  [Running Bill = Subtotal]  [Total Bill = Subtotal+OD+Cut]
 *
 * Example:
 *   Subtotal = ₹40,000   OD = ₹5,525   Cut = ₹5,25,223
 *   Running Bill = ₹40,000
 *   Total Bill   = ₹5,70,748
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import { fmt, num, today, todayISO, CO_CLR, calcSeller, calcStocker } from '../utils.js'
import * as DB from '../DB.js'
import { useSevenDayBoundary } from '../SevenDayContext.js'

export default function RunningBill({ type, c, onRecordPayment }) {
  const isS  = type === 'seller'
  const calc = isS ? calcSeller(c) : calcStocker(c)
  const { rowCalc, tAmt, tVC, subtotal, od, ct, finalBill, runningBill, totalBill } = calc
  const tPWT = calc.tPWT || 0
  // runningBill = subtotal (Amount − VC)
  // totalBill   = finalBill (Running Bill + Old Due + Cut)

  // 7-day boundary — non-null only when inside Stocker 7 Days tab
  const sevenDayBoundary = useSevenDayBoundary()

  const [expanded, setExpanded] = useState(false)
  const [payAmt,   setPayAmt]   = useState('')
  const [showPay,  setShowPay]  = useState(false)
  const [tick,     setTick]     = useState(0)

  // history: if in Stocker 7 Days tab, only show bills from last 7 days
  const history  = useMemo(() => {
    const all = DB.getBillsByCustomer(c.id)
    if (!sevenDayBoundary) return all
    return all.filter(b => (b.date || '') >= sevenDayBoundary)
  }, [c.id, tick, sevenDayBoundary]) // eslint-disable-line
  const payments = useMemo(() => DB.getTransactionsByCustomer(c.id), [c.id, tick]) // eslint-disable-line

  // Previous Due = what was owed BEFORE today (saved bills from past - payments)
  const previousDue = useMemo(() => {
    const todayStr  = new Date().toISOString().slice(0, 10)
    // prevBills = bills before today (within 7-day window if active, since history is already filtered)
    const prevBills = history.filter(b => b.date !== todayStr)
    // Paise-safe
    const totalPrevP = prevBills.reduce((a, b) => a + Math.round(num(b.finalBill)*100), 0)
    const totalPaidP = payments.reduce((a, p) => a + Math.round(num(p.amount)*100), 0)
    return parseFloat(((totalPrevP - totalPaidP) / 100).toFixed(2))
  }, [history, payments])

  const prevFin = useRef(finalBill)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    if (prevFin.current !== finalBill) {
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 350)
      prevFin.current = finalBill
      return () => clearTimeout(t)
    }
  }, [finalBill])

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmt)
    if (!amt || amt <= 0) { alert('Enter a valid amount'); return }
    await DB.saveTransaction({
      txnId: `txn_${c.id}_${Date.now()}`,
      customerId: c.id, customerName: c.name,
      amount: amt, date: todayISO(), savedAt: new Date().toISOString(),
    })
    setPayAmt(''); setShowPay(false)
    setTick(t => t + 1)
    if (onRecordPayment) onRecordPayment()
  }

  return (
    <div style={{ marginTop:12, borderRadius:14, overflow:'hidden', border:'1px solid #e0e0e0', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>

      {/* ── Header bar ── */}
      <div style={{ background:'linear-gradient(135deg,#37474f,#455a64)', color:'#fff', padding:'10px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span>🧾</span>
            <span style={{ fontWeight:700, fontSize:13 }}>RUNNING BILL</span>
            <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'1px 8px', fontSize:11 }}>Live</span>
            {sevenDayBoundary && (
              <span style={{ background:'#f59e0b', color:'#fff', borderRadius:20, padding:'1px 8px', fontSize:10, fontWeight:700 }}>
                📅 7 Days
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setShowPay(v => !v)}
              style={{ background:'rgba(37,211,102,0.35)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              💰 Payment
            </button>
            <button onClick={() => setExpanded(v => !v)}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              {expanded ? '▲' : '▼ Details'}
            </button>
          </div>
        </div>

        {/* ── 3 tiles: Previous Due | Running Bill | Total Bill ── */}
        <div style={{ display:'flex', gap:10, marginTop:10, flexWrap:'wrap' }}>

          {/* Tile 1: Previous Due */}
          <div style={{ flex:1, minWidth:110, background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, opacity:.8, marginBottom:4, fontWeight:600 }}>Previous Due</div>
            <div style={{ fontWeight:800, fontSize:16 }}>{fmt(previousDue)}</div>
            <div style={{ fontSize:10, opacity:.6, marginTop:3 }}>{history.filter(b => b.date < todayISO()).length} prev bill(s)</div>
          </div>

          {/* Tile 2: Running Bill = Subtotal */}
          <div style={{ flex:1, minWidth:110, background:'rgba(21,101,192,0.4)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, opacity:.9, marginBottom:4, fontWeight:700 }}>🏷️ Running Bill</div>
            <div style={{ fontWeight:900, fontSize:17 }}>{fmt(runningBill)}</div>
            <div style={{ fontSize:10, opacity:.7, marginTop:3 }}>Amount − VC</div>
          </div>

          {/* Tile 3: Total Bill = Subtotal + OD + Cut */}
          <div style={{ flex:1, minWidth:110, background: totalBill>0?'rgba(183,28,28,0.45)':'rgba(27,94,32,0.4)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, opacity:.9, marginBottom:4, fontWeight:700 }}>💳 Total Bill</div>
            <div style={{ fontWeight:900, fontSize:17 }}>{fmt(totalBill)}</div>
            <div style={{ fontSize:10, opacity:.7, marginTop:3 }}>Running Bill + Old Due + Cut</div>
          </div>

        </div>

        {/* Payment form */}
        {showPay && (
          <div style={{ marginTop:10, background:'rgba(255,255,255,0.12)', borderRadius:10, padding:'10px 12px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>💳 Record Payment:</span>
            <input type="number" min="0" placeholder="Amount ₹" value={payAmt}
              onChange={e => setPayAmt(e.target.value)}
              style={{ flex:1, minWidth:100, padding:'7px 10px', borderRadius:8, border:'none', fontSize:13, outline:'none' }}
            />
            <button onClick={handleRecordPayment}
              style={{ background:'#25d366', color:'#fff', border:'none', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontWeight:700, fontSize:13 }}>✅ Save</button>
            <button onClick={() => { setShowPay(false); setPayAmt('') }}
              style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', cursor:'pointer', fontSize:13 }}>✕</button>
          </div>
        )}
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ background:'#fff', padding:'14px 16px' }}>

          {/* Company rows */}
          {rowCalc.map(r => {
            const hasData = num(r.sold) > 0
            return (
              <div key={r.company} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, marginBottom:4, background:hasData?'#f8f9ff':'#fafafa', border:`1px solid ${hasData?'#e8eaf6':'#f0f0f0'}` }}>
                <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:20, color:'#fff', fontSize:11, fontWeight:700, background:CO_CLR[r.company], minWidth:58, textAlign:'center' }}>{r.company}</span>
                <div style={{ flex:1, display:'flex', gap:10, flexWrap:'wrap', fontSize:12, color:'#666' }}>
                  <span>Sold: <b style={{ color:'#333' }}>{num(r.sold)||0}</b></span>
                  {!isS && <span>PWT: <b>{num(r.pwt)||0}</b></span>}
                  <span>Total: <b style={{ color:'#1565c0' }}>{fmt(r.total)}</b></span>
                  <span>VC: <b style={{ color:'#4a148c' }}>{fmt(num(r.vc))}</b></span>
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:r.bill>0?'#c62828':'#2e7d32', minWidth:72, textAlign:'right' }}>{fmt(r.bill)}</span>
              </div>
            )
          })}

          <div style={{ borderTop:'2px dashed #e0e0e0', margin:'12px 0' }}/>

          {/* Calculation chain */}
          {/* Line 1: Running Bill (Subtotal) */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:10, background:'#e3f2fd', border:'1px solid #90caf9', marginBottom:6 }}>
            <div>
              <span style={{ fontSize:13, fontWeight:800, color:'#1565c0' }}>🏷️ Running Bill</span>
              <span style={{ fontSize:11, color:'#888', marginLeft:8 }}>(Amount − VC)</span>
            </div>
            <span style={{ fontWeight:900, fontSize:16, color:'#1565c0' }}>{fmt(runningBill)}</span>
          </div>

          {/* Line 2: Old Due (if any) */}
          {od > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', borderRadius:10, background:'#fff8e1', border:'1px solid #ffe082', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#f57f17' }}>📌 Old Due</span>
              <span style={{ fontWeight:700, fontSize:14, color:'#e65100' }}>+ {fmt(od)}</span>
            </div>
          )}

          {/* Line 3: Cut (if any) */}
          {ct > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', borderRadius:10, background:'#fff3e0', border:'1px solid #ffcc80', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#e65100' }}>✂️ Cut</span>
              <span style={{ fontWeight:700, fontSize:14, color:'#bf360c' }}>+ {fmt(ct)}</span>
            </div>
          )}

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:8, margin:'8px 0' }}>
            <div style={{ flex:1, height:2, background:'linear-gradient(90deg,#1565c0,#b71c1c)' }}/>
            <span style={{ fontSize:11, color:'#999', whiteSpace:'nowrap' }}>= Total Bill</span>
            <div style={{ flex:1, height:2, background:'linear-gradient(90deg,#b71c1c,transparent)' }}/>
          </div>

          {/* Total Bill (red/blue banner) */}
          <div className={pulsing ? 'pulse' : ''} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderRadius:12, background: totalBill>0?'linear-gradient(135deg,#b71c1c,#c62828)':'linear-gradient(135deg,#1b5e20,#2e7d32)', marginBottom:8, boxShadow:`0 4px 16px ${totalBill>0?'rgba(183,28,28,0.3)':'rgba(27,94,32,0.3)'}` }}>
            <div>
              <div style={{ color:'rgba(255,255,255,0.9)', fontSize:13, fontWeight:800 }}>💳 TOTAL BILL</div>
              <div style={{ color:'rgba(255,255,255,0.65)', fontSize:11, marginTop:3 }}>
                {fmt(runningBill)}{od>0?` + ${fmt(od)}`:''}{ct>0?` + ${fmt(ct)}`:''}
              </div>
            </div>
            <div style={{ color:'#fff', fontSize:26, fontWeight:900 }}>{fmt(totalBill)}</div>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:6 }}>💰 Payments Received</div>
              <div style={{ maxHeight:120, overflowY:'auto', borderRadius:8, border:'1px solid #f0f0f0' }}>
                {[...payments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(p => (
                  <div key={p.txnId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                    <span style={{ color:'#666' }}>{p.date}</span>
                    <span style={{ fontWeight:700, color:'#2e7d32' }}>− {fmt(p.amount)}</span>
                    <button onClick={async () => { if(window.confirm('Delete?')){ await DB.deleteTransaction(p.txnId); setTick(t=>t+1); if(onRecordPayment) onRecordPayment() } }}
                      style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#ccc' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bill history */}
          {history.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:6 }}>🕐 Bill History ({history.length}){sevenDayBoundary && <span style={{ fontSize:10, color:'#f59e0b', marginLeft:6, fontWeight:600 }}>(last 7 days only)</span>}</div>
              <div style={{ maxHeight:140, overflowY:'auto', borderRadius:8, border:'1px solid #f0f0f0' }}>
                {[...history].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(b => (
                  <div key={b.billId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', borderBottom:'1px solid #f5f5f5', fontSize:12, flexWrap:'wrap', gap:6 }}>
                    <span style={{ color:'#666' }}>{b.date}</span>
                    <span style={{ color:'#888', fontSize:11 }}>{b.type}</span>
                    <div style={{ display:'flex', gap:10 }}>
                      <span style={{fontSize:11,color:'#555'}}>Running: <b style={{ color:'#1565c0' }}>{fmt(b.runningBill ?? b.subtotal ?? 0)}</b></span>
                      <span style={{fontSize:11,color:'#555'}}>Total: <b style={{ color:b.totalBill>0?'#c62828':'#2e7d32' }}>{fmt(b.totalBill ?? b.finalBill)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
