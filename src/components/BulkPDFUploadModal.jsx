/**
 * BulkPDFUploadModal — v13
 *
 * THREE IMPORT MODES:
 *
 * 1. PDF Text Extraction (Format A — NB Agency billing PDF with "Customer:" labels)
 * 2. PDF Text Extraction (Format B — Our Report PDF downloaded via html2pdf Download button)
 * 3. Vector PDF fallback — When PDF.js extracts 0 lines (Microsoft Print-to-PDF / Chrome Print),
 *    the system detects this and asks the user to paste text OR offers pre-parsed data.
 *
 * CRITICAL: Microsoft Print-to-PDF and Chrome's "Print" dialog produce vector-only PDFs
 * where text is stored as glyph paths. PDF.js CANNOT extract any text from these.
 * Users must use the "📄 Download PDF" button in the Report section instead.
 */
import React, { useState, useRef } from 'react'
import { CO_CLR, CO_LIGHT, DEF_SR, DEF_TR, todayISO } from '../utils.js'

// ─── PDF.js loader ────────────────────────────────────────────────────────────
async function getPDFJS() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    if (document.getElementById('pdfjs-v13')) {
      const poll = setInterval(() => { if (window.pdfjsLib) { clearInterval(poll); resolve(window.pdfjsLib) } }, 80)
      return
    }
    const s = document.createElement('script')
    s.id = 'pdfjs-v13'
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = () => reject(new Error('PDF.js failed to load'))
    document.head.appendChild(s)
  })
}

// ─── Extract text lines from all pages ───────────────────────────────────────
async function extractLines(file, onProgress) {
  const lib    = await getPDFJS()
  const buffer = await file.arrayBuffer()
  const doc    = await lib.getDocument({ data: buffer }).promise
  const allLines = []

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(`Reading page ${p}/${doc.numPages}…`, Math.round((p / doc.numPages) * 40))
    const page    = await doc.getPage(p)
    const content = await page.getTextContent()

    const items = content.items
      .filter(i => i.str?.trim())
      .map(i => ({ text: i.str.trim(), x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }))
    items.sort((a, b) => b.y - a.y || a.x - b.x)

    let cur = [], lastY = null
    for (const it of items) {
      if (lastY === null || Math.abs(it.y - lastY) <= 5) { cur.push(it) }
      else { if (cur.length) allLines.push(cur.map(i => i.text).join(' ').replace(/\s+/g,' ').trim()); cur = [it] }
      lastY = it.y
    }
    if (cur.length) allLines.push(cur.map(i => i.text).join(' ').replace(/\s+/g,' ').trim())
  }
  return allLines.filter(Boolean)
}

// ─── Format detector ──────────────────────────────────────────────────────────
function detectFormat(lines) {
  const text = lines.join(' ')
  if (/Customer\s*:/i.test(text)) return 'A'
  if (/Lottery Billing Report|RUNNING BILL|↳\s*Total|Bill Details/i.test(text)) return 'B'
  if (/(seller|stocker)/i.test(text)) return 'B'
  return 'A'
}

// ════════════════════════════════════════════════════════════════════════════
// FORMAT A PARSER — NB Agency billing PDF
// ════════════════════════════════════════════════════════════════════════════
function parseFormatA(lines, DEF_RATE, type) {
  const text = lines.join('\n')
  const sections = text.split(/(?=Customer\s*:)/i).filter(s => /Customer\s*:/i.test(s))
  if (!sections.length) return []

  return sections.map((sec, idx) => {
    const nameM = sec.match(/Customer\s*:\s*(.+?)(?:\n|$)/i)
    if (!nameM) return null
    const name = nameM[1].replace(/\s+/g,' ').trim()
    if (!name) return null

    const ml   = parseCoRowA(sec, 'ML')
    const nb   = parseCoRowA(sec, 'NB')
    let book   = parseCoRowA(sec, 'Book')
    if (book.sold==='0') { const alt=parseCoRowA(sec,'Booking'); if(alt.total!=='0') book=alt }

    const N = '([\\d,]+\\.?\\d*)'
    const rb = pickFirst(sec, [`Summary\\s+Running\\s+BILL\\s*[:\\-]?\\s*${N}`,`Running\\s+BILL?\\s*[:\\-]?\\s*${N}`])
    const od = pickFirst(sec, [`Old\\s+Due\\s*[:\\-]?\\s*${N}`,`OLD\\s+DUE\\s*[:\\-]?\\s*${N}`])
    const ct = pickFirst(sec, [`\\bCUT\\s*[:\\-]?\\s*${N}`,`Cut\\s*[:\\-]?\\s*${N}`])

    return buildCard(name, type, DEF_RATE, idx, { ml, nb, book, running_bill:rb, old_due:od, cut:ct })
  }).filter(Boolean)
}

function pickFirst(text, patterns) {
  for (const pat of patterns) {
    const m = text.match(new RegExp(pat,'i'))
    if (m) for (let i=1;i<m.length;i++) if (m[i]!==undefined&&/[\d.]/.test(m[i])) return m[i].replace(/,/g,'')
  }
  return '0'
}

function parseCoRowA(sec, coName) {
  const esc=coName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const N='([\\d,]+\\.?\\d*)', SP='[\\s|,;\\t]+'
  for (const pat of [
    new RegExp(`^\\s*${esc}${SP}${N}${SP}${N}${SP}${N}${SP}${N}${SP}${N}`,'im'),
    new RegExp(`${esc}${SP}${N}${SP}${N}${SP}${N}${SP}${N}${SP}${N}`,'im'),
  ]) {
    const m=sec.match(pat)
    if (m) return { sold:m[1], rate:m[2], total:m[3], vc:m[4] }
  }
  for (const line of sec.split('\n')) {
    if (!new RegExp(`^\\s*${esc}\\b`,'i').test(line)) continue
    const nums=[...line.matchAll(/[\d,]+\.?\d*/g)].map(m=>m[0].replace(/,/g,''))
    if (nums.length>=4) return { sold:nums[0], rate:nums[1], total:nums[2], vc:nums[3] }
  }
  return { sold:'0', rate:'0', total:'0', vc:'0' }
}

// ════════════════════════════════════════════════════════════════════════════
// FORMAT B PARSER — Our Lottery Billing Report PDF (html2pdf generated)
// ════════════════════════════════════════════════════════════════════════════
function parseFormatB(lines, DEF_RATE, type) {
  const customers = []
  const isFooterLine = l => /Grand Total Summary|Lottery Billing System|Generated:/i.test(l)
  const isCustomerHeader = l => /\b(seller|stocker)\b/i.test(l) &&
    (/^\d+\s+[A-Z]/.test(l) || /^[A-Z][A-Z0-9 .'-]+\s+(seller|stocker)/i.test(l))
  const isCompanyRow = l => /^\s*(ML|NB|Booking)\s+/i.test(l)
  const isTotalRow   = l => /^↳\s*Total\b/i.test(l)
  const isTableHeader= l => /^Company\s+Sold\s+Rate/i.test(l)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isFooterLine(line)) { i++; continue }
    if (!isCustomerHeader(line)) { i++; continue }

    const typeMatch = line.match(/\b(seller|stocker)\b/i)
    const typeStr   = typeMatch ? typeMatch[1].toLowerCase() : type

    let name = ''
    const nm = line.match(/^\d+\s+([A-Z][A-Z0-9 .'-]+?)\s+(?:N\/A|📞|\d{10}|seller|stocker)/i) ||
               line.match(/^\d+\s+([A-Z][A-Z0-9 .'-]+?)\s+(seller|stocker)/i) ||
               line.match(/^([A-Z][A-Z0-9 .'-]+?)\s+(seller|stocker)/i)
    if (nm) name = nm[1].replace(/\s+/g,' ').trim()
    if (!name || name.length < 2) { i++; continue }

    const odMatch = line.match(/\+OD\s*[₹]?([\d,]+\.?\d*)/i)
    const old_due = odMatch ? odMatch[1].replace(/,/g,'') : '0'
    const rbMatch = line.match(/RUNNING\s+BILL\s*[₹]?([\d,]+\.?\d*)/i)
    const running_bill = rbMatch ? rbMatch[1].replace(/,/g,'') : '0'
    const tbMatch = line.match(/TOTAL\s+BILL\s*[₹]?([\d,]+\.?\d*)/i)
    const total_bill = tbMatch ? tbMatch[1].replace(/,/g,'') : '0'

    const ml   = { sold:'0', rate:String(DEF_RATE.ML),      vc:'0', total:'0' }
    const nb   = { sold:'0', rate:String(DEF_RATE.NB),      vc:'0', total:'0' }
    const book = { sold:'0', rate:String(DEF_RATE.Booking), vc:'0', total:'0' }
    let sub = '0'

    i++
    while (i < lines.length) {
      const l = lines[i]
      if (isFooterLine(l) || isCustomerHeader(l)) break
      if (isTableHeader(l)) { i++; continue }
      if (isCompanyRow(l)) {
        const parsed = parseCompanyRowB(l)
        if (parsed) {
          if (/^ML\b/i.test(l))      Object.assign(ml,   parsed)
          else if (/^NB\b/i.test(l)) Object.assign(nb,   parsed)
          else                        Object.assign(book, parsed)
        }
        i++; continue
      }
      if (isTotalRow(l)) {
        const subM = l.match(/Sub:\s*[₹]?([\d,]+\.?\d*)/i)
        if (subM) sub = subM[1].replace(/,/g,'')
        i++; continue
      }
      i++
    }

    const rb = running_bill !== '0' ? running_bill : sub
    customers.push(buildCard(name, type, DEF_RATE, customers.length,
      { ml, nb, book, running_bill:rb, old_due, cut:'0', total_bill }))
  }
  return customers
}

function parseCompanyRowB(line) {
  const withoutCo = line.replace(/^\s*(ML|NB|Booking)\s+/i, '').trim()
  if (!withoutCo) return null
  const tokens = withoutCo.split(/\s+/)
  const soldTok = tokens[0]
  const sold = (soldTok==='—'||soldTok==='-'||soldTok==='') ? '0' : soldTok.replace(/[₹,]/g,'')
  const vcMatch = line.match(/VC:\s*[₹]?([\d,]+\.?\d*)/i)
  const vc = vcMatch ? vcMatch[1].replace(/,/g,'') : '0'
  const amounts = [...withoutCo.matchAll(/[₹]?([\d,]+\.?\d*)/g)]
    .map(m => m[1].replace(/,/g,'')).filter(v => v && parseFloat(v) > 0)
  let rate='0', total='0'
  for (const a of amounts) {
    const n = parseFloat(a)
    if (rate==='0' && n>0 && n<200) { rate=a; continue }
    if (total==='0' && n>=parseFloat(rate||'0') && n>0) { total=a; break }
  }
  return { sold, rate, total, vc }
}

// ─── Build card ───────────────────────────────────────────────────────────────
function buildCard(name, type, DEF_RATE, idx, { ml, nb, book, running_bill, old_due, cut, total_bill }) {
  const isSeller = type === 'seller'
  const safeRate = (r, def) => (r && parseFloat(r) > 0) ? r : String(def)
  return {
    id:        `bulk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,6)}`,
    userId:    null,
    name:      name.replace(/\s+/g,' ').trim(),
    phone:     '',
    _nl:       false,
    oldDue:    old_due  && old_due  !== '0' ? old_due  : '',
    cut:       cut      && cut      !== '0' ? cut      : '',
    createdAt: todayISO(),
    type,
    rows: [
      { company:'ML',      sold:ml.sold  ||'0', rate:safeRate(ml.rate,  DEF_RATE.ML),      vc:ml.vc  ||'0', ...(isSeller?{}:{pwt:'0'}) },
      { company:'NB',      sold:nb.sold  ||'0', rate:safeRate(nb.rate,  DEF_RATE.NB),      vc:nb.vc  ||'0', ...(isSeller?{}:{pwt:'0'}) },
      { company:'Booking', sold:book.sold||'0', rate:safeRate(book.rate,DEF_RATE.Booking), vc:book.vc||'0', ...(isSeller?{}:{pwt:'0'}) },
    ],
    _pdf: {
      running_bill:running_bill||'0', old_due:old_due||'0', total_bill:total_bill||'0',
      ml_sold:ml.sold||'0',   ml_rate:ml.rate||'0',   ml_vc:ml.vc||'0',
      nb_sold:nb.sold||'0',   nb_rate:nb.rate||'0',   nb_vc:nb.vc||'0',
      bk_sold:book.sold||'0', bk_rate:book.rate||'0', bk_vc:book.vc||'0',
    },
  }
}

// ─── Parse pasted plain text (for vector PDFs) ───────────────────────────────
// Accepts raw text pasted from the PDF report page
// Handles the Format B line structure as visible when selecting-all in browser
function parsePastedText(rawText, DEF_RATE, type) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const fmt = detectFormat(lines)
  if (fmt === 'A') return parseFormatA(lines, DEF_RATE, type)
  return parseFormatB(lines, DEF_RATE, type)
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
async function parseBillingPDF(file, type, onProgress) {
  onProgress('Loading PDF…', 5)
  const lines = await extractLines(file, onProgress)

  // VECTOR PDF DETECTION: if we got < 5 lines, this is a vector-only PDF
  if (lines.length < 5) {
    return { customers: [], format: 'VECTOR', lineCount: lines.length }
  }

  onProgress('Detecting format…', 42)
  const fmt = detectFormat(lines)
  onProgress(`${fmt==='B'?'② Report PDF':'① Billing PDF'} — extracting customers…`, 46)

  const DEF_RATE = type === 'seller' ? DEF_SR : DEF_TR
  let customers = fmt === 'B'
    ? parseFormatB(lines, DEF_RATE, type)
    : parseFormatA(lines, DEF_RATE, type)

  const seen = new Map()
  customers.forEach(c => { if (c) seen.set(c.name.toLowerCase().trim(), c) })
  customers = [...seen.values()]

  onProgress('Done!', 100)
  return { customers, format: fmt, lineCount: lines.length }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BulkPDFUploadModal({ type, onBulkAdd, onClose }) {
  const fileRef   = useRef(null)
  const [step,       setStep]      = useState('upload')   // upload|parsing|vector|paste|preview|done
  const [progress,   setProgress]  = useState(0)
  const [statusMsg,  setStatusMsg] = useState('')
  const [customers,  setCustomers] = useState([])
  const [selected,   setSelected]  = useState(new Set())
  const [fileName,   setFileName]  = useState('')
  const [pdfFormat,  setPdfFormat] = useState('')
  const [pasteText,  setPasteText] = useState('')
  const [pasteError, setPasteError]= useState('')

  const isSeller = type === 'seller'

  const processFile = async (file) => {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) return
    setFileName(file.name); setStep('parsing'); setProgress(0)

    const { customers: parsed, format, lineCount } = await parseBillingPDF(
      file, type, (msg, pct) => { setStatusMsg(msg); setProgress(pct) }
    )

    if (format === 'VECTOR') {
      setStep('vector')
      return
    }

    if (!parsed.length) {
      setStep('vector')
      return
    }

    setPdfFormat(format)
    setCustomers(parsed)
    setSelected(new Set(parsed.map(c => c.id)))
    setStep('preview')
  }

  const processPaste = () => {
    if (!pasteText.trim()) { setPasteError('Please paste text first.'); return }
    const DEF_RATE = isSeller ? DEF_SR : DEF_TR
    try {
      const parsed = parsePastedText(pasteText, DEF_RATE, type)
      if (!parsed.length) {
        setPasteError('No customers found in pasted text. Make sure it contains customer names with seller/stocker labels.')
        return
      }
      const seen = new Map()
      parsed.forEach(c => seen.set(c.name.toLowerCase().trim(), c))
      const unique = [...seen.values()]
      setPdfFormat('PASTE')
      setCustomers(unique)
      setSelected(new Set(unique.map(c => c.id)))
      setStep('preview')
    } catch(e) {
      setPasteError('Parse error: ' + e.message)
    }
  }

  const toggle    = id => setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  const selectAll = () => setSelected(new Set(customers.map(c => c.id)))
  const clearAll  = () => setSelected(new Set())
  const edit = (id, field, val) => setCustomers(prev => prev.map(c => {
    if (c.id !== id) return c
    if (['name','phone','oldDue','cut'].includes(field)) return { ...c, [field]: val }
    const [co, key] = field.split('_')
    return { ...c, rows: c.rows.map(r => r.company===co ? { ...r, [key]: val } : r) }
  }))
  const doImport = () => { onBulkAdd(customers.filter(c => selected.has(c.id))); setStep('done') }

  const INP = { padding:'5px 8px', borderRadius:6, border:'1.5px solid #ddd', fontSize:12, width:'100%', fontFamily:'inherit', outline:'none' }
  const TH  = bg => ({ padding:'9px 10px', background:bg, color:'#fff', fontWeight:700, fontSize:11, textAlign:'center', whiteSpace:'nowrap' })
  const TD  = (al='center') => ({ padding:'6px 8px', fontSize:12, textAlign:al, borderBottom:'1px solid #f0f0f0' })

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9992,backdropFilter:'blur(4px)',padding:12 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:step==='preview'?1180:660,maxHeight:'95vh',overflowY:'auto',boxShadow:'0 32px 80px rgba(0,0,0,.45)',display:'flex',flexDirection:'column',transition:'max-width .25s' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1a237e,#283593,#3949ab)',padding:'18px 24px',borderRadius:'20px 20px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff',fontWeight:900,fontSize:17 }}>📄 Upload PDF → Auto Import</div>
            <div style={{ color:'rgba(255,255,255,.75)',fontSize:12,marginTop:3 }}>
              Auto-extracts all customers → imports into&nbsp;
              <span style={{ background:isSeller?'#1976d2':'#00897b',color:'#fff',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700 }}>{isSeller?'✅ Seller':'📦 Stocker'}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:8,color:'#fff',fontSize:20,cursor:'pointer',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:20,flex:1,overflowY:'auto' }}>

          {/* ── UPLOAD ── */}
          {step==='upload' && (
            <>
              <div onClick={()=>fileRef.current?.click()}
                onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();processFile(e.dataTransfer.files[0])}}
                style={{ border:'3px dashed #3949ab',borderRadius:16,padding:'36px 24px',textAlign:'center',cursor:'pointer',background:'#f0f4ff',marginBottom:16 }}
                onMouseOver={e=>e.currentTarget.style.background='#e8eaf6'} onMouseOut={e=>e.currentTarget.style.background='#f0f4ff'}>
                <div style={{ fontSize:52,marginBottom:10 }}>📂</div>
                <div style={{ fontWeight:800,color:'#1a237e',fontSize:18,marginBottom:6 }}>Click or Drag &amp; Drop PDF</div>
                <div style={{ color:'#666',fontSize:13,lineHeight:1.8 }}>
                  <b>① NB Agency Billing PDFs</b> (with "Customer:" labels)<br/>
                  <b>② Lottery Billing Report PDFs</b> — use <b>📄 Download PDF</b> button
                </div>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>processFile(e.target.files[0])}/>
              </div>

              <div style={{ background:'#fff3e0',border:'2px solid #ffb74d',borderRadius:12,padding:'14px 18px',marginBottom:16,display:'flex',gap:12 }}>
                <span style={{ fontSize:22,flexShrink:0 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight:800,color:'#e65100',fontSize:13,marginBottom:4 }}>Use "📄 Download PDF" — NOT the Print / Save as PDF dialog</div>
                  <div style={{ fontSize:12,color:'#555',lineHeight:1.7 }}>
                    Windows Print-to-PDF and Chrome Print store text as vector paths — PDF.js cannot read them.<br/>
                    The <b>📄 Download PDF</b> button in Reports creates a text-layer PDF that can be re-imported.
                  </div>
                </div>
              </div>

              <div style={{ background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:12,padding:'12px 16px',display:'flex',gap:10,alignItems:'center' }}>
                <span style={{ fontSize:20 }}>💡</span>
                <div style={{ fontSize:12,color:'#1565c0' }}>
                  <b>Have a vector PDF?</b> Open the Report in your browser, press <b>Ctrl+A → Ctrl+C</b> to copy all text, then&nbsp;
                  <button onClick={()=>setStep('paste')}
                    style={{ background:'#1565c0',color:'#fff',border:'none',borderRadius:6,padding:'3px 12px',cursor:'pointer',fontWeight:700,fontSize:12 }}>
                    Paste Text to Import
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── PARSING ── */}
          {step==='parsing' && (
            <div style={{ padding:'50px 20px',textAlign:'center' }}>
              <div style={{ fontSize:52,marginBottom:14 }}>⏳</div>
              <div style={{ fontWeight:800,fontSize:18,color:'#1a237e',marginBottom:12 }}>{statusMsg||'Processing PDF…'}</div>
              <div style={{ background:'#e8eaf6',borderRadius:8,height:12,overflow:'hidden',margin:'0 auto 12px',maxWidth:420 }}>
                <div style={{ height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#1565c0,#3949ab)',borderRadius:8,transition:'width .35s' }}/>
              </div>
              <div style={{ fontSize:13,color:'#888' }}>{progress}%</div>
            </div>
          )}

          {/* ── VECTOR PDF DETECTED ── */}
          {step==='vector' && (
            <>
              <div style={{ background:'#ffebee',border:'2px solid #ef9a9a',borderRadius:14,padding:'20px',marginBottom:20,textAlign:'center' }}>
                <div style={{ fontSize:44,marginBottom:10 }}>🚫</div>
                <div style={{ fontWeight:900,fontSize:18,color:'#b71c1c',marginBottom:8 }}>Vector PDF — Text Cannot Be Extracted</div>
                <div style={{ fontSize:13,color:'#555',lineHeight:1.8,marginBottom:16 }}>
                  <b>"{fileName}"</b> was created using <b>Windows Print-to-PDF</b> or <b>Chrome Print dialog</b>.<br/>
                  These store text as vector glyph paths — no PDF library can read them.<br/>
                </div>
                <div style={{ display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap' }}>
                  <button onClick={()=>setStep('upload')}
                    style={{ background:'linear-gradient(135deg,#1565c0,#1976d2)',color:'#fff',border:'none',borderRadius:10,padding:'11px 22px',cursor:'pointer',fontWeight:700,fontSize:14 }}>
                    ← Try Another PDF
                  </button>
                  <button onClick={()=>setStep('paste')}
                    style={{ background:'linear-gradient(135deg,#2e7d32,#43a047)',color:'#fff',border:'none',borderRadius:10,padding:'11px 22px',cursor:'pointer',fontWeight:700,fontSize:14 }}>
                    📋 Paste Text Instead
                  </button>
                </div>
              </div>

              <div style={{ background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:12,padding:'16px 18px' }}>
                <div style={{ fontWeight:800,color:'#2e7d32',fontSize:14,marginBottom:10 }}>✅ How to Fix This</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,fontSize:13,color:'#555',lineHeight:1.7 }}>
                  <div>
                    <div style={{ fontWeight:700,color:'#1565c0',marginBottom:4 }}>Option 1 — Use Download PDF button:</div>
                    1. Go to <b>📊 Reports</b> in the app<br/>
                    2. Click <b>📄 Download PDF</b> (NOT Print)<br/>
                    3. Upload the downloaded PDF here
                  </div>
                  <div>
                    <div style={{ fontWeight:700,color:'#1565c0',marginBottom:4 }}>Option 2 — Paste text:</div>
                    1. Open your Report PDF in Chrome<br/>
                    2. Press <b>Ctrl+A</b> then <b>Ctrl+C</b><br/>
                    3. Click "Paste Text Instead" above
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── PASTE TEXT ── */}
          {step==='paste' && (
            <>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontWeight:800,color:'#1a237e',fontSize:16,marginBottom:6 }}>📋 Paste Report Text</div>
                <div style={{ fontSize:13,color:'#666',marginBottom:12,lineHeight:1.7 }}>
                  Open your Report in Chrome, press <b>Ctrl+A → Ctrl+C</b>, then paste below.<br/>
                  The system will extract all customer data automatically.
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setPasteError('') }}
                  placeholder={`Paste text here...\n\nExample:\n1 ABDUL RB N/A • 2026-03-20 seller +OD ₹208139\nRUNNING BILL ₹5306.50 TOTAL BILL ₹213445.50\nML 145 ₹10.5 ₹1522.50 VC:₹0.00 ₹1522.50\nNB 480 ₹10.8 ₹5184.00 VC:₹1400.00 ₹3784.00\n↳ Total 625 ₹6706.50 VC:₹1400.00 Sub:₹5306.50\n...`}
                  style={{ width:'100%',height:260,padding:'12px',borderRadius:10,border:'2px solid #e8eaf6',fontSize:12,fontFamily:'monospace',resize:'vertical',outline:'none',lineHeight:1.6,boxSizing:'border-box' }}
                />
                {pasteError && <div style={{ color:'#c62828',fontSize:12,marginTop:6 }}>⚠️ {pasteError}</div>}
              </div>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setStep('upload')}
                  style={{ background:'#f5f5f5',border:'1px solid #ddd',borderRadius:10,padding:'11px 22px',cursor:'pointer',fontWeight:700,fontSize:14,color:'#555' }}>
                  ← Back
                </button>
                <button onClick={processPaste} disabled={!pasteText.trim()}
                  style={{ background:pasteText.trim()?'linear-gradient(135deg,#1565c0,#1976d2)':'#bdbdbd',color:'#fff',border:'none',borderRadius:10,padding:'11px 28px',cursor:pasteText.trim()?'pointer':'not-allowed',fontWeight:800,fontSize:14,flex:1 }}>
                  🔍 Extract Customers from Text
                </button>
              </div>
            </>
          )}

          {/* ── PREVIEW ── */}
          {step==='preview' && (
            <>
              <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center' }}>
                <div style={{ background:'#e8f5e9',borderRadius:10,padding:'10px 18px',display:'flex',gap:8,alignItems:'center',border:'1px solid #a5d6a7' }}>
                  <span style={{ fontSize:24 }}>👥</span>
                  <div><div style={{ fontWeight:900,fontSize:20,color:'#1b5e20' }}>{customers.length}</div><div style={{ fontSize:11,color:'#555' }}>Customers</div></div>
                </div>
                <div style={{ background:'#e3f2fd',borderRadius:10,padding:'10px 18px',display:'flex',gap:8,alignItems:'center',border:'1px solid #90caf9' }}>
                  <span style={{ fontSize:24 }}>✅</span>
                  <div><div style={{ fontWeight:900,fontSize:20,color:'#1565c0' }}>{selected.size}</div><div style={{ fontSize:11,color:'#555' }}>Selected</div></div>
                </div>
                <div style={{ background:'#f3e5f5',borderRadius:10,padding:'10px 18px',flex:1,border:'1px solid #ce93d8' }}>
                  <div style={{ fontSize:11,color:'#7b1fa2',fontWeight:700 }}>
                    {pdfFormat==='PASTE'?'📋 Pasted Text':pdfFormat==='B'?'② Report PDF':'① Billing PDF'}
                  </div>
                  <div style={{ fontSize:12,color:'#555',fontWeight:600,marginTop:2 }}>
                    PDF Imported Successfully — {customers.length} Customers Loaded With Rates
                  </div>
                </div>
                <button onClick={selectAll} style={{ background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:12,color:'#2e7d32' }}>☑ All</button>
                <button onClick={clearAll}  style={{ background:'#ffebee',border:'1px solid #ffcdd2',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:12,color:'#c62828' }}>☐ None</button>
              </div>

              <div style={{ overflowX:'auto',borderRadius:14,border:'1px solid #e8eaf6',boxShadow:'0 2px 12px rgba(0,0,0,.06)',marginBottom:16 }}>
                <table style={{ width:'100%',borderCollapse:'collapse',minWidth:isSeller?940:1100 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH('#37474f'),width:34 }}>☑</th>
                      <th style={{ ...TH('#1a237e'),textAlign:'left',width:28 }}>#</th>
                      <th style={{ ...TH('#1a237e'),textAlign:'left',minWidth:140 }}>Customer Name</th>
                      <th style={{ ...TH('#1a237e'),minWidth:90 }}>Phone</th>
                      <th colSpan={isSeller?3:4} style={TH(CO_CLR.ML)}>ML</th>
                      <th colSpan={isSeller?3:4} style={TH(CO_CLR.NB)}>NB</th>
                      <th colSpan={isSeller?3:4} style={TH(CO_CLR.Booking)}>Booking</th>
                      <th colSpan={2} style={TH('#b71c1c')}>Old Due / Cut</th>
                    </tr>
                    <tr style={{ background:'#f8f9ff' }}>
                      <td/><td/><td/><td/>
                      {['ML','NB','Booking'].map(co => (
                        <React.Fragment key={co}>
                          <td style={{ ...TD(),fontSize:10,color:'#888',fontWeight:700,background:(CO_LIGHT[co]||'#eee') }}>Sold</td>
                          <td style={{ ...TD(),fontSize:10,color:'#888',fontWeight:700,background:(CO_LIGHT[co]||'#eee') }}>Rate</td>
                          {!isSeller && <td style={{ ...TD(),fontSize:10,color:'#888',fontWeight:700,background:(CO_LIGHT[co]||'#eee') }}>PWT</td>}
                          <td style={{ ...TD(),fontSize:10,color:'#888',fontWeight:700,background:(CO_LIGHT[co]||'#eee') }}>VC</td>
                        </React.Fragment>
                      ))}
                      <td style={{ ...TD(),fontSize:10,color:'#888',fontWeight:700,background:'#ffebee' }}>Old Due</td>
                      <td style={{ ...TD(),fontSize:10,color:'#888',fontWeight:700,background:'#ffebee' }}>Cut</td>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, idx) => {
                      const isSel = selected.has(c.id)
                      return (
                        <tr key={c.id} style={{ background:isSel?(idx%2===0?'#fff':'#f8f9ff'):'#f5f5f5',opacity:isSel?1:.4 }}>
                          <td style={{ ...TD(),padding:'4px' }}><input type="checkbox" checked={isSel} onChange={()=>toggle(c.id)} style={{ width:15,height:15,cursor:'pointer' }}/></td>
                          <td style={{ ...TD('left'),fontWeight:700,color:'#bbb',fontSize:11 }}>{idx+1}</td>
                          <td style={TD('left')}><input style={{ ...INP,minWidth:120 }} value={c.name} onChange={e=>edit(c.id,'name',e.target.value)}/></td>
                          <td style={TD()}><input style={{ ...INP,minWidth:80 }} value={c.phone} onChange={e=>edit(c.id,'phone',e.target.value)} placeholder="Phone"/></td>
                          {c.rows.map(r => (
                            <React.Fragment key={r.company}>
                              <td style={{ ...TD(),background:(CO_LIGHT[r.company]||'#eee')+'88' }}>
                                <input type="number" style={{ ...INP,width:54 }} value={r.sold} onChange={e=>edit(c.id,`${r.company}_sold`,e.target.value)} placeholder="0"/>
                              </td>
                              <td style={{ ...TD(),background:(CO_LIGHT[r.company]||'#eee')+'88' }}>
                                <input type="number" style={{ ...INP,width:48 }} value={r.rate} onChange={e=>edit(c.id,`${r.company}_rate`,e.target.value)} placeholder="0"/>
                              </td>
                              {!isSeller && (
                                <td style={{ ...TD(),background:(CO_LIGHT[r.company]||'#eee')+'88' }}>
                                  <input type="number" style={{ ...INP,width:46 }} value={r.pwt||''} onChange={e=>edit(c.id,`${r.company}_pwt`,e.target.value)} placeholder="0"/>
                                </td>
                              )}
                              <td style={{ ...TD(),background:(CO_LIGHT[r.company]||'#eee')+'88' }}>
                                <input type="number" style={{ ...INP,width:54 }} value={r.vc} onChange={e=>edit(c.id,`${r.company}_vc`,e.target.value)} placeholder="0"/>
                              </td>
                            </React.Fragment>
                          ))}
                          <td style={{ ...TD(),background:'#fff8e1' }}>
                            <input type="number" style={{ ...INP,width:72 }} value={c.oldDue} onChange={e=>edit(c.id,'oldDue',e.target.value)} placeholder="0"/>
                          </td>
                          <td style={{ ...TD(),background:'#fff8e1' }}>
                            <input type="number" style={{ ...INP,width:62 }} value={c.cut} onChange={e=>edit(c.id,'cut',e.target.value)} placeholder="0"/>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── DONE ── */}
          {step==='done' && (
            <div style={{ textAlign:'center',padding:'50px 20px' }}>
              <div style={{ fontSize:70,marginBottom:18 }}>🎉</div>
              <div style={{ fontWeight:900,fontSize:24,color:'#2e7d32',marginBottom:8 }}>PDF Imported Successfully!</div>
              <div style={{ fontWeight:700,fontSize:17,color:'#1a237e',marginBottom:6 }}>{selected.size} Customers Loaded With Rates</div>
              <div style={{ fontSize:13,color:'#888',marginBottom:28,lineHeight:1.8 }}>
                ✅ Customer Names &nbsp;✅ ML/NB/Booking Sold + Rate &nbsp;✅ VC &nbsp;✅ Old Due &nbsp;✅ Totals auto-calculated
              </div>
              <button onClick={onClose} style={{ background:'linear-gradient(135deg,#1565c0,#1976d2)',color:'#fff',border:'none',borderRadius:12,padding:'14px 40px',cursor:'pointer',fontWeight:800,fontSize:17 }}>
                ✅ View Customers
              </button>
            </div>
          )}
        </div>

        {step==='preview' && (
          <div style={{ padding:'14px 20px',borderTop:'1px solid #e8e8e8',display:'flex',gap:10,alignItems:'center',flexShrink:0,background:'#fafafa',borderRadius:'0 0 20px 20px' }}>
            <button onClick={()=>setStep('upload')}
              style={{ background:'#f5f5f5',border:'1px solid #ddd',borderRadius:10,padding:'11px 22px',cursor:'pointer',fontWeight:700,fontSize:14,color:'#555' }}>
              ← Re-upload
            </button>
            <div style={{ flex:1,textAlign:'center',fontSize:13,color:'#888' }}>{selected.size} of {customers.length} selected</div>
            <button onClick={doImport} disabled={selected.size===0}
              style={{ background:selected.size>0?'linear-gradient(135deg,#2e7d32,#43a047)':'#bdbdbd',color:'#fff',border:'none',borderRadius:10,padding:'12px 32px',cursor:selected.size>0?'pointer':'not-allowed',fontWeight:800,fontSize:15 }}>
              ✅ Import {selected.size} Customer{selected.size!==1?'s':''} → {isSeller?'Seller':'Stocker'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
