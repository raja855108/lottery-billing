import { useState } from 'react'
import { fmt, waURL, calcSeller, calcStocker, buildWAMsg } from '../utils.js'
import * as DB from '../DB.js'

export default function WABlastModal({ customers, type, onClose, showToast }) {
  const [detailed, setDetailed] = useState(true)
  const [sent,     setSent]     = useState({})
  const calcFn = type === 'seller' ? calcSeller : calcStocker
  const withPhone = customers.filter(c => c.phone)

  const getRunningDue = (c) => {
    const { finalBill } = calcFn(c)
    return DB.getLiveRunningDue(c.id, finalBill)
  }

  const sendOne = (c) => {
    if (!c.phone) { showToast('⚠️ No phone: '+(c.name||'customer'), '#e65100'); return }
    const { finalBill } = calcFn(c)
    const rb = getRunningDue(c)
    window.open(waURL(c.phone, buildWAMsg(type, c, detailed, rb)), '_blank')
    setSent(p => ({ ...p, [c.id]: true }))
  }

  const sendAll = () => {
    withPhone.forEach((c, i) => setTimeout(() => {
      const { finalBill } = calcFn(c)
      const rb = getRunningDue(c)
      window.open(waURL(c.phone, buildWAMsg(type, c, detailed, rb)), '_blank')
      setSent(p => ({ ...p, [c.id]: true }))
    }, i * 800))
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9990,backdropFilter:'blur(3px)' }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div className="fade-in" style={{ background:'#fff',borderRadius:20,width:'92%',maxWidth:520,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 60px rgba(0,0,0,0.35)',overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#25d366,#1da851)',padding:'18px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'#fff',fontWeight:800,fontSize:'1.1em' }}>📲 WhatsApp Blast</div>
            <div style={{ color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:2 }}>{type==='seller'?'Sellers':'Stockers'} — {customers.length} customers • includes Running Bill</div>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <label style={{ display:'flex',alignItems:'center',gap:5,color:'#fff',fontSize:12,cursor:'pointer',background:'rgba(255,255,255,0.2)',borderRadius:8,padding:'5px 10px' }}>
              <input type="checkbox" checked={detailed} onChange={e=>setDetailed(e.target.checked)}/> Detailed
            </label>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.25)',border:'none',borderRadius:8,color:'#fff',fontWeight:800,fontSize:18,cursor:'pointer',width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
          </div>
        </div>
        <div style={{ padding:'12px 16px',borderBottom:'1px solid #f0f0f0',background:'#f9fffe' }}>
          <button onClick={sendAll} style={{ width:'100%',background:'linear-gradient(135deg,#25d366,#1da851)',color:'#fff',border:'none',borderRadius:11,padding:'12px',cursor:'pointer',fontWeight:800,fontSize:15,boxShadow:'0 3px 12px rgba(37,211,102,0.4)' }}>
            🚀 Send to ALL {withPhone.length} Customers (with Running Bill)
          </button>
          {customers.some(c=>!c.phone) && <div style={{ fontSize:11,color:'#e65100',marginTop:6,textAlign:'center' }}>⚠️ {customers.filter(c=>!c.phone).length} customer(s) have no phone — skipped</div>}
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {customers.map(c => {
            const { finalBill } = calcFn(c)
            const rb = getRunningDue(c)
            const isSent = !!sent[c.id], hasPhone = !!c.phone
            return (
              <div key={c.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 16px',borderBottom:'1px solid #f5f5f5',background:isSent?'#f1fff5':'#fff',transition:'background .3s' }}>
                <div style={{ width:38,height:38,borderRadius:'50%',background:isSent?'#25d366':'#e0e0e0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,color:isSent?'#fff':'#666',fontWeight:700 }}>
                  {isSent?'✓':(c.name?c.name[0].toUpperCase():'?')}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.name||<span style={{ color:'#bbb',fontStyle:'italic' }}>No name</span>}</div>
                  <div style={{ fontSize:12,color:'#888' }}>{c.phone||<span style={{ color:'#e65100' }}>⚠️ No phone</span>}</div>
                </div>
                <div style={{ textAlign:'right',marginRight:4 }}>
                  <div style={{ fontSize:10,color:'#aaa' }}>Bill</div>
                  <div style={{ fontWeight:700,fontSize:13,color:finalBill>0?'#c62828':'#2e7d32' }}>{fmt(finalBill)}</div>
                </div>
                <div style={{ textAlign:'right',marginRight:8,background:rb>0?'#ffebee':'#e8f5e9',borderRadius:6,padding:'2px 8px' }}>
                  <div style={{ fontSize:10,color:'#aaa' }}>Running</div>
                  <div style={{ fontWeight:800,fontSize:13,color:rb>0?'#b71c1c':'#1b5e20' }}>{fmt(rb)}</div>
                </div>
                <button onClick={()=>sendOne(c)} disabled={!hasPhone}
                  style={{ background:isSent?'#e8f5e9':hasPhone?'linear-gradient(135deg,#25d366,#1da851)':'#e0e0e0',color:isSent?'#2e7d32':hasPhone?'#fff':'#aaa',border:`1px solid ${isSent?'#a5d6a7':hasPhone?'transparent':'#ccc'}`,borderRadius:9,padding:'7px 13px',cursor:hasPhone?'pointer':'not-allowed',fontWeight:700,fontSize:13,whiteSpace:'nowrap',flexShrink:0 }}>
                  {isSent?'✅ Sent':'📲 Send'}
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'10px 16px',borderTop:'1px solid #f0f0f0',background:'#fafafa',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontSize:12,color:'#aaa' }}>✅ Sent: {Object.values(sent).filter(Boolean).length} / {customers.length}</span>
          <button onClick={onClose} style={{ background:'#f5f5f5',border:'1px solid #ddd',borderRadius:8,padding:'7px 18px',cursor:'pointer',fontWeight:600,fontSize:13 }}>Close</button>
        </div>
      </div>
    </div>
  )
}
