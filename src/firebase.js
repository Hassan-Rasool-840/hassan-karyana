// ─────────────────────────────────────────────────────────────────────────────
// STEP: Paste your Firebase config here
// Get it from: Firebase Console → Your Project → Project Settings → Your Apps
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBpEm8iHeBQXK5LJJ9Etfq1PVwg7H7rmfw",
  authDomain: "hassan-karyana-abaad.firebaseapp.com",
  projectId: "hassan-karyana-abaad",
  storageBucket: "hassan-karyana-abaad.firebasestorage.app",
  messagingSenderId: "306931903406",
  appId: "1:306931903406:web:086a7f96024162e379763f"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);





// ── Firestore helpers ─────────────────────────────────────────────────────────

// Read a single document (store config, etc.)
export async function fbGet(docPath) {
  try {
    const snap = await getDoc(doc(db, ...docPath.split("/")));
    return snap.exists() ? snap.data().value : null;
  } catch(e) { console.warn("fbGet failed", e); return null; }
}

// Write a single document
export async function fbSet(docPath, value) {
  try {
    await setDoc(doc(db, ...docPath.split("/")), { value }, { merge: false });
  } catch(e) { console.warn("fbSet failed", e); }
}

// Real-time listener on a document — calls onChange(data) whenever it changes
export function fbListen(docPath, onChange) {
  return onSnapshot(doc(db, ...docPath.split("/")), snap => {
    if (snap.exists()) onChange(snap.data().value);
  });
}

// Add a new order document to the orders collection
export async function fbAddOrder(order) {
  try {
    await addDoc(collection(db, "orders"), { ...order, createdAt: new Date().toISOString() });
  } catch(e) { console.warn("fbAddOrder failed", e); }
}

// Real-time listener on all orders — calls onChange(ordersArray) on any change
export function fbListenOrders(onChange) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
  });
}

// Update order status
export async function fbUpdateOrderStatus(orderId, status) {
  try {
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "orders", orderId), { status });
  } catch(e) { console.warn("fbUpdateOrderStatus failed", e); }
}
