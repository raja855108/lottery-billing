export const COMPANIES = ['ML', 'NB', 'Booking']
export const DEF_SR    = { ML: 80, NB: 80, Booking: 80 }
export const DEF_TR    = { ML: 75, NB: 75, Booking: 75 }
export const CO_CLR    = { ML: '#1565c0', NB: '#6a1b9a', Booking: '#00695c' }
export const CO_LIGHT  = { ML: '#e3f2fd', NB: '#f3e5f5', Booking: '#e0f2f1' }

export const fmt      = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
export const waURL    = (ph, msg) => `https://wa.me/91${ph}?text=${encodeURIComponent(msg)}`
export const today    = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
export const todayISO = () => new Date().toISOString().slice(0, 10)

let _idCounter = Date.now()
export const nextId = () => String(++_idCounter)

// ── PART 1: Paise-based rounding — eliminates ALL floating-point ₹1 bugs ──────
// Convert to paise (×100), do integer arithmetic, convert back (÷100)
// This guarantees exact 2-decimal results with no IEEE-754 drift.

export const num = v => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n   // allow negatives — VC > Total is a valid credit
}

// num for input fields (quantities, rates, vc — never negative from user input)
export const numPos = v => {
  const n = parseFloat(v)
  return isNaN(n) || n < 0 ? 0 : n
}

// Safe money arithmetic using paise integers
const p  = v => Math.round((isNaN(parseFloat(v)) ? 0 : parseFloat(v)) * 100)  // paise, allows negatives
const rp = v => parseFloat((v / 100).toFixed(2))  // paise → rupees (2dp)
// Add/subtract up to 6 values in paise, return rupees
const addP  = (...vals) => rp(vals.reduce((a, v) => a + p(v), 0))
const subP  = (a, ...subs) => rp(p(a) - subs.reduce((acc, v) => acc + p(v), 0))
const mulP  = (a, b) => rp(p(a) * num(b) / 100)   // rate × qty → paise then back

export const newSeller = (id, userId) => ({
  id, userId, name: '', phone: '', _nl: false, oldDue: '', cut: '',
  createdAt: todayISO(), type: 'seller',
  rows: COMPANIES.map(co => ({ company: co, sold: '', rate: DEF_SR[co], vc: '' })),
})
export const newStocker = (id, userId) => ({
  id, userId, name: '', phone: '', _nl: false, oldDue: '', cut: '',
  createdAt: todayISO(), type: 'stocker',
  rows: COMPANIES.map(co => ({ company: co, sold: '', rate: DEF_TR[co], pwt: '', vc: '' })),
})

// ── calcSeller — paise-safe ───────────────────────────────────────────────────
export const calcSeller = c => {
  const rowCalc = c.rows.map(r => {
    const sold  = num(r.sold)
    const rate  = num(r.rate)
    const vc    = num(r.vc)
    const total = parseFloat((Math.round(sold * rate * 100) / 100).toFixed(2))  // sold × rate, paise-safe
    const bill  = subP(total, vc)
    return { ...r, total, bill }
  })
  const tSold    = rowCalc.reduce((a, r) => a + num(r.sold), 0)
  const tAmt     = rp(rowCalc.reduce((a, r) => a + p(r.total), 0))
  const tVC      = rp(rowCalc.reduce((a, r) => a + p(num(r.vc)), 0))
  const subtotal   = subP(tAmt, tVC)          // tAmt − VC  (kept for backward compat)
  const od         = rp(p(num(c.oldDue)))
  const ct         = rp(p(num(c.cut)))
  const finalBill  = addP(subtotal, od, ct)   // subtotal + OD + Cut (kept for DB compat)

  // ── Display fields (screenshot-verified) ──
  // Running Bill = tAmt − VC  =  subtotal  (Amount after VC, before Old Due/Cut)
  const runningBill = subtotal
  // Total Bill   = subtotal + Old Due + Cut  =  finalBill
  const totalBill   = finalBill

  return { rowCalc, tSold, tAmt, tVC, subtotal, od, ct, finalBill, runningBill, totalBill }
}

// ── calcStocker — paise-safe ─────────────────────────────────────────────────
export const calcStocker = c => {
  const rowCalc = c.rows.map(r => {
    const sold  = num(r.sold)
    const rate  = num(r.rate)
    const pwt   = num(r.pwt)
    const vc    = num(r.vc)
    const total = parseFloat((Math.round(sold * rate * 100) / 100).toFixed(2))  // sold × rate, paise-safe
    const bill  = subP(total, pwt, vc)
    return { ...r, total, bill }
  })
  const tSold    = rowCalc.reduce((a, r) => a + num(r.sold), 0)
  const tAmt     = rp(rowCalc.reduce((a, r) => a + p(r.total), 0))
  const tPWT     = rp(rowCalc.reduce((a, r) => a + p(num(r.pwt)), 0))
  const tVC      = rp(rowCalc.reduce((a, r) => a + p(num(r.vc)), 0))
  const subtotal   = subP(tAmt, tPWT, tVC)    // tAmt − PWT − VC (kept for DB compat)
  const od         = rp(p(num(c.oldDue)))
  const ct         = rp(p(num(c.cut)))
  const finalBill  = addP(subtotal, od, ct)   // subtotal + OD + Cut (kept for DB compat)

  // ── Display fields (screenshot-verified) ──
  // Running Bill = tAmt − PWT − VC  =  subtotal  (Amount after PWT+VC, before Old Due/Cut)
  const runningBill = subtotal
  // Total Bill   = subtotal + Old Due + Cut  =  finalBill
  const totalBill   = finalBill

  return { rowCalc, tSold, tAmt, tPWT, tVC, subtotal, od, ct, finalBill, runningBill, totalBill }
}

// ── WhatsApp text ─────────────────────────────────────────────────────────────
export const buildWAMsg = (type, c, detailed = true, _unused = null) => {
  const isS  = type === 'seller'
  const calc = isS ? calcSeller(c) : calcStocker(c)
  const { rowCalc, tSold, tAmt, tVC, subtotal, od, ct, finalBill, runningBill, totalBill } = calc
  const tPWT = calc.tPWT || 0
  const L = []
  L.push(isS ? '🎟️ *Lottery Bill*' : '📦 *Stock Settlement*')
  L.push(`👤 *${c.name || 'Customer'}*`)
  L.push(`📅 Date: ${today()}`)
  L.push('─────────────────')
  if (detailed) {
    rowCalc.forEach(r => {
      L.push(`\n*${r.company}*`)
      L.push(`  Sold: ${num(r.sold)}  |  Rate: ₹${num(r.rate)}`)
      L.push(`  Total: ₹${r.total.toFixed(2)}`)
      if (!isS) L.push(`  PWT: ${num(r.pwt)}`)
      L.push(`  VC: ₹${num(r.vc).toFixed(2)}`)
      L.push(`  Bill: ₹${r.bill.toFixed(2)}`)
    })
    L.push('\n─────────────────')
  }
  L.push(`📦 Total Sold: ${tSold}`)
  L.push(`💰 Total Amount: ₹${tAmt.toFixed(2)}`)
  if (!isS) L.push(`📦 Total PWT: ₹${tPWT.toFixed(2)}`)
  L.push(`🎁 Total VC: ₹${tVC.toFixed(2)}`)
  L.push('─────────────────')
  L.push(`🏷️ *Running Bill: ₹${runningBill.toFixed(2)}*  (Amount − VC)`)
  if (od > 0) L.push(`📌 Old Due: +₹${od.toFixed(2)}`)
  if (ct > 0) L.push(`✂️ Cut: +₹${ct.toFixed(2)}`)
  L.push('─────────────────')
  L.push(`💳 *Total Bill: ₹${totalBill.toFixed(2)}*`)
  L.push(isS ? '\nPlease clear dues. Thank you! 🙏' : '\nKindly settle the balance. Thank you! 🙏')
  return L.join('\n')
}

// ── Single Bill PDF ───────────────────────────────────────────────────────────
export const printSingleBill = (type, c) => {
  const isS  = type === 'seller'
  const calc = isS ? calcSeller(c) : calcStocker(c)
  const { rowCalc, tSold, tAmt, tVC, subtotal, od, ct, finalBill } = calc
  const tPWT = calc.tPWT || 0
  const runningBill = calc.runningBill  // Sold Amount (before all deductions)
  const totalBill   = calc.totalBill    // After VC & Old Due

  const trs = rowCalc.map((r, i) => {
    const sold = num(r.sold), rate = num(r.rate), vc = num(r.vc), pwt = num(r.pwt)
    const rowBg   = i % 2 === 0 ? '#ffffff' : '#f0f4ff'
    const billClr = r.bill > 0 ? '#c62828' : '#2e7d32'
    const coClr   = CO_CLR[r.company] || '#455a64'
    if (isS) {
      return `<tr style="background:${rowBg}">
        <td style="padding:10px 12px"><span style="background:${coClr};color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">${r.company}</span></td>
        <td style="padding:10px 12px;text-align:center;font-weight:600">${sold}</td>
        <td style="padding:10px 12px;text-align:center">₹${rate}</td>
        <td style="padding:10px 12px;color:#1565c0;font-weight:700">₹${r.total.toFixed(2)}</td>
        <td style="padding:10px 12px;color:#6a1b9a">₹${vc.toFixed(2)}</td>
        <td style="padding:10px 12px;font-weight:700;color:${billClr}">₹${r.bill.toFixed(2)}</td>
      </tr>`
    }
    return `<tr style="background:${rowBg}">
      <td style="padding:10px 12px"><span style="background:${coClr};color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">${r.company}</span></td>
      <td style="padding:10px 12px;text-align:center;font-weight:600">${sold}</td>
      <td style="padding:10px 12px;text-align:center">₹${rate}</td>
      <td style="padding:10px 12px;color:#1565c0;font-weight:700">₹${r.total.toFixed(2)}</td>
      <td style="padding:10px 12px;text-align:center;color:#6a1b9a">${pwt}</td>
      <td style="padding:10px 12px;color:#4a148c">₹${vc.toFixed(2)}</td>
      <td style="padding:10px 12px;font-weight:700;color:${billClr}">₹${r.bill.toFixed(2)}</td>
    </tr>`
  }).join('')

  const w = window.open('', '_blank')
  if (!w) { alert('Allow popups to print.'); return }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Bill \u2013 ${c.name || 'Customer'}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{max-width:780px;margin:20px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(26,35,126,0.18)}

    /* ── Agency header ── */
    .agency-hdr{background:linear-gradient(135deg,#0d1b4b 0%,#1a237e 45%,#283593 75%,#3949ab 100%)!important;padding:24px 28px;color:#fff;text-align:center;position:relative}
    .agency-name{font-size:28px;font-weight:900;letter-spacing:2px;text-shadow:0 2px 8px rgba(0,0,0,0.3)}
    .agency-sub{font-size:14px;opacity:.8;margin-top:4px;letter-spacing:1px}
    .agency-date{position:absolute;top:18px;right:24px;background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600}
    .divider-bar{height:4px;background:linear-gradient(90deg,#f59e0b,#d97706,#f59e0b)!important}

    /* ── Customer card ── */
    .cust-card{margin:20px 24px;background:linear-gradient(135deg,rgba(26,35,126,0.06),rgba(240,245,255,0.8));border:1.5px solid rgba(26,35,126,0.15);border-radius:16px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px}
    .cust-name{font-size:24px;font-weight:900;color:#1a237e;letter-spacing:.5px}
    .cust-info{font-size:13px;color:#555;margin-top:5px;line-height:1.8}
    .type-badge{display:inline-block;padding:5px 18px;border-radius:20px;font-size:12px;font-weight:800;letter-spacing:.5px;color:#fff}

    /* ── 4 Summary boxes ── */
    .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 24px 18px}
    .sum-box{border-radius:14px;padding:14px 16px;text-align:center;border:1.5px solid transparent}
    .sum-label{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;opacity:.8}
    .sum-value{font-size:18px;font-weight:900;letter-spacing:-.5px}

    /* ── Table ── */
    .tbl-wrap{margin:0 24px 18px;border-radius:14px;overflow:hidden;border:1.5px solid rgba(26,35,126,0.12);box-shadow:0 4px 16px rgba(26,35,126,0.08)}
    table{width:100%;border-collapse:collapse}
    thead tr{background:linear-gradient(135deg,#1a237e,#3949ab)!important}
    thead th{padding:11px 14px;color:#fff!important;font-size:12px;font-weight:700;text-align:center;letter-spacing:.3px}
    thead th:first-child{text-align:left}
    tbody tr:nth-child(even){background:rgba(240,245,255,0.7)}
    tbody tr:nth-child(odd){background:rgba(255,255,255,0.9)}
    td{padding:10px 14px;font-size:13px;text-align:center;color:#333}
    td:first-child{text-align:left}

    /* ── Total row ── */
    .total-row{background:linear-gradient(135deg,rgba(26,35,126,0.1),rgba(57,73,171,0.12))!important}
    .total-row td{font-weight:800;font-size:13px;padding:12px 14px;color:#1a237e;border-top:2px solid rgba(26,35,126,0.2)}

    /* ── Footer ── */
    .bill-footer{margin:0 24px 24px;padding:16px 20px;background:linear-gradient(135deg,rgba(26,35,126,0.06),rgba(240,245,255,0.6));border-radius:14px;border:1px solid rgba(26,35,126,0.1);display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px}
    .sig-line{border-top:1.5px solid #888;margin-top:32px;padding-top:6px;text-align:center;font-size:11px;color:#888;min-width:140px}
    .print-actions{background:#f8f9ff;border-top:1px solid #e0e0e0;padding:14px;display:flex;gap:10px;justify-content:center}
    @media print{
      body{background:#fff!important}
      .page{margin:0;border-radius:0;box-shadow:none}
      .print-actions{display:none!important}
    }
  </style></head><body>
  <div class="page" id="bill-root">

    <!-- Agency Header -->
    <div class="agency-hdr">
      <div class="agency-date">📅 ${today()}</div>
      <div class="agency-name">🎲 NB AGENCY</div>
      <div class="agency-sub">Lottery Billing Report</div>
    </div>
    <div class="divider-bar"></div>

    <!-- Customer Card -->
    <div class="cust-card">
      <div>
        <div class="cust-name">${c.name || 'N/A'}</div>
        <div class="cust-info">
          📞 ${c.phone || 'N/A'} &nbsp;&nbsp; 📅 ${today()}
        </div>
        <div style="margin-top:8px">
          <span class="type-badge" style="background:${isS?'linear-gradient(135deg,#1565c0,#1976d2)':'linear-gradient(135deg,#00695c,#00897b)'}">
            ${isS ? '✅ SELLER' : '📦 STOCKER'}
          </span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#888;font-weight:600;letter-spacing:.5px;margin-bottom:4px">BILL DATE</div>
        <div style="font-size:20px;font-weight:800;color:#1a237e">${today()}</div>
      </div>
    </div>

    <!-- 4 Summary Boxes -->
    <div class="summary-grid">
      <!-- Old Due / Advance -->
      <div class="sum-box" style="background:${od>0?'linear-gradient(135deg,#fff3e0,#ffe0b2)':'linear-gradient(135deg,#e8f5e9,#c8e6c9)'}!important;border-color:${od>0?'#ffb74d':'#81c784'}">
        <div class="sum-label" style="color:${od>0?'#bf360c':'#1b5e20'}">${od>0?'OLD DUE':od<0?'ADVANCE':'NO DUE'}</div>
        <div class="sum-value" style="color:${od>0?'#e65100':'#2e7d32'}">${od===0?'—':(od>0?'+':'')}₹${Math.abs(od).toLocaleString('en-IN')}</div>
      </div>
      <!-- Today Bill -->
      <div class="sum-box" style="background:linear-gradient(135deg,rgba(230,81,0,0.08),rgba(245,127,23,0.12))!important;border-color:rgba(245,127,23,0.4)">
        <div class="sum-label" style="color:#bf360c">TODAY BILL</div>
        <div class="sum-value" style="color:#e65100">₹${runningBill.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
      </div>
      <!-- Running Bill -->
      <div class="sum-box" style="background:linear-gradient(135deg,rgba(21,101,192,0.1),rgba(25,118,210,0.15))!important;border-color:rgba(144,202,249,0.6)">
        <div class="sum-label" style="color:#1565c0">🏷️ RUNNING BILL</div>
        <div class="sum-value" style="color:#1565c0">₹${runningBill.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
      </div>
      <!-- Total Bill -->
      <div class="sum-box" style="background:linear-gradient(135deg,rgba(180,83,9,0.1),rgba(217,119,6,0.15))!important;border-color:rgba(252,211,77,0.5)">
        <div class="sum-label" style="color:#92400e">💳 TOTAL BILL</div>
        <div class="sum-value" style="color:#b45309">₹${totalBill.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
      </div>
    </div>

    <!-- Billing Table -->
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th style="text-align:left">Company</th>
          <th>Sold</th><th>Rate</th><th>Total</th>
          ${isS ? '<th>VC</th>' : '<th>PWT</th><th>VC</th>'}
          <th>Bill</th>
        </tr></thead>
        <tbody>
          ${trs}
          <!-- Total Row -->
          <tr class="total-row">
            <td style="font-weight:800;color:#1a237e">↳ Total</td>
            <td>${tSold}</td>
            <td>—</td>
            <td style="color:#1565c0">₹${tAmt.toFixed(2)}</td>
            ${!isS ? `<td style="color:#6a1b9a">₹${tPWT.toFixed(2)}</td>` : ''}
            <td style="color:#4a148c">₹${tVC.toFixed(2)}</td>
            <td style="color:#e65100;font-size:14px">Sub:₹${runningBill.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer with signature -->
    <div class="bill-footer">
      <div>
        <div style="font-size:12px;color:#888;margin-bottom:4px">Payment Details</div>
        ${od > 0 ? `<div style="color:#e65100;font-weight:700;font-size:13px">📌 Old Due: +₹${od.toFixed(2)}</div>` : ''}
        ${ct > 0 ? `<div style="color:#bf360c;font-weight:700;font-size:13px">✂️ Cut: +₹${ct.toFixed(2)}</div>` : ''}
        <div style="color:#1565c0;font-weight:800;font-size:15px;margin-top:6px">🏷️ Running Bill: ₹${runningBill.toFixed(2)}</div>
        <div style="background:linear-gradient(135deg,#b45309,#d97706);color:#fff;border-radius:10px;padding:10px 20px;margin-top:10px;font-weight:900;font-size:18px;display:inline-block">
          💳 TOTAL: ₹${totalBill.toFixed(2)}
        </div>
      </div>
      <div style="text-align:right">
        <div class="sig-line">Authorised Signature</div>
        <div class="sig-line" style="margin-top:18px">Customer Signature</div>
      </div>
    </div>

    <div style="text-align:center;padding:10px 0 18px;font-size:11px;color:#aaa">
      🎲 NB Agency — Lottery Billing System &nbsp;•&nbsp; Generated: ${today()}
    </div>
  </div>

  <div class="print-actions">
    <button id="dl-btn" style="background:linear-gradient(135deg,#c62828,#e53935);color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">📄 Download PDF</button>
    <button id="print-btn" style="background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print</button>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
  <script>
  window.onload = function() {
    var btn = document.getElementById('dl-btn');
    btn.onclick = function() {
      btn.style.display='none';
      html2pdf().set({
        margin:[6,6,6,6],
        filename: document.title.replace(/[^a-zA-Z0-9]/g,'_') + '.pdf',
        image:{ type:'jpeg', quality:0.97 },
        html2canvas:{ scale:2, useCORS:true, backgroundColor:'#fff' },
        jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' }
      }).from(document.getElementById('bill-root')).save()
      .then(function(){ btn.style.display='block'; });
    };
    document.getElementById('print-btn').onclick = function() { window.print(); };
  };
  <\/script>
  </body></html>`)
  w.document.close()
}

// ── PART 2+3+4: Beautiful Colorful Report PDF — matches dashboard UI exactly ──
// Uses print-color-adjust:exact so all gradients/colors survive printing.
// ── buildCoTotals — compute company totals for any bill array ────────────────
// Used to generate per-section PDF reports (Seller / Stocker / Stocker7Days)
export const buildCoTotals = (bills) => {
  const t = {}
  COMPANIES.forEach(co => { t[co] = { sold:0, amt:0, pwt:0, vc:0, amtP:0, pwtP:0, vcP:0 } })
  bills.forEach(b => {
    ;(b.rows||[]).forEach(r => {
      const co = r.company; if (!t[co]) return
      t[co].sold += num(r.sold)
      t[co].amtP += Math.round(num(r.sold)*num(r.rate)*100)
      t[co].pwtP += (b.type==='stocker' ? Math.round(num(r.pwt)*100) : 0)
      t[co].vcP  += Math.round(num(r.vc)*100)
    })
  })
  COMPANIES.forEach(co => {
    if (!t[co]) return
    t[co].amt = parseFloat(((t[co].amtP||0)/100).toFixed(2))
    t[co].pwt = parseFloat(((t[co].pwtP||0)/100).toFixed(2))
    t[co].vc  = parseFloat(((t[co].vcP||0) /100).toFixed(2))
  })
  return t
}

// ── REPORT PDF: div-based layout, 3 customers per A4 page ──────────────────
// Uses independent <div class="customer-block"> per customer (not <tr>) so that
// page-break-inside:avoid and page-break-after:always (every 3rd) work reliably.
export const printReportPDF = (bills, coTotals, grandTotal, grandSubtotal, grandOldDue, getCustomerRB, reportTitle = null, fileName = null) => {
  const CO    = ['ML', 'NB', 'Booking']
  const CLR   = { ML:'#1565c0', NB:'#6a1b9a', Booking:'#00695c' }
  const dateStr = today()

  // ── Paise-safe grand totals ───────────────────────────────────────────────
  const grandSold       = CO.reduce((a,co) => a + (coTotals[co]?.sold||0), 0)
  const grandAmt        = parseFloat(CO.reduce((a,co) => a + Math.round((coTotals[co]?.amt||0)*100), 0) / 100).toFixed(2)
  const grandPWT        = parseFloat(CO.reduce((a,co) => a + Math.round((coTotals[co]?.pwt||0)*100), 0) / 100).toFixed(2)
  const grandVC         = parseFloat(CO.reduce((a,co) => a + Math.round((coTotals[co]?.vc||0)*100), 0)  / 100).toFixed(2)
  const grandRunningBill = parseFloat(bills.reduce((a,b) => a + Math.round((b.runningBill??b.subtotal??0)*100), 0) / 100).toFixed(2)
  const nSellers  = bills.filter(b => b.type==='seller').length
  const nStockers = bills.filter(b => b.type==='stocker').length

  // ── Alphabetical sort ────────────────────────────────────────────────────
  const sortedBills = [...bills].sort((a, b) =>
    (a.customerName||'').localeCompare(b.customerName||'', 'en', { sensitivity:'base' })
  )

  // ── Build one <div class="customer-block"> per customer ──────────────────
  // page-break-after:always is applied after every 3rd block via JS after load.
  const customerDivs = sortedBills.map((b, bi) => {
    const isSeller = b.type === 'seller'
    const rb  = b.runningBill ?? b.subtotal ?? 0
    const tb  = b.totalBill  ?? b.finalBill ?? 0
    const od  = num(b.oldDue), ct = num(b.cut)
    const typeClr = isSeller ? '#1565c0' : '#00695c'
    const hdBg    = isSeller ? '#e8eaf6' : '#e0f2f1'

    // Company rows — one row per company
    const coRows = (b.rows||[]).map((r, ri) => {
      const sold  = num(r.sold), rate = num(r.rate), vc = num(r.vc)
      const pwt   = isSeller ? 0 : num(r.pwt)
      const total = parseFloat((Math.round(sold * rate * 100) / 100).toFixed(2))
      const bill  = parseFloat((Math.round((total - pwt - vc) * 100) / 100).toFixed(2))
      const co    = r.company
      const rowBg = ri % 2 === 0 ? '#fff' : '#f5f7ff'
      const hasData = sold > 0
      return `<tr style="background:${rowBg};opacity:${hasData?1:.4}">
        <td style="padding:5px 10px">
          <span style="background:${CLR[co]||'#555'};color:#fff;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">${co}</span>
        </td>
        <td style="padding:5px 10px;text-align:center;font-weight:${hasData?700:400};color:${hasData?'#111':'#ccc'};font-size:12px">${hasData?sold:'—'}</td>
        <td style="padding:5px 10px;text-align:center;color:#666;font-size:12px">₹${rate}</td>
        <td style="padding:5px 10px;color:${hasData?'#1565c0':'#ccc'};font-weight:${hasData?700:400};font-size:12px">₹${total.toFixed(2)}</td>
        <td style="padding:5px 10px;color:${hasData?'#6a1b9a':'#ccc'};font-size:11px">${!isSeller&&pwt>0?`PWT:${pwt} `:''}VC:₹${vc.toFixed(2)}</td>
        <td style="padding:5px 10px;font-weight:700;color:${bill>0?'#c62828':hasData?'#2e7d32':'#ccc'};font-size:12px">₹${bill.toFixed(2)}</td>
      </tr>`
    }).join('')

    // Totals row
    const tSold = (b.rows||[]).reduce((a,r)=>a+num(r.sold),0)
    const tAmt  = parseFloat((b.rows||[]).reduce((a,r)=>a+Math.round(num(r.sold)*num(r.rate)*100)/100,0).toFixed(2))
    const tVC   = parseFloat((b.rows||[]).reduce((a,r)=>a+Math.round(num(r.vc)*100)/100,0).toFixed(2))
    const tPWT  = isSeller ? 0 : parseFloat((b.rows||[]).reduce((a,r)=>a+Math.round(num(r.pwt)*100)/100,0).toFixed(2))
    const sub   = parseFloat((Math.round((tAmt-tPWT-tVC)*100)/100).toFixed(2))

    // Page-break is applied after every 3rd block via JS (see script below)
    return `<div class="customer-block">

      <!-- Customer header bar -->
      <div style="background:${hdBg};border-radius:8px 8px 0 0;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-bottom:2px solid #ddd">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-weight:900;font-size:13px;color:#888;min-width:22px">${bi+1}</span>
          <div>
            <div style="font-weight:800;font-size:13px;color:#1a237e">${b.customerName||'—'}</div>
            <div style="font-size:10px;color:#666;margin-top:2px">📞 ${b.phone||'N/A'} &nbsp;•&nbsp; 📅 ${b.date}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="background:${typeClr};color:#fff;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700">${b.type}</span>
          ${od>0?`<span style="background:#fff3e0;color:#e65100;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600">+OD ₹${od.toFixed(2)}</span>`:''}
          ${ct>0?`<span style="background:#ffe8d6;color:#bf360c;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600">+Cut ₹${ct.toFixed(2)}</span>`:''}
          <!-- Running Bill -->
          <div style="background:#e3f2fd;border:1.5px solid #90caf9;border-radius:7px;padding:4px 10px;text-align:right;min-width:100px">
            <div style="font-size:9px;color:#1565c0;font-weight:700">🏷️ RUNNING BILL</div>
            <div style="font-weight:900;font-size:13px;color:#1565c0">₹${rb.toFixed(2)}</div>
          </div>
          <!-- Total Bill -->
          <div style="background:${tb>0?'#ffebee':'#e8f5e9'};border:1.5px solid ${tb>0?'#ffcdd2':'#c8e6c9'};border-radius:7px;padding:4px 10px;text-align:right;min-width:100px">
            <div style="font-size:9px;color:${tb>0?'#c62828':'#2e7d32'};font-weight:700">💳 TOTAL BILL</div>
            <div style="font-weight:900;font-size:13px;color:${tb>0?'#b71c1c':'#2e7d32'}">₹${tb.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <!-- Company table -->
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:linear-gradient(135deg,#1a237e,#3949ab)">
            <th style="padding:6px 10px;color:#fff;font-size:10px;font-weight:700;text-align:left">Company</th>
            <th style="padding:6px 10px;color:#fff;font-size:10px;font-weight:700;text-align:center">Sold</th>
            <th style="padding:6px 10px;color:#fff;font-size:10px;font-weight:700;text-align:center">Rate</th>
            <th style="padding:6px 10px;color:#fff;font-size:10px;font-weight:700;text-align:left">Total</th>
            <th style="padding:6px 10px;color:#fff;font-size:10px;font-weight:700;text-align:left">VC${isSeller?'':'/PWT'}</th>
            <th style="padding:6px 10px;color:#fff;font-size:10px;font-weight:700;text-align:left">Bill</th>
          </tr>
        </thead>
        <tbody>
          ${coRows}
          <!-- Summary row -->
          <tr style="background:#f0f4ff;border-top:1px dashed #c5cae9">
            <td style="padding:5px 10px;font-size:10px;color:#888;font-style:italic">↳ Total</td>
            <td style="padding:5px 10px;text-align:center;font-weight:700;color:#333;font-size:12px">${tSold}</td>
            <td></td>
            <td style="padding:5px 10px;color:#1565c0;font-weight:700;font-size:12px">₹${tAmt.toFixed(2)}</td>
            <td style="padding:5px 10px;font-size:10px;color:#6a1b9a">VC:₹${tVC.toFixed(2)}${!isSeller&&tPWT>0?` PWT:${tPWT}`:''}</td>
            <td style="padding:5px 10px;font-weight:800;color:#e65100;font-size:12px">Sub:₹${sub.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

    </div>`
  }).join('')

  // ── Company footer rows ─────────────────────────────────────────────────
  const coFooterRows = CO.map((co, i) => {
    const v   = coTotals[co] || {}
    const net = parseFloat((Math.round(((v.amt||0)-(v.pwt||0)-(v.vc||0))*100)/100).toFixed(2))
    return `<tr style="background:${i%2===0?'#fff':'#f8f9ff'}">
      <td style="padding:10px 14px"><span style="background:${CLR[co]};color:#fff;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:800">${co}</span></td>
      <td style="padding:10px 14px;text-align:right;font-weight:900;font-size:14px">${v.sold||0}</td>
      <td style="padding:10px 14px;text-align:right;color:#1565c0;font-weight:700">₹${(v.amt||0).toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:right;color:#6a1b9a">${(v.pwt||0)>0?`₹${v.pwt.toFixed(2)}`:'—'}</td>
      <td style="padding:10px 14px;text-align:right;color:#4a148c">₹${(v.vc||0).toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:right;font-weight:900;font-size:13px;color:${net>0?'#c62828':'#2e7d32'}">₹${net.toFixed(2)}</td>
    </tr>`
  }).join('')

  const w = window.open('', '_blank')
  if (!w) { alert('Allow popups to print.'); return }

  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>Lottery Billing Report — ${dateStr}</title>
<style>
/* ── Base ── */
*{box-sizing:border-box;margin:0;padding:0}
html,body{
  font-family:'Segoe UI',Arial,sans-serif;
  background:#f0f4ff;color:#111;font-size:12px;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
  color-adjust:exact !important;
}

/* ── Page wrapper ── */
.wrap{max-width:210mm;margin:0 auto;background:#fff}

/* ── Export buttons (screen only) ── */
.export-btn{display:flex;gap:10px;padding:12px 20px;background:#fff;border-bottom:1px solid #e8eaf6;align-items:center}
.export-btn button{color:#fff;border:none;border-radius:8px;padding:9px 20px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit}
.btn-print{background:linear-gradient(135deg,#1565c0,#1976d2)}
.btn-pdf{background:linear-gradient(135deg,#c62828,#e53935)}
.export-btn span{margin-left:auto;font-size:11px;color:#888}

/* ── Report header ── */
.rpt-header{
  background:linear-gradient(135deg,#1a237e 0%,#283593 40%,#3949ab 70%,#5c6bc0 100%) !important;
  padding:20px 24px;color:#fff;
}
.rpt-title{font-size:24px;font-weight:900;letter-spacing:.5px}
.rpt-sub{font-size:12px;opacity:.75;margin-top:4px}
.rpt-total-lbl{font-size:11px;opacity:.7;text-align:right}
.rpt-total-amt{font-size:26px;font-weight:900;text-align:right;margin-top:2px}
.pills{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.pill{background:rgba(255,255,255,.18) !important;border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:3px 11px;font-size:11px;font-weight:700;color:#fff}
.sg{display:grid;grid-template-columns:repeat(4,1fr);border-radius:8px;margin-top:12px;overflow:hidden;border:1px solid rgba(255,255,255,.2)}
.sg-c{padding:10px 12px;text-align:center;background:rgba(255,255,255,.1) !important;border-right:1px solid rgba(255,255,255,.15)}
.sg-c:last-child{border-right:none}
.sg-l{font-size:9px;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.sg-v{font-size:16px;font-weight:900;color:#fff}

/* ── Bill details section ── */
.bill-section{padding:16px 20px}
.sec-title{font-size:13px;font-weight:800;color:#1a237e;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e8eaf6}

/* ── CUSTOMER BLOCK — key rules for page control ── */
.customer-block{
  border:1px solid #e8eaf6;
  border-radius:10px;
  margin-bottom:12px;
  background:#fff;
  overflow:hidden;
  /* Parts 1+2: contain block, prevent splitting */
  page-break-inside:avoid !important;
  break-inside:avoid !important;
  -webkit-column-break-inside:avoid !important;
}

/* ── Grand summary footer ── */
.rpt-footer{
  background:linear-gradient(135deg,#0d1b4b 0%,#1a237e 50%,#3949ab 100%) !important;
  padding:24px;color:#fff;
  page-break-inside:avoid;
}
.ftr-title{font-size:18px;font-weight:900;margin-bottom:16px}
.co-tbl{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;background:#fff;margin-bottom:18px}
.co-tbl thead th{padding:9px 12px;color:#fff !important;font-weight:700;font-size:11px;text-align:right;background:linear-gradient(135deg,#1a237e,#3949ab) !important}
.co-tbl thead th:first-child{text-align:left}
.co-tbl tfoot td{padding:9px 12px;text-align:right;font-weight:900;font-size:13px;background:#e8eaf6 !important;color:#1a237e;border-top:2px solid #c5cae9}
.co-tbl tfoot td:first-child{text-align:left;color:#1a237e}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.tile{background:rgba(255,255,255,.12) !important;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:12px;text-align:center}
.tile-icon{font-size:18px;margin-bottom:4px}
.tile-lbl{font-size:9px;opacity:.7;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;color:rgba(255,255,255,.8)}
.tile-val{font-size:15px;font-weight:900;color:#fff}
.rb-banner{background:linear-gradient(135deg,#1565c0,#1976d2) !important;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.tb-banner{background:linear-gradient(135deg,#b71c1c,#c62828) !important;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
.banner-lbl{font-size:14px;font-weight:800;color:#fff}
.banner-sub{font-size:10px;color:rgba(255,255,255,.65);margin-top:3px}
.banner-val{font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;white-space:nowrap}
.print-bar{background:#f8f9ff;border-top:1px solid #e8eaf6;padding:8px 20px;display:flex;justify-content:space-between;font-size:10px;color:#888}

/* ── PRINT MEDIA ── */
@media print{
  html,body{
    background:#fff !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
    color-adjust:exact !important;
    width:100% !important;
    margin:0 !important;
  }
  .wrap{
    width:100% !important;
    max-width:none !important;
    margin:0 !important;
    padding:0 !important;
    background:#fff !important;
  }
  .export-btn{display:none !important}
  /* Part 1+2: block containment */
  .customer-block{
    page-break-inside:avoid !important;
    break-inside:avoid !important;
    -webkit-column-break-inside:avoid !important;
    height:auto !important;
    background:#fff !important;
    border:1px solid #e8eaf6 !important;
  }
  /* Part 5: min-height keeps blocks consistent */
  .customer-block{min-height:200px}
  /* Footer never splits */
  .rpt-footer{page-break-inside:avoid !important}
  /* Table headers repeat on new pages */
  thead{display:table-header-group}
  /* Color preservation */
  .rpt-header,.rpt-footer,.rb-banner,.tb-banner,.co-tbl thead,.customer-block thead tr{
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
  }
}
</style></head><body>
<div class="wrap" id="report">

  <!-- Export / print buttons -->
  <div class="export-btn">
    <button class="btn-print" onclick="window.print()">🖨️ Print Report</button>
    <button class="btn-pdf"   onclick="exportPDF()">📄 Download PDF</button>
    <span>Generated: ${dateStr} &nbsp;•&nbsp; ${bills.length} bills &nbsp;•&nbsp; A–Z order</span>
  </div>

  <!-- ── Report header ── -->
  <div class="rpt-header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <div class="rpt-title">🎲 ${reportTitle || 'Lottery Billing Report'}</div>
        <div class="rpt-sub">📅 ${dateStr} &nbsp;•&nbsp; ${bills.length} bill${bills.length!==1?'s':''} &nbsp;•&nbsp; ${nSellers} seller${nSellers!==1?'s':''} &nbsp;•&nbsp; ${nStockers} stocker${nStockers!==1?'s':''}</div>
      </div>
      <div>
        <div class="rpt-total-lbl">Grand Total Bill</div>
        <div class="rpt-total-amt">₹${grandTotal.toFixed(2)}</div>
      </div>
    </div>
    <div class="pills">
      <span class="pill">👥 ${bills.length} Bills</span>
      <span class="pill">✅ ${nSellers} Sellers</span>
      <span class="pill">📦 ${nStockers} Stockers</span>
      <span class="pill">🎟️ ${grandSold} Tickets</span>
      <span class="pill">💰 ₹${grandAmt} Amount</span>
      <span class="pill">🎁 ₹${grandVC} VC</span>
    </div>
    <div class="sg">
      <div class="sg-c"><div class="sg-l">Grand Total</div><div class="sg-v">₹${grandTotal.toFixed(2)}</div></div>
      <div class="sg-c"><div class="sg-l">Subtotal</div><div class="sg-v">₹${grandSubtotal.toFixed(2)}</div></div>
      <div class="sg-c"><div class="sg-l">Old Due</div><div class="sg-v">₹${grandOldDue.toFixed(2)}</div></div>
      <div class="sg-c"><div class="sg-l">🏷️ Running Bill</div><div class="sg-v">₹${grandRunningBill}</div></div>
    </div>
  </div>

  <!-- ── Bill details (div-based, 3 per page) ── -->
  <div class="bill-section">
    <div class="sec-title">📋 Bill Details — ${bills.length} Customers (A–Z)</div>
    ${customerDivs}
  </div>

  <!-- ── Grand footer ── -->
  <div class="rpt-footer">
    <div class="ftr-title">📊 Grand Total Summary</div>

    <table class="co-tbl">
      <thead><tr>
        <th style="text-align:left">Company</th>
        <th>Total Sold</th>
        <th>Total Amount</th>
        <th>Total PWT</th>
        <th>Total VC</th>
        <th>Net Bill</th>
      </tr></thead>
      <tbody>${coFooterRows}</tbody>
      <tfoot><tr>
        <td>TOTAL</td>
        <td style="text-align:right">${grandSold}</td>
        <td style="text-align:right">₹${grandAmt}</td>
        <td style="text-align:right">₹${grandPWT}</td>
        <td style="text-align:right">₹${grandVC}</td>
        <td style="text-align:right;color:#b71c1c">₹${grandTotal.toFixed(2)}</td>
      </tr></tfoot>
    </table>

    <div class="tiles">
      <div class="tile"><div class="tile-icon">📋</div><div class="tile-lbl">Total Bills</div><div class="tile-val">${bills.length}</div></div>
      <div class="tile"><div class="tile-icon">✅</div><div class="tile-lbl">Sellers</div><div class="tile-val">${nSellers}</div></div>
      <div class="tile"><div class="tile-icon">📦</div><div class="tile-lbl">Stockers</div><div class="tile-val">${nStockers}</div></div>
      <div class="tile"><div class="tile-icon">🎟️</div><div class="tile-lbl">Tickets</div><div class="tile-val">${grandSold}</div></div>
      <div class="tile"><div class="tile-icon">💰</div><div class="tile-lbl">Amount</div><div class="tile-val">₹${grandAmt}</div></div>
      <div class="tile"><div class="tile-icon">📊</div><div class="tile-lbl">Subtotal</div><div class="tile-val">₹${grandSubtotal.toFixed(2)}</div></div>
      <div class="tile"><div class="tile-icon">📌</div><div class="tile-lbl">Old Due</div><div class="tile-val">₹${grandOldDue.toFixed(2)}</div></div>
      <div class="tile"><div class="tile-icon">💳</div><div class="tile-lbl">Grand Total</div><div class="tile-val">₹${grandTotal.toFixed(2)}</div></div>
    </div>

    <div class="rb-banner">
      <div>
        <div class="banner-lbl">🏷️ TOTAL RUNNING BILL</div>
        <div class="banner-sub">Sum of all subtotals — before Old Due &amp; Cut</div>
        <div class="banner-sub" style="margin-top:2px">${nSellers} sellers &nbsp;•&nbsp; ${nStockers} stockers &nbsp;•&nbsp; ${grandSold} tickets</div>
      </div>
      <div class="banner-val">₹${grandRunningBill}</div>
    </div>

    <div class="tb-banner">
      <div>
        <div class="banner-lbl">💳 GRAND TOTAL BILL</div>
        <div class="banner-sub">All bills including Old Due &amp; Cut</div>
      </div>
      <div class="banner-val">₹${grandTotal.toFixed(2)}</div>
    </div>
  </div>

  <div class="print-bar">
    <div>🎲 <strong>Lottery Billing System</strong></div>
    <div>Generated: ${dateStr}</div>
    <div>${bills.length} bills &nbsp;•&nbsp; ₹${grandTotal.toFixed(2)} grand total</div>
  </div>
</div>

<!-- Part 3: Force page break after every 3rd customer block -->
<script>
(function applyPageBreaks() {
  const blocks = document.querySelectorAll('.customer-block');
  blocks.forEach(function(block, index) {
    // After 3rd, 6th, 9th… block → force new page
    if ((index + 1) % 3 === 0 && index < blocks.length - 1) {
      block.style.pageBreakAfter = 'always';
      block.style.breakAfter     = 'page';
    }
  });
})();
<\/script>

<!-- Part 6: html2pdf export -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<script>
function exportPDF() {
  const el   = document.getElementById('report');
  const btns = document.querySelector('.export-btn');
  btns.style.display = 'none';

  // Re-apply page breaks so html2canvas captures them correctly
  const blocks = document.querySelectorAll('.customer-block');
  blocks.forEach(function(block, index) {
    if ((index + 1) % 3 === 0 && index < blocks.length - 1) {
      block.style.pageBreakAfter = 'always';
      block.style.breakAfter     = 'page';
    }
  });

  const opt = {
    margin:      [5, 5, 5, 5],
        filename:    (fileName || 'Lottery_Billing_Report') + '_' + dateStr.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
    image:       { type: 'jpeg', quality: 0.97 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,   /* A4 width in px at 96dpi */
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: {
      mode: ['css', 'legacy'],
      avoid: '.customer-block',
    },
  };

  html2pdf().set(opt).from(el).save()
    .then(function() { btns.style.display = 'flex'; });
}

// Auto-download via html2pdf on load (produces text-extractable PDF)
window.onload = function() {
  setTimeout(function() { exportPDF(); }, 600);
};
<\/script>
</body></html>`)
  w.document.close()
}
