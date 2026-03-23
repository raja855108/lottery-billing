/**
 * DB.js — v8 (Firebase/Firestore version with Full Preload)
 *
 * This version preloads ALL user-specific data into memory on login
 * to maintain compatibility with the synchronous UI state initializers.
 */

import { db } from './firebase'
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'

let _bills = []   
let _txns  = []   
let _sellers = []
let _stockers = []
let _stockers7 = []
let _meta = { sellerLock: false, stockerLock: false, tab: 'seller' }
let _customers = []

let _ready = false
const _whenReady = []

export function onBillsReady(fn) { _ready ? fn(_bills) : _whenReady.push(fn) }

// Boot: Load EVERYTHING from Firestore for this user
export async function initDB(userId) {
  if (!userId) return
  try {
    const [bSnap, tSnap, sSnap, stSnap, st7Snap, mDoc, cSnap] = await Promise.all([
      getDocs(query(collection(db, 'bills'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'transactions'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'sellers'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'stockers'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'stockers7'), where('userId', '==', userId))),
      getDoc(doc(db, 'meta', userId)),
      getDocs(collection(db, 'customers')) // Note: Global or user-specific? Keeping global for now as per original
    ])

    _bills = bSnap.docs.map(d => ({ ...d.data(), billId: d.id }))
    _txns  = tSnap.docs.map(d => ({ ...d.data(), txnId: d.id }))
    _sellers = sSnap.docs.map(d => d.data().list || [])[0] || []
    _stockers = stSnap.docs.map(d => d.data().list || [])[0] || []
    _stockers7 = st7Snap.docs.map(d => d.data().list || [])[0] || []
    _meta = mDoc.exists() ? mDoc.data() : { sellerLock: false, stockerLock: false, tab: 'seller' }
    _customers = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    _migrateBillRunningDues()
    _ready = true
    _whenReady.forEach(fn => fn(_bills))
    _whenReady.length = 0
  } catch (err) {
    console.error("DB Init failed:", err)
    _ready = true
  }
}

function _migrateBillRunningDues() {
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
        b.runningDue = acc - totalPaid  
      }
    }
  }
}

// ── SYNC ACCESSORS (Compatibility) ──────────────────────────────────────────
export const getBills           = ()    => _bills
export const getBillsByUser     = uid   => _bills.filter(b => b.userId === uid)
export const getBillsByCustomer = cid   => _bills.filter(b => b.customerId === cid)
export const getBillsForDate    = iso   => _bills.filter(b => (b.date||'') === iso)
export const getBillsToday      = ()    => getBillsForDate(new Date().toISOString().slice(0,10))

export const getTransactions           = ()    => _txns
export const getTransactionsByCustomer = cid   => _txns.filter(t => t.customerId === cid)

export const getSellers  = uid => _sellers
export const getStockers = uid => _stockers
export const getStockers7 = uid => _stockers7
export const getMeta     = uid => _meta
export const getCustomers = () => _customers

// ── ASYNC MUTATORS ───────────────────────────────────────────────────────────
export async function saveBill(bill) {
  const billId = bill.billId || `bill_${Date.now()}`
  const finalBill = { ...bill, billId, updatedAt: serverTimestamp() }
  const idx = _bills.findIndex(x => x.billId === billId)
  if (idx >= 0) _bills[idx] = finalBill; else _bills.push(finalBill)
  await setDoc(doc(db, 'bills', billId), finalBill)
  return true
}

export async function deleteBill(billId) {
  _bills = _bills.filter(x => x.billId !== billId)
  await deleteDoc(doc(db, 'bills', billId))
}

export async function saveTransaction(txn) {
  const txnId = txn.txnId || `txn_${Date.now()}`
  const finalTxn = { ...txn, txnId, updatedAt: serverTimestamp() }
  const idx = _txns.findIndex(x => x.txnId === txnId)
  if (idx >= 0) _txns[idx] = finalTxn; else _txns.push(finalTxn)
  await setDoc(doc(db, 'transactions', txnId), finalTxn)
  return true
}

export async function deleteTransaction(txnId) {
  _txns = _txns.filter(x => x.txnId !== txnId)
  await deleteDoc(doc(db, 'transactions', txnId))
}

export async function setSellers(uid, arr) {
  _sellers = arr
  await setDoc(doc(db, 'sellers', uid), { userId: uid, list: arr, updatedAt: serverTimestamp() })
}

export async function setStockers(uid, arr) {
  _stockers = arr
  await setDoc(doc(db, 'stockers', uid), { userId: uid, list: arr, updatedAt: serverTimestamp() })
}

export async function setStockers7(uid, arr) {
  _stockers7 = arr
  await setDoc(doc(db, 'stockers7', uid), { userId: uid, list: arr, updatedAt: serverTimestamp() })
}

export async function setMeta(uid, m) {
  _meta = m
  await setDoc(doc(db, 'meta', uid), { ...m, userId: uid, updatedAt: serverTimestamp() })
}

export async function saveCustomer(c) {
  const idx = _customers.findIndex(x => x.id === c.id)
  if (idx >= 0) _customers[idx] = c; else _customers.push(c)
  await setDoc(doc(db, 'customers', c.id), { ...c, updatedAt: serverTimestamp() })
}

// ── CALC HELPERS (Keep sync) ────────────────────────────────────────────────
export function getRunningDue(customerId) {
  const bills = getBillsByCustomer(customerId)
  const txns  = getTransactionsByCustomer(customerId)
  return bills.reduce((a, b) => a + (b.finalBill || 0), 0) - txns.reduce((a, t) => a + (t.amount || 0), 0)
}

export function getLiveRunningDue(customerId, liveFinalBill = 0) {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const prevBills = getBillsByCustomer(customerId).filter(b => b.date !== todayStr)
  const txns      = getTransactionsByCustomer(customerId)
  return (prevBills.reduce((a, b) => a + (b.finalBill || 0), 0) - txns.reduce((a, t) => a + (t.amount || 0), 0)) + liveFinalBill
}

export function getPreviousBalance(customerId) {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const prevBills = getBillsByCustomer(customerId).filter(b => b.date < todayStr)
  const txns      = getTransactionsByCustomer(customerId)
  return prevBills.reduce((a, b) => a + (b.finalBill || 0), 0) - txns.reduce((a, t) => a + (t.amount || 0), 0)
}

export const getRunningBill     = getRunningDue
export const getLiveRunningBill = getLiveRunningDue
export const exportAll = () => JSON.stringify({ bills: _bills, transactions: _txns, exportedAt: new Date().toISOString() }, null, 2)

export async function deleteAllData(userId, isAdmin = false) {
  const batch = writeBatch(db)
  const bills = await getDocs(query(collection(db, 'bills'), where('userId', '==', userId)))
  bills.forEach(d => batch.delete(d.ref))
  const txns = await getDocs(query(collection(db, 'transactions'), where('userId', '==', userId)))
  txns.forEach(d => batch.delete(d.ref))
  
  // Also delete user cards if needed, but usually we just wipe bills/txns
  await batch.commit()
  
  _bills = []; _txns = []; _sellers = []; _stockers = []; _stockers7 = []; _meta = { sellerLock: false, stockerLock: false, tab: 'seller' }
  return true
}

export function getBusinessStats(fromDate = null, toDate = null) {
  let bills = _bills
  if (fromDate) bills = bills.filter(b => b.date >= fromDate)
  if (toDate)   bills = bills.filter(b => b.date <= toDate)
  const totalBilled   = bills.reduce((a, b) => a + (b.finalBill || 0), 0)
  const totalPayments = _txns
    .filter(t => (!fromDate || t.date >= fromDate) && (!toDate || t.date <= toDate))
    .reduce((a, t) => a + (t.amount || 0), 0)
  const dailyMap = {}
  bills.forEach(b => {
    const d = b.date || 'unknown'
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, billed: 0, count: 0 }
    dailyMap[d].sales  += (b.subtotal  || 0); dailyMap[d].billed += (b.finalBill || 0); dailyMap[d].count  += 1
  })
  const custMap = {}
  bills.forEach(b => {
    if (!b.customerId) return
    if (!custMap[b.customerId]) custMap[b.customerId] = { id: b.customerId, name: b.customerName || '—', totalBilled: 0, billCount: 0 }
    custMap[b.customerId].totalBilled += (b.finalBill || 0); custMap[b.customerId].billCount += 1
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
