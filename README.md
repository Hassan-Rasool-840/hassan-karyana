# Hassan Karyana Store — Deployment Guide
## Live in ~15 minutes with free Firebase + Vercel

---

## STEP 1 — Create Firebase Project (5 mins)

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it `hassan-karyana` → Continue → Continue → Create
3. Once created, click the **web icon </>** to add a web app
4. Give it nickname `hassan-karyana-web` → click **Register app**
5. You'll see a config block like this — **copy it**:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "hassan-karyana.firebaseapp.com",
  projectId: "hassan-karyana-xxxxx",
  storageBucket: "hassan-karyana-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. Open `src/firebase.js` and **replace** the placeholder values with your real values

---

## STEP 2 — Set up Firestore Database (2 mins)

1. In Firebase Console left menu → **Firestore Database** → **Create database**
2. Choose **Start in test mode** → Next → select any location → **Enable**
3. Done! The app will auto-create the collections it needs on first run.

> ⚠️ Test mode expires after 30 days. Before it expires, go to Firestore → Rules and paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /config/{doc} {
      allow read: if true;
      allow write: if true;
    }
    match /orders/{doc} {
      allow read, write: if true;
    }
  }
}
```

---

## STEP 3 — Deploy to Vercel (5 mins)

### Option A: Drag & Drop (easiest, no Git needed)

1. Go to https://vercel.com → Sign up free (use Google or GitHub)
2. Click **"Add New Project"** → **"Browse"** or drag your project folder
3. Vercel auto-detects Vite → just click **Deploy**
4. ✅ Your site is live at `your-project.vercel.app` in ~60 seconds!

### Option B: Via GitHub (better for updates)

1. Create account at https://github.com
2. Click **New Repository** → name `hassan-karyana` → Create
3. Upload all your files (drag & drop on the repo page)
4. Go to https://vercel.com → **New Project** → Import from GitHub
5. Select `hassan-karyana` → **Deploy**

---

## STEP 4 — Test it

1. Open your live URL
2. Add items to cart, place a test order
3. Open **Admin Panel** → Orders — you should see the order appear **instantly** 🔥
4. Open the same admin URL on your phone — order is there too!

---

## Optional: Custom Domain

1. Buy `hassankaryana.pk` from https://domains.pk (~Rs. 2,000/year)
2. In Vercel dashboard → Your project → **Settings → Domains**
3. Add your domain → follow the DNS instructions (takes ~10 mins)

---

## File Structure

```
hassan-karyana/
├── index.html          ← HTML entry point
├── package.json        ← Dependencies
├── vite.config.js      ← Build config
└── src/
    ├── main.jsx        ← React entry
    ├── firebase.js     ← 🔥 Firebase config (PASTE YOUR KEYS HERE)
    └── App.jsx         ← Full store app
```

---

## How Firebase Sync Works

| What               | Where stored         | Who sees it          |
|--------------------|----------------------|----------------------|
| Store catalog      | Firestore (shared)   | Everyone             |
| Deals & tickers    | Firestore (shared)   | Everyone             |
| New orders         | Firestore (shared)   | All admin devices    |
| Saved orders       | localStorage         | That device only     |

**Admin on phone:** Just open your live URL on your phone, tap Admin, login.
New orders appear instantly without refreshing — Firebase pushes them in real time.

---

## Admin Password
Default: `hassan123`
Change it in Admin → Settings → Security (saves to Firebase instantly )
