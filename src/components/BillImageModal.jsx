/**
 * BillImageModal — v8
 *
 * Bill image bottom section:
 *   🏷️ Running Bill = Subtotal         ← blue (today's sale)
 *   💳 Total Bill   = Subtotal+OD+Cut  ← red  (final amount with adjustments)
 *
 * WhatsApp send: image ONLY — no pre-filled text
 */
import { useRef, useState, useEffect } from 'react'
import { fmt, num, today, CO_CLR, calcSeller, calcStocker } from '../utils.js'

export default function BillImageModal({ type, c, onClose }) {
  const cardRef = useRef(null)
  const [busy,    setBusy]    = useState(false)
  const [imgUrl,  setImgUrl]  = useState(null)
  const [imgBlob, setImgBlob] = useState(null)
  const [status,  setStatus]  = useState('')

  const isS  = type === 'seller'
  const calc = isS ? calcSeller(c) : calcStocker(c)
  const { rowCalc, tSold, tAmt, tVC, subtotal, od, ct, finalBill } = calc
  const tPWT = calc.tPWT || 0

  // Running Bill = Subtotal (today's sale only)
  const runningBill = subtotal
  // Total Bill = Subtotal + Old Due + Cut
  const totalBill   = finalBill

  useEffect(() => { doCapture() }, []) // eslint-disable-line

  const doCapture = async () => {
    if (!cardRef.current) return
    setBusy(true); setImgUrl(null); setImgBlob(null); setStatus('Generating…')
    try {
      const h2c = (await import('html2canvas')).default
      const canvas = await h2c(cardRef.current, {
        scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false,
      })
      setImgUrl(canvas.toDataURL('image/png'))
      canvas.toBlob(blob => setImgBlob(blob), 'image/png')
      setStatus('')
    } catch { setStatus('❌ Capture failed') }
    setBusy(false)
  }

  const handleSendWA = async () => {
    const phone = c.phone?.length === 10 ? `91${c.phone}` : ''
    // Strategy 1: Web Share API — image only, no text
    if (imgBlob && navigator.canShare) {
      const file = new File([imgBlob], `bill-${(c.name||'customer').replace(/\s+/g,'-')}.png`, { type:'image/png' })
      if (navigator.canShare({ files:[file] })) {
        try { await navigator.share({ files:[file] }); setStatus('✅ Shared!'); return }
        catch (e) { if (e.name === 'AbortError') return }
      }
    }
    // Strategy 2: Clipboard → open WA with no text
    if (imgBlob && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': imgBlob })])
        setStatus('✅ Image copied! Paste it in WhatsApp.')
        setTimeout(() => window.open(phone ? `https://wa.me/${phone}` : 'https://wa.me/', '_blank'), 400)
        return
      } catch {}
    }
    // Strategy 3: Download → open WA
    if (imgUrl) {
      const a = document.createElement('a')
      a.href = imgUrl; a.download = `bill-${(c.name||'customer').replace(/\s+/g,'-')}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setStatus('✅ Image saved! Attach it in WhatsApp.')
      setTimeout(() => window.open(phone ? `https://wa.me/${phone}` : 'https://wa.me/', '_blank'), 700)
    }
  }

  const handleDownload = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.href = imgUrl; a.download = `bill-${(c.name||'customer').replace(/\s+/g,'-')}-${today()}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const SumRow = ({ label, val, color, bold, bg }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, background:bg||'transparent' }}>
      <span style={{ color:'#555' }}>{label}</span>
      <span style={{ fontWeight:bold?800:600, color:color||'#222' }}>{val}</span>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9990, backdropFilter:'blur(4px)', padding:16 }}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 28px 70px rgba(0,0,0,0.4)' }}>

        {/* Modal header */}
        <div style={{ background:'linear-gradient(135deg,#25d366,#1da851)', padding:'16px 20px', borderRadius:'20px 20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>📸 WhatsApp Bill Image</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.25)', border:'none', borderRadius:8, color:'#fff', fontSize:20, cursor:'pointer', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:18 }}>

          {/* ── Bill card (captured by html2canvas) ── */}
          <div ref={cardRef} style={{ background:'#fff', borderRadius:14, padding:18, border:'2px solid #e0e0e0', fontFamily:'Arial,sans-serif' }}>

            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#1a237e,#3949ab)', color:'#fff', borderRadius:10, padding:'14px 18px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:900, fontSize:18 }}>🎲 Lottery Billing</div>
                <div style={{ fontSize:11, opacity:.8, marginTop:2 }}>{isS ? 'Seller Bill' : 'Stocker Settlement'}</div>
              </div>
              <div style={{ textAlign:'right', fontSize:12 }}>
                <div style={{ fontWeight:800, fontSize:16 }}>{c.name||'Customer'}</div>
                {c.phone && <div style={{ opacity:.8, marginTop:3 }}>📞 {c.phone}</div>}
                <div style={{ opacity:.8, marginTop:3 }}>📅 {today()}</div>
              </div>
            </div>

            {/* Company rows */}
            {rowCalc.map(r => (
              <div key={r.company} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, marginBottom:6, background:'#f8f9ff', border:'1px solid #e8eaf6' }}>
                <span style={{ display:'inline-block', padding:'3px 12px', borderRadius:20, color:'#fff', fontSize:12, fontWeight:700, background:CO_CLR[r.company]||'#555', minWidth:64, textAlign:'center' }}>
                  {r.company}
                </span>
                <div style={{ flex:1, display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'#555' }}>
                  <span>Sold: <b style={{ color:'#111' }}>{num(r.sold)||0}</b></span>
                  <span>Rate: <b>₹{num(r.rate)}</b></span>
                  <span>Total: <b style={{ color:'#1565c0' }}>₹{r.total.toFixed(2)}</b></span>
                  {!isS && <span>PWT: <b>{num(r.pwt)||0}</b></span>}
                  <span>VC: <b style={{ color:'#6a1b9a' }}>₹{num(r.vc).toFixed(2)}</b></span>
                </div>
                <span style={{ fontWeight:800, fontSize:14, color:r.bill>0?'#c62828':'#2e7d32', minWidth:80, textAlign:'right' }}>
                  ₹{r.bill.toFixed(2)}
                </span>
              </div>
            ))}

            {/* Summary box */}
            <div style={{ background:'#f8f9fb', borderRadius:10, padding:'12px 14px', marginTop:10, border:'1px solid #e8e8e8' }}>
              <SumRow label="Total Sold"   val={tSold} />
              <SumRow label="Total Amount" val={`₹${tAmt.toFixed(2)}`}  color="#1565c0" />
              {!isS && <SumRow label="Total PWT" val={`₹${tPWT.toFixed(2)}`} color="#6a1b9a" />}
              <SumRow label="Total VC"    val={`₹${tVC.toFixed(2)}`}  color="#6a1b9a" />
            </div>

            {/* ══════════════════════════════════════════════════
                BILL SUMMARY — clear separation
            ══════════════════════════════════════════════════ */}
            <div style={{ marginTop:12, borderRadius:12, overflow:'hidden', border:'2px solid #e0e0e0' }}>

              {/* Running Bill row (blue) = Subtotal */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'linear-gradient(135deg,#e3f2fd,#f0f8ff)', borderBottom:'2px solid #1565c0' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:13, color:'#1565c0' }}>🏷️ Running Bill</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Today's subtotal (before adjustments)</div>
                </div>
                <div style={{ fontWeight:900, fontSize:22, color:'#1565c0' }}>₹{runningBill.toFixed(2)}</div>
              </div>

              {/* Old Due row */}
              {od > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 16px', background:'#fff8e1', borderBottom:'1px solid #ffe082' }}>
                  <span style={{ fontWeight:600, fontSize:13, color:'#f57f17' }}>📌 Old Due</span>
                  <span style={{ fontWeight:700, fontSize:14, color:'#e65100' }}>+ ₹{od.toFixed(2)}</span>
                </div>
              )}

              {/* Cut row */}
              {ct > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 16px', background:'#fff3e0', borderBottom:'1px solid #ffcc80' }}>
                  <span style={{ fontWeight:600, fontSize:13, color:'#e65100' }}>✂️ Cut</span>
                  <span style={{ fontWeight:700, fontSize:14, color:'#bf360c' }}>+ ₹{ct.toFixed(2)}</span>
                </div>
              )}

              {/* Total Bill (red) = Running Bill + OD + Cut */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', background:'linear-gradient(135deg,#b71c1c,#c62828)' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:'#fff' }}>💳 Total Bill</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:2 }}>
                    Subtotal{od>0?` + Old Due`:''}{ct>0?` + Cut`:''}
                  </div>
                </div>
                <div style={{ fontWeight:900, fontSize:26, color:'#fff', letterSpacing:'-0.5px' }}>₹{totalBill.toFixed(2)}</div>
              </div>

            </div>

            <div style={{ textAlign:'center', marginTop:10, fontSize:10, color:'#bbb' }}>
              Generated: {today()} • Lottery Billing System
            </div>
          </div>

          {/* Status */}
          {status && (
            <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:status.startsWith('✅')?'#e8f5e9':status.startsWith('❌')?'#ffebee':'#fff8e1', color:status.startsWith('✅')?'#2e7d32':status.startsWith('❌')?'#c62828':'#e65100', fontWeight:600, fontSize:13 }}>
              {status}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
            {busy ? (
              <div style={{ flex:1, textAlign:'center', padding:'14px', color:'#1a237e', fontWeight:700, background:'#f0f4ff', borderRadius:10 }}>⏳ Generating image…</div>
            ) : imgUrl ? (
              <>
                <button onClick={handleSendWA}
                  style={{ flex:1, background:'linear-gradient(135deg,#25d366,#1da851)', color:'#fff', border:'none', borderRadius:10, padding:'13px', cursor:'pointer', fontWeight:800, fontSize:15, boxShadow:'0 3px 12px rgba(37,211,102,0.4)' }}>
                  📲 Send on WhatsApp
                </button>
                <button onClick={handleDownload}
                  style={{ background:'#e8eaf6', border:'none', borderRadius:10, padding:'13px 16px', cursor:'pointer', fontWeight:700, fontSize:13, color:'#1a237e' }}>
                  ⬇️ Save
                </button>
                <button onClick={doCapture}
                  style={{ background:'#f5f5f5', border:'1px solid #ddd', borderRadius:10, padding:'13px', cursor:'pointer', fontSize:13 }}>🔄</button>
              </>
            ) : (
              <button onClick={doCapture}
                style={{ flex:1, background:'#1a237e', color:'#fff', border:'none', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:700, fontSize:14 }}>
                📸 Generate Image
              </button>
            )}
          </div>

          {imgUrl && (
            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'#f8f9ff', border:'1px solid #e8eaf6', fontSize:12, color:'#666' }}>
              📱 <b>Mobile:</b> Tap "Send" — shares image directly, no text.<br/>
              💻 <b>Desktop:</b> Image copied — paste in WhatsApp (Ctrl+V).
            </div>
          )}

          {/* Preview */}
          {imgUrl && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>Preview:</div>
              <img src={imgUrl} alt="bill" style={{ width:'100%', borderRadius:10, border:'1px solid #e0e0e0', boxShadow:'0 2px 12px rgba(0,0,0,0.1)' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
