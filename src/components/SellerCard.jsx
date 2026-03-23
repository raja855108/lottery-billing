import { useState, useRef } from 'react'
import RunningBill      from './RunningBill.jsx'
import BillImageModal   from './BillImageModal.jsx'
import PDFUploadModal   from './PDFUploadModal.jsx'
import { fmt, num, CO_CLR, calcSeller, buildWAMsg, printSingleBill, waURL } from '../utils.js'
import * as DB from '../DB.js'

// Feature 2: wider inputs, full-width layout
const TH  = { padding:'10px 12px',fontSize:13,fontWeight:700,textAlign:'left',color:'#555',borderBottom:'2px solid #e5e5e5',whiteSpace:'nowrap',background:'#f8f9fb' }
const TD  = { padding:'8px 10px',borderBottom:'1px solid #f2f2f2',fontSize:13 }
const NI  = (x={}) => ({ width:90,padding:'6px 9px',border:'1.5px solid #e0e0e0',borderRadius:8,fontSize:14,fontFamily:'inherit',outline:'none',...x })
const SI  = { display:'flex',flexDirection:'column',alignItems:'center',fontSize:12,gap:3 }
const LCK = on => ({ border:'none',borderRadius:8,padding:'6px 13px',cursor:'pointer',fontWeight:700,fontSize:12,whiteSpace:'nowrap',background:on?'#ffcdd2':'#c8e6c9',color:on?'#b71c1c':'#1b5e20' })
const INS = l => ({ padding:'8px 13px',borderRadius:9,border:'1.5px solid #d0d0d0',fontSize:14,fontFamily:'inherit',outline:'none',background:l?'#f5f5f5':'#fff',color:l?'#888':'#111' })

export default function SellerCard({ c, rLock, onChange, onDel, onSaveBill }) {
  const [showBill, setShowBill] = useState(true)
  const [detailed, setDetailed] = useState(true)
  const [imgModal, setImgModal] = useState(false)
  const [pdfModal, setPdfModal] = useState(false)
  const saving = useRef(false)

  const nl   = !!c._nl
  const upd  = (f, v) => onChange({ ...c, [f]: v })
  const updR = (i, f, v) => {
    const rows = c.rows.map((r, idx) => idx === i ? { ...r, [f]: v } : r)
    onChange({ ...c, rows })
  }

  const { rowCalc, tSold, tAmt, tVC, subtotal, od, ct, finalBill, runningBill, totalBill } = calcSeller(c)

  // Feature 5: apply PDF-extracted data
  const applyPDF = (data) => {
    const rows = c.rows.map((r, i) => {
      const sold = i === 0 ? data.mlSold : i === 1 ? data.nbSold : data.bkSold
      return {
        ...r,
        sold: sold || r.sold,
        rate: data.rate || r.rate,
        vc:   data.vc   || r.vc,
      }
    })
    onChange({
      ...c,
      name:  data.name  || c.name,
      phone: data.phone || c.phone,
      rows,
    })
  }

  const handleWA = () => {
    if (!c.phone || c.phone.length < 10) { alert('Enter 10-digit phone first.'); return }
    const rb = DB.getLiveRunningDue(c.id, finalBill); window.open(waURL(c.phone, buildWAMsg('seller', c, detailed, rb)), '_blank')
  }

  const handleSave = () => {
    if (saving.current) return
    saving.current = true
    onSaveBill(c, 'seller')
    setTimeout(() => { saving.current = false }, 1500)
  }

  return (
    <div className="fade-in" style={{ background:'#fff',borderRadius:16,boxShadow:'0 2px 20px rgba(0,0,0,0.07)',padding:'20px 20px',marginBottom:22,border:'1px solid #e8e8e8' }}>
      {imgModal && <BillImageModal type="seller" c={c} onClose={() => setImgModal(false)}/>}
      {pdfModal && <PDFUploadModal onFill={applyPDF} onClose={() => setPdfModal(false)}/>}

      {/* header */}
      <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:14,flexWrap:'wrap' }}>
        <div style={{ display:'flex',gap:8,flex:1,flexWrap:'wrap',alignItems:'center' }}>
          <input style={{...INS(nl),flex:1,minWidth:150}} placeholder="👤 Customer Name" value={c.name} readOnly={nl} onChange={e=>upd('name',e.target.value)}/>
          <input style={{...INS(nl),width:160}} placeholder="📞 Phone (10 digits)" value={c.phone} maxLength={10} readOnly={nl} onChange={e=>upd('phone',e.target.value.replace(/\D/g,''))}/>
          <button style={LCK(nl)} onClick={()=>upd('_nl',!nl)}>{nl?'🔒':'🔓'} {nl?'Locked':'Unlocked'}</button>
          <button onClick={()=>setPdfModal(true)} style={{ background:'linear-gradient(135deg,#f57f17,#ff8f00)',color:'#fff',border:'none',borderRadius:8,padding:'6px 13px',cursor:'pointer',fontWeight:700,fontSize:12,whiteSpace:'nowrap' }}>📄 Upload PDF</button>
        </div>
        <button onClick={onDel} style={{ background:'#ffebee',color:'#c62828',border:'none',borderRadius:9,padding:'7px 13px',cursor:'pointer',fontWeight:700,fontSize:15 }}>✕</button>
      </div>

      {/* Feature 2: full-width table with wider inputs */}
      <div style={{ overflowX:'auto',borderRadius:10,border:'1px solid #f0f0f0' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',minWidth:500 }}>
          <thead>
            <tr>{['Company','Sold','Rate','Total','VC','Bill'].map(h=>(
              <th key={h} style={TH}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rowCalc.map((r, i) => (
              <tr key={r.company} onMouseOver={e=>e.currentTarget.style.background='#fafbff'} onMouseOut={e=>e.currentTarget.style.background=''}>
                <td style={{...TD,minWidth:90}}>
                  <span style={{ display:'inline-block',padding:'4px 14px',borderRadius:20,color:'#fff',fontSize:13,fontWeight:700,background:CO_CLR[r.company] }}>{r.company}</span>
                </td>
                <td style={{...TD,minWidth:100}}><input style={NI({width:'100%'})} type="number" min="0" placeholder="0" value={r.sold} onChange={e=>updR(i,'sold',e.target.value)}/></td>
                <td style={{...TD,minWidth:100}}><input style={NI({width:'100%',background:rLock?'#f5f5f5':'#fff',color:rLock?'#888':'#111'})} type="number" min="0" value={r.rate} readOnly={rLock} onChange={e=>updR(i,'rate',e.target.value)}/></td>
                <td style={{...TD,color:'#1565c0',fontWeight:700,minWidth:100,fontSize:14}}>{fmt(r.total)}</td>
                <td style={{...TD,minWidth:100}}><input style={NI({width:'100%'})} type="number" min="0" placeholder="0" value={r.vc} onChange={e=>updR(i,'vc',e.target.value)}/></td>
                <td style={{...TD,fontWeight:700,color:r.bill>0?'#c62828':'#2e7d32',minWidth:100,fontSize:14}}>{fmt(r.bill)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* summary bar */}
      <div style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',background:'linear-gradient(135deg,#f8f9ff,#f0f4ff)',borderRadius:12,padding:'12px 16px',marginTop:14,border:'1px solid #e8eaf6' }}>
        <div style={SI}><span style={{ color:'#777',fontSize:11 }}>Sold</span><strong>{tSold}</strong></div>
        <div style={SI}><span style={{ color:'#777',fontSize:11 }}>Amount</span><strong>{fmt(tAmt)}</strong></div>
        <div style={SI}><span style={{ color:'#777',fontSize:11 }}>VC</span><strong>{fmt(tVC)}</strong></div>
        <div style={{...SI,background:'#f5f5f5',borderRadius:8,padding:'5px 10px',border:'1px solid #e0e0e0'}}>
          <span style={{ color:'#555',fontSize:10,fontWeight:600 }}>📊 SUBTOTAL</span>
          <strong style={{ color:'#e65100',fontSize:'1.05em' }}>{fmt(subtotal)}</strong>
        </div>
        <div style={SI}><span style={{ color:'#555',fontSize:11,fontWeight:600 }}>📌 Old Due</span>
          <input style={NI({width:90})} type="number" min="0" placeholder="0" value={c.oldDue} onChange={e=>upd('oldDue',e.target.value)}/>
        </div>
        <div style={SI}><span style={{ color:'#e65100',fontSize:11,fontWeight:700 }}>✂️ Cut</span>
          <input style={NI({width:90,borderColor:'#ffb74d'})} type="number" min="0" placeholder="0" value={c.cut} onChange={e=>upd('cut',e.target.value)}/>
        </div>
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <div style={{...SI,background:'#e3f2fd',borderRadius:10,padding:'8px 14px',border:'1px solid #90caf9'}}>
            <span style={{ color:'#1565c0',fontSize:10,fontWeight:700 }}>🏷️ Running Bill</span>
            <strong style={{ color:'#1565c0',fontSize:'1.15em' }}>{fmt(runningBill)}</strong>
            <span style={{ color:'#888',fontSize:9 }}>Before deductions</span>
          </div>
          <div style={{...SI,background:totalBill!==0?'#ffebee':'#e8f5e9',borderRadius:10,padding:'8px 14px',border:`1px solid ${totalBill!==0?'#ffcdd2':'#c8e6c9'}`}}>
            <span style={{ color:totalBill!==0?'#c62828':'#388e3c',fontSize:10,fontWeight:700 }}>💳 Total Bill</span>
            <strong style={{ color:totalBill!==0?'#b71c1c':'#1b5e20',fontSize:'1.15em' }}>{fmt(totalBill)}</strong>
            <span style={{ color:'#888',fontSize:9 }}>After VC & Old Due</span>
          </div>
        </div>
      </div>

      {/* running bill toggle */}
      <div style={{ marginTop:14 }}>
        <button onClick={()=>setShowBill(v=>!v)} style={{ width:'100%',background:'none',border:'1.5px solid #e0e0e0',borderRadius:10,padding:'9px 16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:13,color:'#555',fontWeight:600 }}
          onMouseOver={e=>e.currentTarget.style.background='#f8f8f8'} onMouseOut={e=>e.currentTarget.style.background='none'}>
          <span>🧾 Running Bill {showBill?'▲':'▼'}</span>
          <span style={{ display:'flex', gap:12 }}>
            <span style={{ color:'#1565c0', fontWeight:700, fontSize:13 }}>RB: {fmt(runningBill)}</span>
            <span style={{ color:totalBill!==0?'#c62828':'#2e7d32', fontWeight:800, fontSize:15 }}>TB: {fmt(totalBill)}</span>
          </span>
        </button>
        {showBill && <RunningBill type="seller" c={c}/>}
      </div>

      {/* actions */}
      <div style={{ display:'flex',gap:8,alignItems:'center',marginTop:14,flexWrap:'wrap' }}>
        <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',color:'#555' }}>
          <input type="checkbox" checked={detailed} onChange={e=>setDetailed(e.target.checked)}/> Detailed
        </label>
        <button onClick={handleWA} title={c.phone?.length===10?'Send bill via WhatsApp text':'Enter phone first'}
          style={{ background:c.phone?.length===10?'linear-gradient(135deg,#25d366,#1da851)':'#bdbdbd',color:'#fff',border:'none',borderRadius:9,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:13 }}>
          📲 WA Text
        </button>
        {/* Feature 3: WA Image button */}
        <button onClick={()=>setImgModal(true)} title="Generate bill image for WhatsApp"
          style={{ background:'linear-gradient(135deg,#00897b,#00acc1)',color:'#fff',border:'none',borderRadius:9,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:13 }}>
          🖼️ WA Image
        </button>
        <button onClick={()=>{ const rb = DB.getLiveRunningDue(c.id, finalBill); printSingleBill('seller',c,rb) }}
          style={{ background:'linear-gradient(135deg,#1565c0,#1976d2)',color:'#fff',border:'none',borderRadius:9,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:13 }}>
          📄 PDF
        </button>
        <SaveBtn onSave={handleSave}/>
      </div>
    </div>
  )
}

function SaveBtn({ onSave }) {
  const [busy, setBusy] = useState(false)
  const handle = () => {
    if (busy) return
    setBusy(true)
    onSave()
    setTimeout(() => setBusy(false), 1500)
  }
  return (
    <button onClick={handle} disabled={busy}
      style={{ background:busy?'#a5d6a7':'linear-gradient(135deg,#00695c,#00897b)',color:'#fff',border:'none',borderRadius:9,padding:'8px 15px',cursor:busy?'not-allowed':'pointer',fontWeight:700,fontSize:13,transition:'background .2s' }}>
      {busy ? '✅ Saved!' : '💾 Save Bill'}
    </button>
  )
}
