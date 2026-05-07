// ─────────────────────────────────────────────────────────────────────────────
// Paste your Firebase config here
// Firebase Console → Project Settings → Your Apps → firebaseConfig
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp }                                           from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot,
         collection, addDoc, query, orderBy, updateDoc }          from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL }  from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBpEm8iHeBQXK5LJJ9Etfq1PVwg7H7rmfw",
  authDomain: "hassan-karyana-abaad.firebaseapp.com",
  projectId: "hassan-karyana-abaad",
  storageBucket: "hassan-karyana-abaad.firebasestorage.app",
  messagingSenderId: "306931903406",
  appId: "1:306931903406:web:086a7f96024162e379763f"
};

const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);

// ── Firestore ─────────────────────────────────────────────────────────────────

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

// ── Storage image upload ──────────────────────────────────────────────────────
// Uploads a File to /products/ in Firebase Storage.
// onProgress(0-100) called during upload.
// Returns public download URL string.

export function fbUploadImage(file, onProgress) {
  return new Promise((resolve, reject) => {
    const safe = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
    const path = "products/" + Date.now() + "_" + safe;
    const sref = ref(storage, path);
    const task = uploadBytesResumable(sref, file);
    task.on(
      "state_changed",
      snap => onProgress && onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      err  => reject(err),
      ()   => getDownloadURL(task.snapshot.ref).then(resolve).catch(reject)
    );
  });
}
