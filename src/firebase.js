// ─────────────────────────────────────────────────────────────────────────────
// Paste your Firebase config here
// Firebase Console → Project Settings → Your Apps → firebaseConfig
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp }   from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot,
         collection, addDoc, query, orderBy, updateDoc } from "firebase/firestore";

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

export async function fbGet(docPath) {
  try {
    const snap = await getDoc(doc(db, ...docPath.split("/")));
    return snap.exists() ? snap.data().value : null;
  } catch(e) { console.warn("fbGet failed", e); return null; }
}

export async function fbSet(docPath, value) {
  try {
    await setDoc(doc(db, ...docPath.split("/")), { value }, { merge: false });
  } catch(e) { console.warn("fbSet failed", e); }
}

export function fbListen(docPath, onChange) {
  return onSnapshot(doc(db, ...docPath.split("/")), snap => {
    if (snap.exists()) onChange(snap.data().value);
  });
}

export async function fbAddOrder(order) {
  try {
    await addDoc(collection(db, "orders"), { ...order, createdAt: new Date().toISOString() });
  } catch(e) { console.warn("fbAddOrder failed", e); }
}

export function fbListenOrders(onChange) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
  });
}

export async function fbUpdateOrderStatus(orderId, status) {
  try {
    await updateDoc(doc(db, "orders", orderId), { status });
  } catch(e) { console.warn("fbUpdateOrderStatus failed", e); }
}
