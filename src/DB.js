/**
 * DB.js — v7
 *
 * DEFINITIONS (no ambiguity):
 *
 *   finalBill   = Subtotal + Old Due + Cut  (what's owed on THIS specific bill)
 *
 *   runningDue  = Σ(all saved finalBills for this customer)
 *               − Σ(all payments received from this customer)
 *
 *   getLiveRunningDue(id, liveFinalBill):
 *     For a live card where today's bill is NOT yet saved.
 *     = Σ(saved finalBills from PREVIOUS days) - Σ(payments) + liveFinalBill
 *
 *   EXAMPLE:
 *     Day 1 saved bill: ₹25,000 → runningDue = ₹25,000
 *     Day 2 live card:  ₹62,031 → getLiveRunningDue = ₹25,000 + ₹62,031 = ₹87,031
 *     Day 2 after save: runningDue = ₹87,031
 */

const _lsGet = (k, fb) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : fb } catch { return fb } }
const _lsSet = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } }

const IDB_NAME = 'LotteryBillingDB', IDB_VER = 2
const ST_BILLS = 'bills', ST_TXN = 'transactions'
let _idb = null

function openIDB() {
  if (_idb) return Promise.resolve(_idb)
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(ST_BILLS)) {
        const s = db.createObjectStore(ST_BILLS, { keyPath: 'billId' })
        s.createIndex('userId',     'userId',     { unique: false })
        s.createIndex('customerId', 'customerId', { unique: false })
        s.createIndex('date',       'date',       { unique: false })
      }
      if (!db.objectStoreNames.contains(ST_TXN)) {
        const t = db.createObjectStore(ST_TXN, { keyPath: 'txnId' })
        t.createIndex('customerId', 'customerId', { unique: false })
      }
    }
    req.onsuccess = e => { _idb = e.target.result; res(_idb) }
    req.onerror   = () => rej(new Error('IDB open failed'))
  })
}
const idbGetAll  = store      => openIDB().then(db => new Promise((res, rej) => { const req = db.transaction(store,'readonly').objectStore(store).getAll(); req.onsuccess = e => res(e.target.result||[]); req.onerror = rej }))
const idbPut     = (store, o) => openIDB().then(db => new Promise((res, rej) => { const req = db.transaction(store,'readwrite').objectStore(store).put(o); req.onsuccess = res; req.onerror = rej }))
const idbDelete  = (store, k) => openIDB().then(db => new Promise((res, rej) => { const req = db.transaction(store,'readwrite').objectStore(store).delete(k); req.onsuccess = res; req.onerror = rej }))

let _bills = null   // array of all bills
let _txns  = null   // array of all transactions
let _ready = false
const _whenReady = []
export function onBillsReady(fn) { _ready ? fn(_bills) : _whenReady.push(fn) }

// Boot: load from IDB + merge any legacy localStorage bills
;(async () => {
  try {
    const idbBills = await idbGetAll(ST_BILLS)
    const ls1 = _lsGet('lotteryBills', [])
    const ls2 = _lsGet('db_bills', [])
    const seen = new Set(idbBills.map(b => b.billId))
    const extra = [...ls1, ...ls2].filter(b => b?.billId && !seen.has(b.billId))
    for (const b of extra) { try { await idbPut(ST_BILLS, b) } catch {}; seen.add(b.billId) }
    _bills = [...idbBills, ...extra]
    try   { _txns = await idbGetAll(ST_TXN) }
    catch { _txns = _lsGet('lotteryTxns', []) }
  } catch {
    const seen = new Set()
    _bills = [..._lsGet('lotteryBills',[]), ..._lsGet('db_bills',[])].filter(b => {
      if (!b?.billId || seen.has(b.billId)) return false; seen.add(b.billId); return true
    })
    _txns = _lsGet('lotteryTxns', [])
  }
  // Migrate: ensure every saved bill has a stored runningDue
  // Compute in chronological order per customer
  _migrateBillRunningDues()
  _ready = true
  _whenReady.forEach(fn => fn(_bills))
  _whenReady.length = 0
})()

/** Recompute and store runningDue on every bill in chronological order. */
function _migrateBillRunningDues() {
  // Group by customer
  const byCustomer = {}
  for (const b of _bills) {
    if (!b.customerId) continue
    if (!byCustomer[b.customerId]) byCustomer[b.customerId] = []
    byCustomer[b.customerId].push(b)
  }
  for (const cid of Object.keys(byCustomer)) {
    const sorted = byCustomer[cid].slice().sort((a, b) => (a.savedAt||a.date||'').localeCompare(b.savedAt||b.date||''))
    let acc = 0
    const txns = (_txns||[]).filter(t => t.customerId === cid)
    const totalPaid = txns.reduce((a, t) => a + (t.amount||0), 0)
    for (const b of sorted) {
      acc += (b.finalBill||0)
      if (b.runningDue === undefined || b.runningDue === null) {
        b.runningDue = acc - totalPaid  // approximate; gets overwritten on real save
      }
    }
  }
}

// ── Bill queries ─────────────────────────────────────────────────────────────
export const getBills           = ()    => _bills ?? []
export const getBillsByUser     = uid   => getBills().filter(b => b.userId     === uid)
export const getBillsByCustomer = cid   => getBills().filter(b => b.customerId === cid)
export const getBillsForDate    = iso   => getBills().filter(b => (b.date||'') === iso)
export const getBillsToday      = ()    => getBillsForDate(new Date().toISOString().slice(0,10))

export async function saveBill(bill) {
  if (!_bills) _bills = []
  const byId   = _bills.findIndex(x => x.billId === bill.billId)
  const byDate = _bills.findIndex(x => x.customerId === bill.customerId && x.date === bill.date && x.billId !== bill.billId)
  let final = bill
  if      (byId   >= 0) { _bills[byId]   = bill }
  else if (byDate >= 0) { final = { ..._bills[byDate], ...bill, billId: _bills[byDate].billId }; _bills[byDate] = final }
  else                  { _bills.push(bill) }
  try { await idbPut(ST_BILLS, final) } catch {}
  _lsSet('lotteryBills', _bills)
  return true
}

export async function deleteBill(billId) {
  _bills = (_bills ?? []).filter(x => x.billId !== billId)
  try { await idbDelete(ST_BILLS, billId) } catch {}
  _lsSet('lotteryBills', _bills)
}

// ── Running Due ───────────────────────────────────────────────────────────────
// ALWAYS the same formula: Σ(saved finalBills) − Σ(payments)
export function getRunningDue(customerId) {
  const bills = getBillsByCustomer(customerId)
  const txns  = getTransactionsByCustomer(customerId)
  const total = bills.reduce((a, b) => a + (b.finalBill || 0), 0)
  const paid  = txns.reduce( (a, t) => a + (t.amount   || 0), 0)
  return total - paid
}

// For a live (unsaved) card:
//   = previous running due (before today) + liveFinalBill
//
// "previous running due before today" = Σ(finalBills saved on days BEFORE today) − Σ(payments)
// We exclude TODAY's already-saved bill (same customer) so we don't double-count
// when the user edits and resaves within the same day.
export function getLiveRunningDue(customerId, liveFinalBill = 0) {
  const todayStr  = new Date().toISOString().slice(0, 10)  // fresh every call
  const prevBills = getBillsByCustomer(customerId).filter(b => b.date !== todayStr)
  const txns      = getTransactionsByCustomer(customerId)
  const prevTotal = prevBills.reduce((a, b) => a + (b.finalBill || 0), 0)
  const paid      = txns.reduce((a, t) => a + (t.amount || 0), 0)
  const prevDue   = prevTotal - paid        // what was owed BEFORE today
  return prevDue + liveFinalBill            // add today's live bill
}

// Previous balance only (not including any bill from today or after)
export function getPreviousBalance(customerId) {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const prevBills = getBillsByCustomer(customerId).filter(b => b.date < todayStr)
  const txns      = getTransactionsByCustomer(customerId)
  return prevBills.reduce((a, b) => a + (b.finalBill || 0), 0)
       - txns.reduce((a, t) => a + (t.amount || 0), 0)
}

// Legacy aliases — keep old callers working
export const getRunningBill     = getRunningDue
export const getLiveRunningBill = getLiveRunningDue

// ── Transactions ─────────────────────────────────────────────────────────────
export const getTransactions           = ()    => _txns ?? []
export const getTransactionsByCustomer = cid   => getTransactions().filter(t => t.customerId === cid)

export async function saveTransaction(txn) {
  if (!_txns) _txns = []
  const idx = _txns.findIndex(x => x.txnId === txn.txnId)
  if (idx >= 0) { _txns[idx] = txn } else { _txns.push(txn) }
  try { await idbPut(ST_TXN, txn) } catch {}
  _lsSet('lotteryTxns', _txns)
  return true
}

export async function deleteTransaction(txnId) {
  _txns = (_txns ?? []).filter(x => x.txnId !== txnId)
  try { await idbDelete(ST_TXN, txnId) } catch {}
  _lsSet('lotteryTxns', _txns)
}

// ── Per-user card state ───────────────────────────────────────────────────────
export const getSellers  = uid => _lsGet(`db_sellers_${uid}`, [])
export const getStockers = uid => _lsGet(`db_stockers_${uid}`, [])
export const setSellers  = (uid, arr) => _lsSet(`db_sellers_${uid}`, arr)
export const setStockers = (uid, arr) => _lsSet(`db_stockers_${uid}`, arr)

// ── Stocker 7 Days — independent customer list ────────────────────────────────
export const getStockers7 = uid => _lsGet(`db_stockers7_${uid}`, [])
export const setStockers7 = (uid, arr) => _lsSet(`db_stockers7_${uid}`, arr)
export const getMeta     = uid => _lsGet(`db_meta_${uid}`, { sellerLock: false, stockerLock: false, tab: 'seller' })
export const setMeta     = (uid, m) => _lsSet(`db_meta_${uid}`, m)

export const getCustomers = () => _lsGet('db_customers', [])
export const saveCustomer = c => {
  const all = getCustomers()
  const idx = all.findIndex(x => x.id === c.id)
  idx >= 0 ? (all[idx] = { ...all[idx], ...c }) : all.push(c)
  _lsSet('db_customers', all)
}

export const exportAll = () => JSON.stringify({ bills: getBills(), transactions: getTransactions(), exportedAt: new Date().toISOString() }, null, 2)

/**
 * deleteAllData — wipes every record for a user (or ALL users if isAdmin).
 * Clears: bills (IndexedDB + localStorage), transactions, seller/stocker/stocker7
 * customer lists, customer registry, and metadata.
 * DOES NOT delete user accounts.
 */
export async function deleteAllData(userId, isAdmin = false) {
  // ── In-memory wipe ──────────────────────────────────────────────────────
  _bills = []
  _txns  = []

  // ── IndexedDB wipe ──────────────────────────────────────────────────────
  try {
    const db = await openIDB()
    await new Promise((res, rej) => {
      const tx = db.transaction([ST_BILLS, ST_TXN], 'readwrite')
      tx.objectStore(ST_BILLS).clear()
      tx.objectStore(ST_TXN).clear()
      tx.oncomplete = res
      tx.onerror    = rej
    })
  } catch {}

  // ── localStorage wipe — clear all billing keys ─────────────────────────
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    const isBillingKey =
      k === 'lotteryBills'    ||
      k === 'db_bills'        ||
      k === 'lotteryTxns'     ||
      k === 'db_customers'

    // Per-user keys: db_sellers_userId, db_stockers_userId, etc.
    const isUserKey = isAdmin
      ? (k.startsWith('db_sellers_') || k.startsWith('db_stockers_') || k.startsWith('db_stockers7_') || k.startsWith('db_meta_'))
      : (k === `db_sellers_${userId}` || k === `db_stockers_${userId}` || k === `db_stockers7_${userId}` || k === `db_meta_${userId}`)

    if (isBillingKey || isUserKey) keysToRemove.push(k)
  }
  keysToRemove.forEach(k => { try { localStorage.removeItem(k) } catch {} })

  return true
}

export function getBusinessStats(fromDate = null, toDate = null) {
  let bills = getBills()
  if (fromDate) bills = bills.filter(b => b.date >= fromDate)
  if (toDate)   bills = bills.filter(b => b.date <= toDate)
  const totalBilled   = bills.reduce((a, b) => a + (b.finalBill || 0), 0)
  const totalPayments = getTransactions()
    .filter(t => (!fromDate || t.date >= fromDate) && (!toDate || t.date <= toDate))
    .reduce((a, t) => a + (t.amount || 0), 0)
  const dailyMap = {}
  bills.forEach(b => {
    const d = b.date || 'unknown'
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, billed: 0, count: 0 }
    dailyMap[d].sales  += (b.subtotal  || 0)
    dailyMap[d].billed += (b.finalBill || 0)
    dailyMap[d].count  += 1
  })
  const custMap = {}
  bills.forEach(b => {
    if (!b.customerId) return
    if (!custMap[b.customerId]) custMap[b.customerId] = { id: b.customerId, name: b.customerName || '—', totalBilled: 0, billCount: 0 }
    custMap[b.customerId].totalBilled += (b.finalBill || 0)
    custMap[b.customerId].billCount   += 1
  })
  return {
    totalSales: bills.reduce((a, b) => a + (b.subtotal || 0), 0),
    totalBilled, totalPayments, pendingBills: totalBilled - totalPayments,
    sellerCount:  bills.filter(b => b.type === 'seller').length,
    stockerCount: bills.filter(b => b.type === 'stocker').length,
    billCount: bills.length,
    dailyData: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    topCustomers: Object.values(custMap).sort((a, b) => b.totalBilled - a.totalBilled).slice(0, 10),
  }
}
