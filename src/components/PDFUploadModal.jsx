/**
 * PDFUploadModal — Feature 5: Auto-fill from PDF
 * Loads PDF.js from CDN, extracts text from all pages,
 * pattern-matches fields, pre-fills card.
 */
import { useState, useRef } from 'react'

async function getPDFJS() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((res, rej) => {
    if (document.getElementById('pdfjs-script')) {
      // Already loading — wait
      const poll = setInterval(() => {
        if (window.pdfjsLib) { clearInterval(poll); res(window.pdfjsLib) }
      }, 100)
      return
    }
    const s  = document.createElement('script')
    s.id     = 'pdfjs-script'
    s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      res(window.pdfjsLib)
    }
    s.onerror = () => rej(new Error('Failed to load PDF.js'))
    document.head.appendChild(s)
  })
}

async function extractText(file) {
  const lib = await getPDFJS()
  const buf = await file.arrayBuffer()
  const doc = await lib.getDocument({ data: buf }).promise
  let out = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p)
    const ct = await pg.getTextContent()
    out += ct.items.map(i => i.str).join(' ') + '\n'
  }
  return out
}

const findNum = (text, ...pats) => {
  for (const p of pats) {
    const m = text.match(new RegExp(p + '[\\s:]*([\\d,]+\\.?\\d*)', 'i'))
    if (m) return String(parseFloat(m[1].replace(/,/g, '')) || '')
  }
  return ''
}
const findStr = (text, ...pats) => {
  for (const p of pats) {
    const m = text.match(new RegExp(p + '[\\s:]*([A-Za-z][A-Za-z .]{1,28})', 'i'))
    if (m) return m[1].trim().replace(/\s+/g, ' ')
  }
  return ''
}

export default function PDFUploadModal({ onFill, onClose }) {
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [data,    setData]    = useState(null)
  const [raw,     setRaw]     = useState('')

  const process = async (file) => {
    if (!file?.name?.endsWith('.pdf')) { setError('Please select a PDF file.'); return }
    setLoading(true); setError(''); setData(null); setRaw('')
    try {
      const text = await extractText(file)
      setRaw(text.slice(0, 500) + (text.length > 500 ? '…' : ''))

      const phone = (() => { const m = text.match(/\b(\d{10})\b/); return m ? m[1] : '' })()
      setData({
        name:    findStr(text, 'customer', 'name', 'party', 'bill to', 'client'),
        phone,
        mlSold:  findNum(text, 'ml[\\s-]*sold', 'ml[\\s-]*qty', 'ml'),
        nbSold:  findNum(text, 'nb[\\s-]*sold', 'nb[\\s-]*qty', 'nb'),
        bkSold:  findNum(text, 'booking[\\s-]*sold', 'booking[\\s-]*qty', 'booking'),
        mlRate:  findNum(text, 'ml[\\s-]*rate'),
        nbRate:  findNum(text, 'nb[\\s-]*rate'),
        bkRate:  findNum(text, 'booking[\\s-]*rate'),
        rate:    findNum(text, 'rate', 'price'),
        vc:      findNum(text, 'vc', 'volume[\\s-]*comm', 'vendor[\\s-]*comm', 'commission'),
        subtotal:findNum(text, 'subtotal', 'sub[\\s-]*total', 'net amount', 'net amt'),
      })
    } catch (e) {
      setError('Could not read PDF: ' + (e.message || 'unknown error'))
    }
    setLoading(false)
  }

  const Field = ({ label, k }) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
      <label style={{ fontSize:12, fontWeight:600, color:'#555', minWidth:100, flexShrink:0 }}>
        {label}
      </label>
      <input
        value={data?.[k] ?? ''}
        onChange={e => setData(p => ({ ...p, [k]: e.target.value }))}
        style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1.5px solid #ddd',
                 fontSize:13, fontFamily:'inherit', outline:'none' }}
        placeholder="—"
      />
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  zIndex:9991, backdropFilter:'blur(3px)', padding:16 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in"
           style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:540,
                    maxHeight:'90vh', overflowY:'auto',
                    boxShadow:'0 24px 60px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#e65100,#ff8f00)',
                      padding:'16px 20px', borderRadius:'20px 20px 0 0',
                      display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>📄 Auto-Fill from PDF</span>
          <button onClick={onClose}
                  style={{ background:'rgba(255,255,255,0.25)', border:'none', borderRadius:8,
                           color:'#fff', fontSize:20, cursor:'pointer', width:34, height:34,
                           display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {/* Drop zone */}
          <div onClick={() => fileRef.current?.click()}
               onDragOver={e => e.preventDefault()}
               onDrop={e => { e.preventDefault(); process(e.dataTransfer.files[0]) }}
               style={{ border:'2.5px dashed #ffb300', borderRadius:14, padding:'30px 20px',
                        textAlign:'center', cursor:'pointer', background:'#fffde7',
                        marginBottom:16, transition:'background .2s' }}
               onMouseOver={e => e.currentTarget.style.background='#fff8e1'}
               onMouseOut={e  => e.currentTarget.style.background='#fffde7'}>
            <div style={{ fontSize:38, marginBottom:8 }}>📄</div>
            <div style={{ fontWeight:700, color:'#e65100', fontSize:15 }}>
              Click or Drag & Drop your Bill PDF
            </div>
            <div style={{ fontSize:12, color:'#888', marginTop:4 }}>
              Fields will be extracted automatically
            </div>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }}
                   onChange={e => process(e.target.files[0])} />
          </div>

          {loading && (
            <div style={{ textAlign:'center', padding:'20px', color:'#e65100',
                          fontWeight:700, fontSize:15 }}>
              ⏳ Reading PDF…
            </div>
          )}

          {error && (
            <div style={{ background:'#ffebee', border:'1px solid #ffcdd2', borderRadius:8,
                          padding:'10px 14px', color:'#c62828', fontSize:13, marginBottom:14 }}>
              ⚠️ {error}
            </div>
          )}

          {data && (
            <>
              {raw && (
                <div style={{ background:'#f8f9ff', borderRadius:10, padding:12,
                              marginBottom:14, border:'1px solid #e8eaf6' }}>
                  <div style={{ fontWeight:700, color:'#1a237e', fontSize:12, marginBottom:4 }}>
                    Extracted text preview:
                  </div>
                  <div style={{ fontFamily:'monospace', fontSize:11, color:'#555',
                                lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                    {raw}
                  </div>
                </div>
              )}

              <div style={{ background:'#f0fdf4', borderRadius:12, padding:'16px',
                            border:'1px solid #bbf7d0', marginBottom:16 }}>
                <div style={{ fontWeight:700, color:'#15803d', marginBottom:12, fontSize:14 }}>
                  ✅ Auto-Extracted Fields — Review &amp; Edit Before Applying
                </div>
                <Field label="Customer Name" k="name"    />
                <Field label="Phone"         k="phone"   />
                <Field label="ML Sold"       k="mlSold"  />
                <Field label="NB Sold"       k="nbSold"  />
                <Field label="Booking Sold"  k="bkSold"  />
                <Field label="Rate (common)" k="rate"    />
                <Field label="ML Rate"       k="mlRate"  />
                <Field label="NB Rate"       k="nbRate"  />
                <Field label="Booking Rate"  k="bkRate"  />
                <Field label="VC"            k="vc"      />
                <Field label="Subtotal"      k="subtotal"/>
              </div>

              <div style={{ background:'#fffde7', borderRadius:8, padding:'10px 14px',
                            border:'1px solid #ffe082', fontSize:12,
                            color:'#795548', marginBottom:16 }}>
                💡 After applying, only enter <b>Old Due</b> and <b>Cut</b> manually.
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => { onFill(data); onClose() }}
                        style={{ flex:1, background:'linear-gradient(135deg,#2e7d32,#43a047)',
                                 color:'#fff', border:'none', borderRadius:10, padding:'13px',
                                 cursor:'pointer', fontWeight:700, fontSize:15 }}>
                  ✅ Apply to Card
                </button>
                <button onClick={onClose}
                        style={{ background:'#f5f5f5', border:'1px solid #ddd', borderRadius:10,
                                 padding:'13px 20px', cursor:'pointer',
                                 fontWeight:600, fontSize:14 }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
