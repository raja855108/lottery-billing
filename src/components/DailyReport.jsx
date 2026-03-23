/**
 * DailyReport — Feature 6: Daily Profit Report
 * Reads saved bills for selected date, computes full business summary.
 * Export PDF + WhatsApp share built-in.
 */
import { useState, useMemo } from 'react'
import { fmt, num, today, todayISO, COMPANIES, CO_CLR } from '../utils.js'
import * as DB from '../DB.js'

export default function DailyReport({ onClose }) {
  const [date,    setDate]    = useState(todayISO())
  const [refresh, setRefresh] = useState(0)

  // Re-read bills whenever date changes or refresh triggered
  const bills = useMemo(() => {
    // Touch refresh to bust memoize
    void refresh
    return DB.getBills().filter(b =>
      (b.date || (b.savedAt || '').slice(0, 10)) === date
    )
  }, [date, refresh])

  const stats = useMemo(() => {
    const coMap = {}
    COMPANIES.forEach(co => { coMap[co] = { sold: 0, amt: 0, vc: 0, pwt: 0 } })
    let tSales = 0, tVC = 0, tPWT = 0, tCut = 0, tOldDue = 0

    bills.forEach(b => {
      ;(b.rows || []).forEach(r => {
        const co    = r.company
        if (!coMap[co]) return
        const sold  = num(r.sold), rate = num(r.rate)
        const vc    = num(r.vc)
        const pwt   = b.type === 'stocker' ? num(r.pwt) : 0
        const total = sold * rate
        coMap[co].sold += sold
        coMap[co].amt  += total
        coMap[co].vc   += vc
        coMap[co].pwt  += pwt
        tSales += total
        tVC    += vc
        tPWT   += pwt
      })
      tCut    += num(b.cut)
      tOldDue += num(b.oldDue)
    })

    const profit = tSales - tVC - tPWT - tCut
    return { coMap, tSales, tVC, tPWT, tCut, tOldDue, profit }
  }, [bills])

  const sellerCt  = bills.filter(b => b.type === 'seller').length
  const stockerCt = bills.filter(b => b.type === 'stocker').length

  // ── Print PDF ─────────────────────────────────────────────────────────────
  const doPrint = () => {
    const coRows = COMPANIES.map(co => {
      const v = stats.coMap[co]
      const net = v.amt - v.vc - v.pwt
      return `<tr>
        <td><b>${co}</b></td>
        <td align="center">${v.sold}</td>
        <td>₹${v.amt.toFixed(2)}</td>
        <td style="color:#6a1b9a">₹${v.vc.toFixed(2)}</td>
        <td style="color:#c62828">₹${v.pwt.toFixed(2)}</td>
        <td style="color:#2e7d32;font-weight:700">₹${net.toFixed(2)}</td>
      </tr>`
    }).join('')

    const billRows = bills.map(b =>
      `<tr>
        <td><b>${b.customerName || '—'}</b><br><small>${b.phone || ''}</small></td>
        <td><span style="background:${b.type==='seller'?'#1565c0':'#00695c'};color:#fff;padding:2px 7px;border-radius:10px;font-size:11px">${b.type}</span></td>
        <td>₹${num(b.subtotal).toFixed(2)}</td>
        <td>${num(b.oldDue) > 0 ? `+₹${num(b.oldDue).toFixed(2)}` : '—'}</td>
        <td>${num(b.cut) > 0 ? `+₹${num(b.cut).toFixed(2)}` : '—'}</td>
        <td style="font-weight:700;color:${b.finalBill > 0 ? '#c62828' : '#2e7d32'}">₹${num(b.finalBill).toFixed(2)}</td>
      </tr>`
    ).join('')

    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Daily Report ${date}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:13px}
      h2{color:#1a237e;margin-bottom:4px}h3{color:#37474f;margin:18px 0 8px}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th{background:#1a237e;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
      td{padding:7px 10px;border:1px solid #ddd;vertical-align:top}
      tr:nth-child(even){background:#f5f7ff}
      .profit{background:#1a237e;color:#fff;padding:14px 18px;border-radius:8px;
              display:flex;justify-content:space-between;margin-top:10px;font-size:1.15em;font-weight:700}
      .scard{border:2px solid #1a237e;border-radius:8px;padding:14px 18px;max-width:360px;margin:12px 0}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #eee;font-size:13px}
      .foot{margin-top:24px;text-align:center;color:#bbb;font-size:11px}
      @media print{body{padding:16px}}
    </style></head><body>
    <h2>🎲 Daily Business Report — ${date}</h2>
    <p style="color:#666">Generated: ${today()} | Bills: ${bills.length} (Sellers: ${sellerCt}, Stockers: ${stockerCt})</p>
    <h3>🏢 Company Summary</h3>
    <table><thead><tr><th>Company</th><th>Sold</th><th>Amount</th><th>VC</th><th>PWT</th><th>Net</th></tr></thead>
    <tbody>${coRows}</tbody></table>
    <h3>📋 Customer Bills</h3>
    <table><thead><tr><th>Customer</th><th>Type</th><th>Subtotal</th><th>Old Due</th><th>Cut</th><th>Final Bill</th></tr></thead>
    <tbody>${billRows}</tbody></table>
    <h3>💰 Profit Summary</h3>
    <div class="scard">
      <div class="row"><span>Total Sales Amount</span><span>₹${stats.tSales.toFixed(2)}</span></div>
      <div class="row"><span>Total VC</span><span style="color:#6a1b9a">−₹${stats.tVC.toFixed(2)}</span></div>
      <div class="row"><span>Total PWT</span><span style="color:#6a1b9a">−₹${stats.tPWT.toFixed(2)}</span></div>
      <div class="row"><span>Total Cut</span><span style="color:#c62828">−₹${stats.tCut.toFixed(2)}</span></div>
      <div class="profit"><span>📈 Net Profit</span><span>₹${stats.profit.toFixed(2)}</span></div>
    </div>
    <div class="foot">Lottery Billing System • ${today()}</div>
    <script>window.onload=()=>window.print();<\/script></body></html>`)
    w.document.close()
  }

  // ── WhatsApp share ────────────────────────────────────────────────────────
  const doShareWA = () => {
    const lines = [
      `🎲 *Daily Report — ${date}*`,
      `📋 Bills: ${bills.length} (Sellers: ${sellerCt}, Stockers: ${stockerCt})`,
      '',
      ...COMPANIES.map(co => {
        const v = stats.coMap[co]
        return `*${co}*: Sold ${v.sold}  Amt ₹${v.amt.toFixed(2)}  VC ₹${v.vc.toFixed(2)}`
      }),
      '',
      `💰 Total Sales: ₹${stats.tSales.toFixed(2)}`,
      `🎁 Total VC: ₹${stats.tVC.toFixed(2)}`,
      `✂️ Total Cut: ₹${stats.tCut.toFixed(2)}`,
      `──────────────────`,
      `📈 *Net Profit: ₹${stats.profit.toFixed(2)}*`,
      '',
      `Generated: ${today()} • Lottery Billing`,
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  const Tile = ({ icon, label, val, bg, col }) => (
    <div style={{ flex:1, minWidth:110, background:bg, borderRadius:12,
                  padding:'13px 14px', textAlign:'center',
                  border:'1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:11, color:'#777', marginBottom:3 }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:15, color:col }}>{val}</div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  zIndex:9989, backdropFilter:'blur(3px)', padding:16 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in"
           style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:860,
                    maxHeight:'93vh', overflowY:'auto',
                    boxShadow:'0 24px 60px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1b5e20,#2e7d32)',
                      padding:'18px 22px', borderRadius:'20px 20px 0 0',
                      display:'flex', alignItems:'center',
                      justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1.1em' }}>
              📈 Daily Business Report
            </div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:2 }}>
              {bills.length} bills for {date}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                   style={{ padding:'7px 12px', borderRadius:8, border:'none',
                            fontSize:13, outline:'none', cursor:'pointer' }} />
            <button onClick={() => setRefresh(r => r + 1)}
                    style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8,
                             color:'#fff', padding:'7px 12px', cursor:'pointer',
                             fontSize:13, fontWeight:600 }}>
              🔄 Refresh
            </button>
            <button onClick={onClose}
                    style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8,
                             color:'#fff', fontSize:18, cursor:'pointer',
                             width:34, height:34, display:'flex',
                             alignItems:'center', justifyContent:'center', fontWeight:800 }}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding:'20px 22px' }}>
          {bills.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#bbb' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
              <div style={{ fontSize:16, fontWeight:600, color:'#888' }}>
                No bills found for {date}
              </div>
              <div style={{ fontSize:13, marginTop:6 }}>
                Change the date or save bills first using 💾 Save Bill.
              </div>
            </div>
          ) : (
            <>
              {/* Stat tiles */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
                <Tile icon="📋" label="Total Bills"  val={bills.length}          bg="#e8eaf6" col="#1a237e"/>
                <Tile icon="✅" label="Sellers"      val={sellerCt}              bg="#e3f2fd" col="#1565c0"/>
                <Tile icon="📦" label="Stockers"     val={stockerCt}             bg="#f3e5f5" col="#6a1b9a"/>
                <Tile icon="💰" label="Total Sales"  val={fmt(stats.tSales)}     bg="#e8f5e9" col="#1b5e20"/>
                <Tile icon="🎁" label="Total VC"     val={fmt(stats.tVC)}        bg="#f3e5f5" col="#6a1b9a"/>
                <Tile icon="✂️" label="Total Cut"   val={fmt(stats.tCut)}       bg="#fff3e0" col="#e65100"/>
              </div>

              {/* Profit banner */}
              <div style={{ background:'linear-gradient(135deg,#1b5e20,#2e7d32)',
                            borderRadius:14, padding:'20px 24px', marginBottom:20,
                            display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13, marginBottom:6 }}>
                    Profit Formula
                  </div>
                  <div style={{ color:'#fff', fontSize:13, lineHeight:1.9 }}>
                    Sales <b>₹{stats.tSales.toFixed(2)}</b>
                    &nbsp;−&nbsp;VC <b>₹{stats.tVC.toFixed(2)}</b>
                    &nbsp;−&nbsp;PWT <b>₹{stats.tPWT.toFixed(2)}</b>
                    &nbsp;−&nbsp;Cut <b>₹{stats.tCut.toFixed(2)}</b>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>📈 Net Profit</div>
                  <div style={{ color:'#fff', fontWeight:900, fontSize:30 }}>
                    {fmt(stats.profit)}
                  </div>
                </div>
              </div>

              {/* Company breakdown */}
              <div style={{ borderRadius:14, border:'1px solid #e8e8e8',
                            marginBottom:20, overflow:'hidden' }}>
                <div style={{ background:'#f8f9fb', padding:'12px 16px',
                              fontWeight:700, fontSize:14, color:'#37474f',
                              borderBottom:'1px solid #e8e8e8' }}>
                  🏢 Company-wise Breakdown
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f0f4ff' }}>
                        {['Company','Total Sold','Amount','VC','PWT','Net'].map(h => (
                          <th key={h} style={{ padding:'10px 12px', textAlign:'left',
                                               fontWeight:700, color:'#555',
                                               borderBottom:'2px solid #e5e5e5' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPANIES.map(co => {
                        const v   = stats.coMap[co]
                        const net = v.amt - v.vc - v.pwt
                        return (
                          <tr key={co} style={{ borderBottom:'1px solid #f2f2f2' }}>
                            <td style={{ padding:'10px 12px' }}>
                              <span style={{ background:CO_CLR[co], color:'#fff',
                                             borderRadius:20, padding:'3px 12px',
                                             fontSize:12, fontWeight:700 }}>
                                {co}
                              </span>
                            </td>
                            <td style={{ padding:'10px 12px', fontWeight:700 }}>{v.sold}</td>
                            <td style={{ padding:'10px 12px', color:'#1565c0', fontWeight:600 }}>
                              {fmt(v.amt)}
                            </td>
                            <td style={{ padding:'10px 12px', color:'#6a1b9a' }}>{fmt(v.vc)}</td>
                            <td style={{ padding:'10px 12px', color:'#c62828' }}>{fmt(v.pwt)}</td>
                            <td style={{ padding:'10px 12px', color:'#2e7d32', fontWeight:700 }}>
                              {fmt(net)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill list */}
              <div style={{ borderRadius:14, border:'1px solid #e8e8e8',
                            overflow:'hidden', marginBottom:20 }}>
                <div style={{ background:'#f8f9fb', padding:'12px 16px',
                              fontWeight:700, fontSize:14, color:'#37474f',
                              borderBottom:'1px solid #e8e8e8' }}>
                  📋 Bill Details ({bills.length})
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f0f4ff' }}>
                        {['Customer','Type','Subtotal','Old Due','Cut','Final Bill'].map(h => (
                          <th key={h} style={{ padding:'9px 12px', textAlign:'left',
                                               fontWeight:700, color:'#555',
                                               borderBottom:'2px solid #e5e5e5' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map(b => (
                        <tr key={b.billId} style={{ borderBottom:'1px solid #f2f2f2' }}>
                          <td style={{ padding:'9px 12px' }}>
                            <div style={{ fontWeight:700 }}>{b.customerName || '—'}</div>
                            <div style={{ fontSize:11, color:'#888' }}>{b.phone || '—'}</div>
                          </td>
                          <td style={{ padding:'9px 12px' }}>
                            <span style={{ background: b.type==='seller' ? '#1565c0':'#00695c',
                                           color:'#fff', borderRadius:20, padding:'2px 9px',
                                           fontSize:11, fontWeight:700 }}>
                              {b.type}
                            </span>
                          </td>
                          <td style={{ padding:'9px 12px', color:'#e65100', fontWeight:600 }}>
                            {fmt(b.subtotal)}
                          </td>
                          <td style={{ padding:'9px 12px', color:'#f57f17' }}>
                            {num(b.oldDue) > 0 ? `+${fmt(b.oldDue)}` : '—'}
                          </td>
                          <td style={{ padding:'9px 12px', color:'#bf360c' }}>
                            {num(b.cut) > 0 ? `+${fmt(b.cut)}` : '—'}
                          </td>
                          <td style={{ padding:'9px 12px', fontWeight:800, fontSize:14,
                                       color: b.finalBill > 0 ? '#b71c1c' : '#1b5e20' }}>
                            {fmt(b.finalBill)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button onClick={doPrint}
                        style={{ flex:1, minWidth:160,
                                 background:'linear-gradient(135deg,#1565c0,#1976d2)',
                                 color:'#fff', border:'none', borderRadius:10,
                                 padding:'13px 16px', cursor:'pointer',
                                 fontWeight:700, fontSize:14 }}>
                  🖨️ Export PDF
                </button>
                <button onClick={doShareWA}
                        style={{ flex:1, minWidth:160,
                                 background:'linear-gradient(135deg,#25d366,#1da851)',
                                 color:'#fff', border:'none', borderRadius:10,
                                 padding:'13px 16px', cursor:'pointer',
                                 fontWeight:700, fontSize:14 }}>
                  📲 Share on WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
