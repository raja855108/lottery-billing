/**
 * ProfitDashboard — Profit/Loss Dashboard with Charts
 * Shows: Total Sales, Total Profit, Pending Bills, Payments
 * Charts: Daily, Weekly, Monthly profit
 */
import { useState, useMemo } from 'react'
import * as DB from '../DB.js'
import { fmt, num, todayISO } from '../utils.js'

// Simple chart using SVG (no external dependency needed)
function BarChart({ data, height = 200, color = '#1565c0' }) {
  if (!data || data.length === 0) return <div style={{ textAlign:'center',color:'#bbb',padding:'40px' }}>No data yet</div>
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const barW = Math.max(20, Math.min(60, (500 / data.length) - 4))
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={Math.max(data.length * (barW + 4) + 60, 400)} height={height + 60} style={{ display:'block' }}>
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * height)
          const x = 40 + i * (barW + 4)
          const y = height - barH + 10
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx={4} opacity={0.85}/>
              <text x={x + barW/2} y={height + 26} textAnchor="middle" fontSize={9} fill="#888">
                {d.label?.slice(5) || d.label}
              </text>
              <text x={x + barW/2} y={y - 4} textAnchor="middle" fontSize={9} fill={color} fontWeight="700">
                {d.value > 0 ? '₹' + Math.round(d.value/100) + 'k' : ''}
              </text>
            </g>
          )
        })}
        <line x1={36} y1={10} x2={36} y2={height+10} stroke="#e0e0e0" strokeWidth={1}/>
        <line x1={36} y1={height+10} x2={Math.max(data.length*(barW+4)+60,400)} y2={height+10} stroke="#e0e0e0" strokeWidth={1}/>
      </svg>
    </div>
  )
}

function LineChart({ data, height = 180, color = '#2e7d32' }) {
  if (!data || data.length < 2) return <div style={{ textAlign:'center',color:'#bbb',padding:'40px' }}>Not enough data</div>
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const w = Math.max(400, data.length * 40)
  const pts = data.map((d, i) => {
    const x = 40 + (i / (data.length - 1)) * (w - 60)
    const y = height - (d.value / maxVal) * (height - 20) + 10
    return `${x},${y}`
  }).join(' ')
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={w} height={height + 40} style={{ display:'block' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round"/>
        {data.map((d, i) => {
          const x = 40 + (i / (data.length - 1)) * (w - 60)
          const y = height - (d.value / maxVal) * (height - 20) + 10
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill={color}/>
              <text x={x} y={height + 28} textAnchor="middle" fontSize={9} fill="#888">{d.label?.slice(5)||d.label}</text>
            </g>
          )
        })}
        <line x1={36} y1={10} x2={36} y2={height+10} stroke="#e0e0e0" strokeWidth={1}/>
        <line x1={36} y1={height+10} x2={w} y2={height+10} stroke="#e0e0e0" strokeWidth={1}/>
      </svg>
    </div>
  )
}

function PieChart({ data, size = 180 }) {
  if (!data || data.length === 0) return <div style={{ textAlign:'center',color:'#bbb',padding:'40px' }}>No data</div>
  const total = data.reduce((a, d) => a + d.value, 0)
  if (total === 0) return <div style={{ textAlign:'center',color:'#bbb',padding:'40px' }}>No data</div>
  const cx = size/2, cy = size/2, r = size/2 - 10
  let startAngle = -Math.PI / 2
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    startAngle += angle
    const x2 = cx + r * Math.cos(startAngle)
    const y2 = cy + r * Math.sin(startAngle)
    const large = angle > Math.PI ? 1 : 0
    return { path:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, color:d.color, label:d.label, value:d.value }
  })
  return (
    <div style={{ display:'flex',alignItems:'center',gap:16,flexWrap:'wrap' }}>
      <svg width={size} height={size}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.85}/>)}
        <circle cx={cx} cy={cy} r={r*0.45} fill="white"/>
      </svg>
      <div>
        {slices.map((s, i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6,fontSize:12 }}>
            <div style={{ width:12,height:12,borderRadius:3,background:s.color,flexShrink:0 }}/>
            <span style={{ color:'#555' }}>{s.label}: <b>{fmt(s.value)}</b></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProfitDashboard({ onBack }) {
  const [period, setPeriod] = useState('30') // days

  const { stats, dailyData, weeklyData, monthlyData } = useMemo(() => {
    const toDate   = todayISO()
    const fromDate = new Date(Date.now() - parseInt(period) * 86400000).toISOString().slice(0,10)
    const s = DB.getBusinessStats(fromDate, toDate)

    // Daily data for chart (last 30 days)
    const daily = s.dailyData.slice(-30).map(d => ({ label:d.date, value:d.billed }))

    // Weekly aggregation
    const weekMap = {}
    s.dailyData.forEach(d => {
      const date = new Date(d.date)
      const week = `W${Math.ceil(date.getDate()/7)}-${d.date.slice(0,7)}`
      if (!weekMap[week]) weekMap[week] = { label:week, value:0 }
      weekMap[week].value += d.billed
    })
    const weekly = Object.values(weekMap).slice(-12)

    // Monthly aggregation
    const monthMap = {}
    s.dailyData.forEach(d => {
      const month = d.date.slice(0,7)
      if (!monthMap[month]) monthMap[month] = { label:month, value:0 }
      monthMap[month].value += d.billed
    })
    const monthly = Object.values(monthMap).slice(-12)

    return { stats:s, dailyData:daily, weeklyData:weekly, monthlyData:monthly }
  }, [period])

  const topCustomers = stats.topCustomers || []
  const customers = DB.getCustomers()

  // Customers with high running bills
  const runningBills = customers.map(c => ({
    ...c,
    runningBill: DB.getRunningBill(c.id)
  })).filter(c => c.runningBill > 0).sort((a,b) => b.runningBill - a.runningBill).slice(0,10)

  const Stat = ({ icon, label, val, bg, col, sub }) => (
    <div style={{ flex:1,minWidth:140,background:bg,borderRadius:14,padding:'18px 16px',border:'1px solid rgba(0,0,0,0.06)',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize:24,marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:11,color:'#888',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:.5 }}>{label}</div>
      <div style={{ fontWeight:900,fontSize:20,color:col }}>{val}</div>
      {sub && <div style={{ fontSize:11,color:'#aaa',marginTop:4 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ maxWidth:1100,margin:'0 auto',padding:'20px 16px' }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:24,flexWrap:'wrap' }}>
        <button onClick={onBack} style={{ background:'#455a64',color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontWeight:700,fontSize:13 }}>← Back</button>
        <h2 style={{ fontSize:'1.3em',color:'#1a237e',flex:1,fontWeight:900 }}>📈 Profit / Loss Dashboard</h2>
        <select value={period} onChange={e=>setPeriod(e.target.value)}
          style={{ padding:'8px 12px',borderRadius:8,border:'1.5px solid #ddd',fontSize:13,outline:'none' }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 1 year</option>
        </select>
      </div>

      {/* Stat tiles */}
      <div style={{ display:'flex',gap:12,flexWrap:'wrap',marginBottom:24 }}>
        <Stat icon="💰" label="Total Sales"    val={fmt(stats.totalSales)}    bg="#e8f5e9" col="#1b5e20" sub={`${stats.billCount} bills`}/>
        <Stat icon="🧾" label="Total Billed"   val={fmt(stats.totalBilled)}   bg="#e3f2fd" col="#1565c0" sub={`${stats.sellerCount} sellers`}/>
        <Stat icon="✅" label="Payments Rcvd"  val={fmt(stats.totalPayments)} bg="#e8eaf6" col="#1a237e" sub="all time"/>
        <Stat icon="⏳" label="Pending Bills"  val={fmt(stats.pendingBills)}  bg={stats.pendingBills>0?'#ffebee':'#e8f5e9'} col={stats.pendingBills>0?'#b71c1c':'#1b5e20'} sub="unpaid"/>
        <Stat icon="📦" label="Stockers"       val={stats.stockerCount}        bg="#f3e5f5" col="#6a1b9a" sub="bills"/>
      </div>

      {/* Charts row */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16,marginBottom:24 }}>
        {/* Daily bar chart */}
        <div style={{ background:'#fff',borderRadius:14,padding:'16px',border:'1px solid #e8e8e8',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight:700,fontSize:14,color:'#1a237e',marginBottom:12 }}>📊 Daily Bills</div>
          <BarChart data={dailyData} color="#1565c0"/>
        </div>

        {/* Weekly line chart */}
        <div style={{ background:'#fff',borderRadius:14,padding:'16px',border:'1px solid #e8e8e8',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight:700,fontSize:14,color:'#1b5e20',marginBottom:12 }}>📈 Weekly Trend</div>
          <LineChart data={weeklyData} color="#2e7d32"/>
        </div>

        {/* Monthly bar chart */}
        <div style={{ background:'#fff',borderRadius:14,padding:'16px',border:'1px solid #e8e8e8',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight:700,fontSize:14,color:'#6a1b9a',marginBottom:12 }}>📅 Monthly Bills</div>
          <BarChart data={monthlyData} color="#6a1b9a" height={160}/>
        </div>

        {/* Pie chart */}
        <div style={{ background:'#fff',borderRadius:14,padding:'16px',border:'1px solid #e8e8e8',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight:700,fontSize:14,color:'#e65100',marginBottom:12 }}>🥧 Bill Distribution</div>
          <PieChart data={[
            { label:'Sellers',  value: stats.totalBilled * (stats.sellerCount  / Math.max(stats.billCount,1)), color:'#1565c0' },
            { label:'Stockers', value: stats.totalBilled * (stats.stockerCount / Math.max(stats.billCount,1)), color:'#00695c' },
            { label:'Pending',  value: stats.pendingBills > 0 ? stats.pendingBills : 0,                         color:'#c62828' },
          ].filter(d => d.value > 0)} size={160}/>
        </div>
      </div>

      {/* Tables */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16,marginBottom:24 }}>

        {/* Top Customers */}
        <div style={{ background:'#fff',borderRadius:14,border:'1px solid #e8e8e8',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ background:'linear-gradient(135deg,#1a237e,#3949ab)',padding:'12px 16px',color:'#fff',fontWeight:700,fontSize:14 }}>
            🏆 Top Customers by Total Billed
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8f9fb' }}>
                  <th style={{ padding:'8px 12px',textAlign:'left',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>#</th>
                  <th style={{ padding:'8px 12px',textAlign:'left',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>Customer</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>Total Billed</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>Bills</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding:'20px',textAlign:'center',color:'#bbb' }}>No data</td></tr>
                ) : topCustomers.map((c,i) => (
                  <tr key={c.id} style={{ background:i%2===0?'#fff':'#f8f9ff',borderBottom:'1px solid #f2f2f2' }}>
                    <td style={{ padding:'8px 12px',fontWeight:700,color:i===0?'#f57f17':i===1?'#9e9e9e':'#bdbdbd' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                    <td style={{ padding:'8px 12px' }}><div style={{ fontWeight:700 }}>{c.name}</div><div style={{ fontSize:11,color:'#aaa' }}>{c.phone}</div></td>
                    <td style={{ padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#1b5e20' }}>{fmt(c.totalBilled)}</td>
                    <td style={{ padding:'8px 12px',textAlign:'right',color:'#888' }}>{c.billCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Highest Running Bills */}
        <div style={{ background:'#fff',borderRadius:14,border:'1px solid #e8e8e8',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ background:'linear-gradient(135deg,#b71c1c,#c62828)',padding:'12px 16px',color:'#fff',fontWeight:700,fontSize:14 }}>
            🔴 Highest Running Bills (Pending)
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8f9fb' }}>
                  <th style={{ padding:'8px 12px',textAlign:'left',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>Customer</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>Running Bill</th>
                </tr>
              </thead>
              <tbody>
                {runningBills.length === 0 ? (
                  <tr><td colSpan={2} style={{ padding:'20px',textAlign:'center',color:'#bbb' }}>All bills settled! 🎉</td></tr>
                ) : runningBills.map((c,i) => (
                  <tr key={c.id} style={{ background:i%2===0?'#fff':'#fff8f8',borderBottom:'1px solid #f2f2f2' }}>
                    <td style={{ padding:'8px 12px' }}><div style={{ fontWeight:700 }}>{c.name||'—'}</div><div style={{ fontSize:11,color:'#aaa' }}>{c.phone||'—'}</div></td>
                    <td style={{ padding:'8px 12px',textAlign:'right',fontWeight:800,color:'#b71c1c',fontSize:15 }}>{fmt(c.runningBill)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Daily Summary Table */}
      <div style={{ background:'#fff',borderRadius:14,border:'1px solid #e8e8e8',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)',marginBottom:24 }}>
        <div style={{ background:'linear-gradient(135deg,#1b5e20,#2e7d32)',padding:'12px 16px',color:'#fff',fontWeight:700,fontSize:14 }}>
          📋 Daily Sales Summary
        </div>
        <div style={{ maxHeight:320,overflowY:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead style={{ position:'sticky',top:0,zIndex:1 }}>
              <tr style={{ background:'#f8f9fb' }}>
                {['Date','Bills','Total Billed'].map(h => (
                  <th key={h} style={{ padding:'9px 12px',textAlign:'left',color:'#555',fontWeight:700,borderBottom:'2px solid #e5e5e5' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.dailyData.length === 0 ? (
                <tr><td colSpan={3} style={{ padding:'20px',textAlign:'center',color:'#bbb' }}>No data</td></tr>
              ) : [...stats.dailyData].reverse().map((d, i) => (
                <tr key={d.date} style={{ background:i%2===0?'#fff':'#f8f9ff',borderBottom:'1px solid #f2f2f2' }}>
                  <td style={{ padding:'9px 12px',fontWeight:600 }}>{d.date}</td>
                  <td style={{ padding:'9px 12px',textAlign:'center',color:'#888' }}>{d.count}</td>
                  <td style={{ padding:'9px 12px',fontWeight:700,color:'#1b5e20' }}>{fmt(d.billed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
