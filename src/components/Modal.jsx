export default function Modal({ msg, onOk, onNo }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,backdropFilter:'blur(2px)' }}>
      <div className="fade-in" style={{ background:'#fff',borderRadius:18,padding:'32px 28px 24px',maxWidth:380,width:'92%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',textAlign:'center' }}>
        <div style={{ fontSize:44,marginBottom:12 }}>⚠️</div>
        <p style={{ fontSize:15,color:'#333',marginBottom:28,lineHeight:1.7,whiteSpace:'pre-line' }}>{msg}</p>
        <div style={{ display:'flex',gap:12,justifyContent:'center' }}>
          <button onClick={onNo} style={{ padding:'10px 28px',borderRadius:10,border:'1.5px solid #ddd',background:'#f5f5f5',cursor:'pointer',fontWeight:600,fontSize:14 }}>Cancel</button>
          <button onClick={onOk} style={{ padding:'10px 28px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#c62828,#e53935)',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14 }}>✔ Confirm</button>
        </div>
      </div>
    </div>
  )
}
