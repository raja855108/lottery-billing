/**
 * api.js — Auth API layer (Firebase version).
 * ──────────────────────────────────────────────────────────────
 * Now backed by Firebase Auth and Cloud Firestore.
 */

import { initializeApp, deleteApp } from 'firebase/app'
import { auth, db, firebaseConfig } from '../firebase'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore'

const USERS_COL = 'users'

// Helper: NEVER expose password to UI (though Firebase Auth handles passwords separately)
const strip = ({ password, ...u }) => u

// Helper: Map username to email
const toEmail = (u) => u.includes('@') ? u : `${u}@lottery.com`

/** Wait for Auth state to initialize */
const getAuthUser = () => new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe()
    resolve(user)
  })
})

// ── Session ────────────────────────────────────────────────────────────────
/** @returns {{ user, token } | null} */
export async function getSession() {
  const firebaseUser = await getAuthUser()
  if (!firebaseUser) return null

  const userDoc = await getDoc(doc(db, USERS_COL, firebaseUser.uid))
  if (!userDoc.exists() || !userDoc.data().active) return null

  const userData = { id: firebaseUser.uid, ...userDoc.data() }
  return { user: strip(userData), token: await firebaseUser.getIdToken() }
}

// ── Login with Email/Username ──────────────────────────────────────────────
/** @returns {{ user: { id, username, role, displayName }, token: string }} */
export async function login(username, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, toEmail(username), password)
    const firebaseUser = cred.user
    
    const userDoc = await getDoc(doc(db, USERS_COL, firebaseUser.uid))
    if (!userDoc.exists()) throw new Error('User profile not found')
    if (!userDoc.data().active) throw new Error('Account is deactivated')

    const userData = { id: firebaseUser.uid, ...userDoc.data() }
    return { user: strip(userData), token: await firebaseUser.getIdToken() }
  } catch (error) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Invalid username or password')
    }
    throw error
  }
}

// ── Login with Google ──────────────────────────────────────────────────────
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider()
  const cred = await signInWithPopup(auth, provider)
  const firebaseUser = cred.user

  // Check if profile exists; create if not (first time Google login)
  const userRef = doc(db, USERS_COL, firebaseUser.uid)
  const userDoc = await getDoc(userRef)
  
  let userData
  if (!userDoc.exists()) {
    userData = {
      username: firebaseUser.email.split('@')[0],
      displayName: firebaseUser.displayName || firebaseUser.email,
      role: 'user',
      active: true,
      createdAt: serverTimestamp()
    }
    await setDoc(userRef, userData)
  } else {
    userData = userDoc.data()
    if (!userData.active) throw new Error('Account is deactivated')
  }

  return { user: strip({ id: firebaseUser.uid, ...userData }), token: await firebaseUser.getIdToken() }
}

// ── Register New User ──────────────────────────────────────────────────────
export async function register(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid = cred.user.uid
  
  const userData = {
    username: email.split('@')[0],
    displayName: displayName || email,
    role: 'user',
    active: true,
    createdAt: serverTimestamp()
  }
  
  await setDoc(doc(db, USERS_COL, uid), userData)
  return { user: strip({ id: uid, ...userData }), token: await cred.user.getIdToken() }
}

// ── Logout ─────────────────────────────────────────────────────────────────
export async function logout() {
  await signOut(auth)
}

// ── Admin: list all users ──────────────────────────────────────────────────
/** @returns {User[]} */
export async function getUsers() {
  const snap = await getDocs(collection(db, USERS_COL))
  return snap.docs.map(d => strip({ id: d.id, ...d.data() }))
}

// ── Admin: create user (Internal) ──────────────────────────────────────────
export async function createUser(data) {
  const secondaryApp = initializeApp(firebaseConfig, 'Secondary')
  const secondaryAuth = getAuth(secondaryApp)
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, toEmail(data.username), data.password)
    const uid = cred.user.uid
    const userProfile = {
      username: data.username,
      displayName: data.displayName || data.username,
      role: data.role || 'user',
      active: true,
      createdAt: serverTimestamp()
    }
    await setDoc(doc(db, USERS_COL, uid), userProfile)
    await signOut(secondaryAuth)
    await deleteApp(secondaryApp)
    return strip({ id: uid, ...userProfile })
  } catch (err) {
    await deleteApp(secondaryApp)
    if (err.code === 'auth/email-already-in-use') throw new Error(`Username "${data.username}" already exists`)
    throw err
  }
}

// ── Admin: update user ─────────────────────────────────────────────────────
export async function updateUser(id, updates) {
  const { id: _id, password, ...safe } = updates
  await updateDoc(doc(db, USERS_COL, id), safe)
  const updatedDoc = await getDoc(doc(db, USERS_COL, id))
  return strip({ id: updatedDoc.id, ...updatedDoc.data() })
}

// ── Admin: delete user ─────────────────────────────────────────────────────
export async function deleteUser(id) {
  await deleteDoc(doc(db, USERS_COL, id))
}

// ── Change own password ────────────────────────────────────────────────────
export async function changePassword(userId, oldPw, newPw) {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const credential = EmailAuthProvider.credential(user.email, oldPw)
  await reauthenticateWithCredential(user, credential)
  await firebaseUpdatePassword(user, newPw)
}
