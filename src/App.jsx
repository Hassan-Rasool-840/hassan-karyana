import { useState, useEffect, useRef } from "react";
import { fbGet, fbSet, fbListen, fbAddOrder, fbListenOrders,
         fbUpdateOrderStatus } from "./firebase.js";

// ── Storage paths ─────────────────────────────────────────────────────────────
const STORE_PATH = "config/store";
const SAVED_LS   = "hk_saved_v5";

// ── Cloudinary image upload ───────────────────────────────────────────────────
// 1. Create free account at cloudinary.com
// 2. Go to Settings → Upload → Upload presets → Add upload preset
//    Set "Signing Mode" to "Unsigned" → Save → copy the preset name
// 3. Find your Cloud Name on the Cloudinary dashboard (top left)
// 4. Paste both below:
const CLOUDINARY_CLOUD_NAME = "PASTE_YOUR_CLOUD_NAME_HERE";
const CLOUDINARY_UPLOAD_PRESET = "PASTE_YOUR_UPLOAD_PRESET_HERE";

async function cloudinaryUpload(file, onProgress) {
  // Resize/compress image before upload to save space and speed up loading
  const compressed = await compressImage(file, 800, 0.82);
  const form = new FormData();
  form.append("file", compressed);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", "hassan-karyana");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        // Use f_auto,q_auto for auto format+quality (loads faster on mobile)
        const url = res.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_600/");
        resolve(url);
      } else {
        reject(new Error("Cloudinary upload failed: " + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

// Compress image client-side before uploading (keeps files small)
function compressImage(file, maxWidth, quality) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob||file), "image/jpeg", quality);
    };
    img.onerror = () => resolve(file); // fallback to original
    img.src = url;
  });
}

function lsGet(k)   { try { const r=localStorage.getItem(k); return r?JSON.parse(r):null; } catch{return null;} }
function lsSet(k,v) { try { localStorage.setItem(k,JSON.stringify(v)); } catch{} }

// ── Seed ──────────────────────────────────────────────────────────────────────
const SEED = {
  pw: "hassan123",
  info: {
    name:"Hassan Karyana Store", urdu:"حسن کریانہ اسٹور",
    owner:"Hassan Rasool", phone:"0317-0500507",
    address:"NW-590 Shop No 4, Moh-Raja Sultan Town, RWP",
    wa:"923170500507", minOrder:500, delFee:100, freeAbove:2000,
    deliveryNote:"Free delivery on orders above Rs. 2000",
  },
  paymentAccounts:[
    {id:1, type:"EasyPaisa", title:"EasyPaisa",     number:"0317-0500507", name:"Hassan Rasool", active:true},
    {id:2, type:"Bank",      title:"Bank Transfer",  number:"1234567890",  name:"Hassan Rasool — MCB Bank", active:true},
  ],
  cats:["Grains & Flour","Cooking Oils","Pulses","Spices","Essentials","Beverages","Snacks","Dairy","Cleaning"],
  items:[
    {id:1,  n:"Basmati Rice",         u:"باسمتی چاول",   c:"Grains & Flour", p:320,unit:"kg",   s:50,e:"🌾",d:"Premium long-grain basmati", t:"rice chawal basmati",     f:true, img:""},
    {id:2,  n:"Sunflower Oil",        u:"سورج مکھی تیل", c:"Cooking Oils",   p:480,unit:"litre",s:30,e:"🫙",d:"Pure sunflower cooking oil", t:"oil tel cooking",         f:true, img:""},
    {id:3,  n:"Refined Sugar",        u:"چینی",           c:"Essentials",     p:150,unit:"kg",   s:80,e:"🍬",d:"Fine white refined sugar",   t:"sugar cheeni shakkar",    f:false,img:""},
    {id:4,  n:"Whole Wheat Flour",    u:"آٹا",            c:"Grains & Flour", p:180,unit:"kg",   s:60,e:"🌾",d:"Fresh chakki atta",          t:"flour atta wheat gandum", f:false,img:""},
    {id:5,  n:"Moong Daal",           u:"مونگ دال",       c:"Pulses",         p:280,unit:"kg",   s:25,e:"🫘",d:"Yellow split moong",         t:"daal moong lentil",       f:false,img:""},
    {id:6,  n:"Chana Daal",           u:"چنا دال",        c:"Pulses",         p:260,unit:"kg",   s:35,e:"🫘",d:"Bengal gram split",          t:"daal chana channa",       f:false,img:""},
    {id:7,  n:"Himalayan Salt",       u:"نمک",            c:"Essentials",     p:40, unit:"pack", s:100,e:"🧂",d:"Natural Himalayan salt",     t:"salt namak",              f:false,img:""},
    {id:8,  n:"Red Chilli Powder",    u:"لال مرچ",        c:"Spices",         p:120,unit:"250g", s:40, e:"🌶️",d:"Pure red chilli powder",   t:"chilli mirch lal",        f:false,img:""},
    {id:9,  n:"Cumin Seeds",          u:"زیرہ",           c:"Spices",         p:90, unit:"100g", s:30, e:"🌿",d:"Whole cumin seeds",          t:"cumin zeera jeera",       f:false,img:""},
    {id:10, n:"Turmeric Powder",      u:"ہلدی",           c:"Spices",         p:80, unit:"100g", s:45, e:"🟡",d:"Pure ground turmeric",       t:"turmeric haldi yellow",   f:false,img:""},
    {id:11, n:"Lipton Tea",           u:"چائے",           c:"Beverages",      p:350,unit:"250g", s:20, e:"🍵",d:"Premium black tea",          t:"tea chai lipton",         f:true, img:""},
    {id:12, n:"Peek Freans Biscuits", u:"بسکٹ",           c:"Snacks",         p:60, unit:"pack", s:50, e:"🍪",d:"Marie / Sooper assorted",    t:"biscuit cookie snack",    f:false,img:""},
  ],
  deals:[
    {id:1,title:"Ramadan Essentials",urdu:"رمضان پیک",   desc:"Basmati 5kg + Oil 2L + Sugar 2kg + Atta 5kg",price:3200,was:3800,on:true,emoji:"🌙",exp:""},
    {id:2,title:"Weekly Bundle",     urdu:"ہفتہ وار سودا",desc:"Atta 10kg + Daal Mix 1kg + Salt + Spices",   price:2400,was:2900,on:true,emoji:"🛒",exp:""},
  ],
  tickers:[
    {id:1,text:"🚚 Free delivery above Rs.2000! | Rs.2000 سے زیادہ پر مفت ڈیلیوری",on:true},
    {id:2,text:"🌾 Fresh Basmati Rice arrived! | تازہ باسمتی چاول کا اسٹاک آگیا",  on:true},
  ],
};

// ── Search ────────────────────────────────────────────────────────────────────
const SYN={
  "چاول":["rice","basmati","chawal"],"تیل":["oil","tel"],"چینی":["sugar","cheeni","shakkar"],
  "آٹا":["flour","atta","wheat","gandum"],"نمک":["salt","namak"],"مرچ":["chilli","mirch","pepper"],
  "زیرہ":["cumin","zeera","jeera"],"ہلدی":["turmeric","haldi"],"چائے":["tea","chai"],
  "دال":["lentil","daal","dal","pulse"],"بسکٹ":["biscuit","cookie","snack"],
  rice:["چاول","basmati"],oil:["تیل"],sugar:["چینی","cheeni"],flour:["آٹا","atta"],
  salt:["نمک"],chilli:["مرچ","mirch"],cumin:["زیرہ","zeera"],turmeric:["ہلدی","haldi"],
  tea:["چائے","chai"],lentil:["دال","daal"],biscuit:["بسکٹ"],
};
function lev(a,b){
  if(Math.abs(a.length-b.length)>2) return 99;
  const R=a.length+1,C=b.length+1,dp=[];
  for(let i=0;i<R;i++){dp[i]=[];for(let j=0;j<C;j++)dp[i][j]=i===0?j:j===0?i:0;}
  for(let i=1;i<R;i++) for(let j=1;j<C;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[a.length][b.length];
}
function doSearch(items,q){
  if(!q||!q.trim()) return items;
  const ql=q.trim().toLowerCase();
  const score=it=>{
    const hay=[it.n,it.u,it.c,it.d,it.t].join(" ").toLowerCase();
    if(hay.includes(ql)) return 100;
    const syns=SYN[ql]||[];
    if(syns.some(s=>hay.includes(s))) return 90;
    for(const[k,vs] of Object.entries(SYN))
      if(vs.some(v=>ql.includes(v)||v.includes(ql))&&hay.includes(k)) return 80;
    const md=hay.split(/\s+/).reduce((m,w)=>Math.min(m,lev(w,ql)),99);
    if(md<=1) return 60; if(md<=2) return 30; return 0;
  };
  return items.map(i=>({i,s:score(i)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.i);
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const GN="#1B5E20",GM="#2E7D32",GOLD="#F9A825",BG="#F1F8E9";
const MUTED="#5D7A62",BDR="#C8E6C9",RED="#C62828",ORG="#E65100";
const SHD="0 2px 16px rgba(27,94,32,0.10)";
const INP={width:"100%",border:"1.5px solid #C8E6C9",borderRadius:10,padding:"10px 14px",
           fontSize:14,fontFamily:"'Nunito',sans-serif",outline:"none",background:"#fff",
           color:"#1C2B1E",boxSizing:"border-box"};
function bs(bg,col,ex){ return Object.assign({background:bg,color:col,border:"none",borderRadius:10,
  padding:"10px 20px",fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif",
  fontSize:14,transition:"opacity .15s"},ex||{}); }

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD BUTTON — reusable, shows progress bar, preview thumbnail
// ─────────────────────────────────────────────────────────────────────────────
function ImgUpload({ currentImg, onDone }) {
  const [prog, setProg] = useState(null); // null=idle, 0-100=uploading
  const [err,  setErr]  = useState("");
  const ref2 = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErr("Max 10MB"); return; }
    if (CLOUDINARY_CLOUD_NAME === "PASTE_YOUR_CLOUD_NAME_HERE") {
      setErr("Add Cloudinary keys in App.jsx first"); return;
    }
    setErr(""); setProg(0);
    try {
      const url = await cloudinaryUpload(file, setProg);
      onDone(url);
      setProg(null);
    } catch(ex) {
      setErr("Upload failed — check Cloudinary keys");
      setProg(null);
      console.error(ex);
    }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {/* Thumbnail */}
        <div style={{width:40,height:40,borderRadius:8,border:"1.5px solid #C8E6C9",
                     overflow:"hidden",flexShrink:0,background:BG,
                     display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
          {currentImg
            ? <img src={currentImg} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            : "📷"}
        </div>
        {/* Upload button */}
        <button onClick={()=>ref2.current.click()}
                style={bs(prog!==null?"#B0BEC5":BG,prog!==null?MUTED:GN,
                  {padding:"6px 12px",fontSize:12,borderRadius:8,whiteSpace:"nowrap",
                   cursor:prog!==null?"not-allowed":"pointer"})}>
          {prog!==null ? prog+"%" : currentImg ? "Change" : "Upload"}
        </button>
        <input ref={ref2} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile} />
      </div>
      {/* Progress bar */}
      {prog!==null && (
        <div style={{height:4,borderRadius:2,background:"#C8E6C9",overflow:"hidden"}}>
          <div style={{height:"100%",width:prog+"%",background:GN,transition:"width .2s"}} />
        </div>
      )}
      {err && <div style={{color:RED,fontSize:11}}>{err}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK ADD FORM — add many items fast, one row per item
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_ROW = () => ({key:Date.now()+Math.random(),n:"",u:"",c:"",p:"",unit:"kg",s:"",e:"🛒",d:"",t:"",f:false,img:""});

function BulkAdd({ cats, onAdd, onClose }) {
  const [rows, setRows] = useState([EMPTY_ROW(),EMPTY_ROW(),EMPTY_ROW()]);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const fileRefs = useRef({});

  function setRow(idx, field, val) {
    setRows(r => r.map((x,i) => i===idx ? Object.assign({},x,{[field]:val}) : x));
  }

  function addRow() { setRows(r => [...r, EMPTY_ROW()]); }
  function removeRow(idx) { setRows(r => r.filter((_,i)=>i!==idx)); }

  async function handleImg(idx, file) {
    if (!file) return;
    if (file.size > 10*1024*1024) { alert("Max 10MB per image"); return; }
    if (CLOUDINARY_CLOUD_NAME === "PASTE_YOUR_CLOUD_NAME_HERE") {
      alert("Add Cloudinary keys in App.jsx first"); return;
    }
    setUploadingIdx(idx);
    try {
      const url = await cloudinaryUpload(file, ()=>{});
      setRow(idx, "img", url);
    } catch(e) { alert("Upload failed — check Cloudinary keys"); }
    setUploadingIdx(null);
  }

  function save() {
    const valid = rows.filter(r => r.n.trim() && r.p);
    if (!valid.length) { alert("Add at least one item with a name and price"); return; }
    setSaving(true);
    onAdd(valid);
    setSaving(false);
  }

  return (
    <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:SHD,marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{margin:0,color:GM}}>⚡ Bulk Add — {rows.length} items</h3>
        <button onClick={onClose} style={bs(BG,MUTED,{padding:"6px 14px",fontSize:13})}>Close</button>
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
          <thead>
            <tr style={{background:BG}}>
              {["Img","Name *","اردو","Category","Price ₨ *","Unit","Stock","Emoji","Description","Tags","⭐",""].map((h,i)=>(
                <th key={i} style={{padding:"8px 10px",textAlign:"left",fontSize:11,fontWeight:800,color:GN,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,idx)=>(
              <tr key={row.key} style={{borderTop:"1px solid #C8E6C9",verticalAlign:"middle"}}>
                {/* Image */}
                <td style={{padding:"6px 8px"}}>
                  <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
                    <div style={{width:36,height:36,borderRadius:6,border:"1.5px solid #C8E6C9",overflow:"hidden",
                                 background:BG,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                      {row.img ? <img src={row.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : "📷"}
                    </div>
                    <button onClick={()=>fileRefs.current[idx]?.click()}
                            style={bs(BG,GN,{padding:"3px 8px",fontSize:10,borderRadius:6})}>
                      {uploadingIdx===idx ? "…" : row.img ? "✓" : "Add"}
                    </button>
                    <input type="file" accept="image/*" style={{display:"none"}}
                           ref={el=>fileRefs.current[idx]=el}
                           onChange={e=>handleImg(idx,e.target.files[0])} />
                  </div>
                </td>
                {/* Name */}
                <td style={{padding:"6px 4px"}}><input value={row.n} onChange={e=>setRow(idx,"n",e.target.value)} placeholder="Item name" style={{...INP,minWidth:120,padding:"7px 10px"}}/></td>
                {/* Urdu */}
                <td style={{padding:"6px 4px"}}><input value={row.u} onChange={e=>setRow(idx,"u",e.target.value)} placeholder="اردو" style={{...INP,minWidth:90,padding:"7px 10px",fontFamily:"'Noto Nastaliq Urdu',serif"}}/></td>
                {/* Category */}
                <td style={{padding:"6px 4px"}}>
                  <select value={row.c} onChange={e=>setRow(idx,"c",e.target.value)} style={{...INP,minWidth:110,padding:"7px 10px"}}>
                    <option value="">-- Pick --</option>
                    {cats.map(c=><option key={c}>{c}</option>)}
                  </select>
                </td>
                {/* Price */}
                <td style={{padding:"6px 4px"}}><input type="number" value={row.p} onChange={e=>setRow(idx,"p",e.target.value)} placeholder="0" style={{...INP,width:70,padding:"7px 10px"}}/></td>
                {/* Unit */}
                <td style={{padding:"6px 4px"}}>
                  <select value={row.unit} onChange={e=>setRow(idx,"unit",e.target.value)} style={{...INP,width:80,padding:"7px 8px"}}>
                    {["kg","g","litre","ml","pack","piece","dozen","250g","500g","100g","50g"].map(u=><option key={u}>{u}</option>)}
                  </select>
                </td>
                {/* Stock */}
                <td style={{padding:"6px 4px"}}><input type="number" value={row.s} onChange={e=>setRow(idx,"s",e.target.value)} placeholder="0" style={{...INP,width:60,padding:"7px 10px"}}/></td>
                {/* Emoji */}
                <td style={{padding:"6px 4px"}}><input value={row.e} onChange={e=>setRow(idx,"e",e.target.value)} style={{...INP,width:52,padding:"7px 8px",textAlign:"center"}}/></td>
                {/* Desc */}
                <td style={{padding:"6px 4px"}}><input value={row.d} onChange={e=>setRow(idx,"d",e.target.value)} placeholder="Short description" style={{...INP,minWidth:130,padding:"7px 10px"}}/></td>
                {/* Tags */}
                <td style={{padding:"6px 4px"}}><input value={row.t} onChange={e=>setRow(idx,"t",e.target.value)} placeholder="search tags" style={{...INP,minWidth:110,padding:"7px 10px"}}/></td>
                {/* Featured */}
                <td style={{padding:"6px 8px",textAlign:"center"}}><input type="checkbox" checked={!!row.f} onChange={e=>setRow(idx,"f",e.target.checked)}/></td>
                {/* Remove */}
                <td style={{padding:"6px 4px"}}>
                  <button onClick={()=>removeRow(idx)} style={bs("#FFEBEE",RED,{padding:"4px 8px",fontSize:13,borderRadius:6})}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center"}}>
        <button onClick={addRow} style={bs(BG,GN,{padding:"9px 18px",fontSize:13})}>+ Add Row</button>
        <button onClick={()=>{for(let i=0;i<5;i++) setRows(r=>[...r,EMPTY_ROW()]);}}
                style={bs(BG,MUTED,{padding:"9px 18px",fontSize:13})}>+5 Rows</button>
        <span style={{flex:1,color:MUTED,fontSize:12}}>
          {rows.filter(r=>r.n.trim()&&r.p).length} / {rows.length} rows ready
        </span>
        <button onClick={save} disabled={saving}
                style={bs(GN,"#fff",{padding:"10px 28px",fontSize:15,opacity:saving?0.7:1})}>
          {saving ? "Saving…" : "💾 Save All"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKER
// ─────────────────────────────────────────────────────────────────────────────
function Ticker({tickers}){
  const active=(tickers||[]).filter(t=>t.on);
  if(!active.length) return null;
  const txt=active.map(t=>t.text).join("     ·     ");
  return(
    <div style={{background:GN,color:GOLD,padding:"7px 0",overflow:"hidden",
                 fontSize:13,fontFamily:"'Noto Nastaliq Urdu',serif",whiteSpace:"nowrap"}}>
      <span style={{display:"inline-block",paddingLeft:"100%",animation:"ticker 40s linear infinite"}}>
        {txt}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD
// ─────────────────────────────────────────────────────────────────────────────
function Card({item,onAdd}){
  const [qty,setQty]=useState(1);
  const [flash,setFlash]=useState(false);
  const oos=item.s<=0;
  function add(){ onAdd(item,qty); setFlash(true); setTimeout(()=>setFlash(false),900); }
  return(
    <div style={{background:"#fff",borderRadius:18,border:"1.5px solid "+(flash?"#4CAF50":BDR),
                 boxShadow:SHD,display:"flex",flexDirection:"column",overflow:"hidden",
                 opacity:oos?0.6:1,transition:"transform .2s,box-shadow .2s"}}
         onMouseEnter={e=>{if(!oos){e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(27,94,32,0.18)";}}}
         onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=SHD;}}>
      <div style={{background:"linear-gradient(135deg,#F1F8E9,#DCEDC8)",height:110,display:"flex",
                   alignItems:"center",justifyContent:"center",position:"relative"}}>
        {item.img
          ? <img src={item.img} alt={item.n} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <span style={{fontSize:46}}>{item.e||"🛒"}</span>}
        {item.f&&!oos&&<span style={{position:"absolute",top:7,left:7,background:GOLD,color:"#5D4037",fontSize:9,fontWeight:800,borderRadius:5,padding:"2px 7px"}}>⭐ POPULAR</span>}
        {oos&&<span style={{position:"absolute",top:7,right:7,background:RED,color:"#fff",fontSize:9,fontWeight:800,borderRadius:5,padding:"2px 7px"}}>OUT OF STOCK</span>}
      </div>
      <div style={{padding:"10px 12px",flex:1,display:"flex",flexDirection:"column",gap:4}}>
        <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",textAlign:"right",color:MUTED,fontSize:11}}>{item.u}</div>
        <div style={{fontWeight:800,fontSize:14,color:"#1C2B1E",lineHeight:1.25}}>{item.n}</div>
        <div style={{fontSize:12,color:MUTED,flex:1}}>{item.d}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
          <span style={{fontWeight:900,color:GM,fontSize:17}}>₨{item.p}<span style={{fontSize:11,fontWeight:400,color:MUTED}}>/{item.unit}</span></span>
          <span style={{fontSize:10,fontWeight:700,color:item.s>10?"#388E3C":item.s>0?ORG:RED}}>
            {item.s>10?"✓ In Stock":item.s>0?item.s+" left":"Out"}
          </span>
        </div>
        {!oos&&(
          <div style={{display:"flex",gap:6,marginTop:4}}>
            <div style={{display:"flex",alignItems:"center",border:"1.5px solid #C8E6C9",borderRadius:8,overflow:"hidden"}}>
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={bs(BG,GN,{borderRadius:0,padding:"5px 9px",fontSize:15})}>−</button>
              <span style={{padding:"0 10px",fontWeight:700,fontSize:13}}>{qty}</span>
              <button onClick={()=>setQty(q=>q+1)} style={bs(BG,GN,{borderRadius:0,padding:"5px 9px",fontSize:15})}>+</button>
            </div>
            <button onClick={add} style={bs(flash?"#388E3C":GN,"#fff",{flex:1,fontSize:12,borderRadius:8,padding:"5px 8px"})}>
              {flash?"✓ Added!":"Add"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CART DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function CartDrawer({cart,info,onUpdate,onRemove,onCheckout,onClose}){
  const sub=cart.reduce((s,i)=>s+i.p*i.qty,0);
  const min=info.minOrder||500, free=info.freeAbove||2000, fee=info.delFee||100;
  const del=sub>=free?0:fee, total=sub+del, low=cart.length>0&&sub<min;
  return(
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:Math.min(420,window.innerWidth),
                 background:"#fff",boxShadow:"-4px 0 32px rgba(0,0,0,0.18)",zIndex:1000,
                 display:"flex",flexDirection:"column",animation:"slideIn .28s ease"}}>
      <div style={{background:GN,color:"#fff",padding:"15px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:900,fontSize:17}}>🛒 Cart ({cart.length})</span>
        <button onClick={onClose} style={bs("rgba(255,255,255,0.18)","#fff",{padding:"5px 11px",borderRadius:8})}>✕</button>
      </div>
      {cart.length===0?(
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:MUTED,gap:8}}>
          <span style={{fontSize:52}}>🛒</span><p style={{fontWeight:700,margin:0}}>Cart is empty</p>
          <p style={{fontSize:13,margin:0}}>Start adding items!</p>
        </div>
      ):(
        <>
          <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:9}}>
            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",background:BG,borderRadius:12,padding:"9px 12px"}}>
                <div style={{width:36,height:36,borderRadius:8,overflow:"hidden",flexShrink:0,
                             background:"#DCEDC8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
                  {item.img?<img src={item.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:item.e||"🛒"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.n}</div>
                  <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",fontSize:11,color:MUTED}}>{item.u}</div>
                  <div style={{fontWeight:900,color:GM,fontSize:14}}>₨{item.p*item.qty}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                  <button onClick={()=>onUpdate(item.id,item.qty-1)} style={bs(BDR,GN,{padding:"3px 8px",borderRadius:6,fontSize:13})}>−</button>
                  <span style={{minWidth:20,textAlign:"center",fontWeight:700,fontSize:13}}>{item.qty}</span>
                  <button onClick={()=>onUpdate(item.id,item.qty+1)} style={bs(BDR,GN,{padding:"3px 8px",borderRadius:6,fontSize:13})}>+</button>
                </div>
                <button onClick={()=>onRemove(item.id)} style={{background:"none",border:"none",color:"#EF5350",cursor:"pointer",fontSize:17,padding:"2px 4px"}}>✕</button>
              </div>
            ))}
          </div>
          <div style={{padding:14,borderTop:"2px solid #C8E6C9"}}>
            {low&&<div style={{background:"#FFF3E0",border:"1.5px solid #E65100",borderRadius:10,padding:"9px 12px",marginBottom:10,fontSize:13,color:ORG,fontWeight:700}}>⚠️ Min order Rs.{min} — add Rs.{min-sub} more</div>}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:MUTED,marginBottom:3}}><span>Subtotal</span><span>₨{sub}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:del===0?"#388E3C":MUTED,marginBottom:6}}><span>Delivery</span><span>{del===0?"FREE 🎉":"₨"+del}</span></div>
            {del>0&&sub<free&&<div style={{background:"#FFFDE7",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#5D4037",marginBottom:8}}>Add ₨{free-sub} more for free delivery!</div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:900,fontSize:19,color:GN,marginBottom:12,borderTop:"1px solid #C8E6C9",paddingTop:8}}><span>Total</span><span>₨{total}</span></div>
            <button disabled={low} onClick={()=>!low&&onCheckout(total)}
                    style={bs(low?"#B0BEC5":GN,"#fff",{width:"100%",padding:13,fontSize:15,borderRadius:12,cursor:low?"not-allowed":"pointer"})}>
              {low?"Min order: ₨"+min:"Proceed to Order →"}
            </button>
            {info.wa&&!low&&(
              <a href={"https://wa.me/"+info.wa+"?text="+encodeURIComponent("Hi! Order:\n"+cart.map(i=>"• "+i.n+" ×"+i.qty+" = ₨"+(i.p*i.qty)).join("\n")+"\nTotal: ₨"+total)}
                 target="_blank" rel="noreferrer"
                 style={{display:"block",textAlign:"center",marginTop:10,color:"#25D366",fontWeight:700,fontSize:13,textDecoration:"none"}}>
                💬 Order via WhatsApp
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER FORM
// ─────────────────────────────────────────────────────────────────────────────
function OrderForm({cart,total,info,paymentAccounts,onSubmit,onBack}){
  const activePay = ["Cash on Delivery", ...((paymentAccounts||[]).filter(a=>a.active).map(a=>a.title))];
  const [f,setF]=useState({name:"",phone:"",address:"",area:"",notes:"",pay:"Cash on Delivery"});
  const [err,setErr]=useState({});
  const [sub,setSub]=useState(false);
  const set=(k,v)=>{ setF(p=>Object.assign({},p,{[k]:v})); setErr(p=>Object.assign({},p,{[k]:""})); };

  // The selected payment account details (for bank/easypaisa instructions)
  const selectedAccount = (paymentAccounts||[]).find(a=>a.title===f.pay && a.active);

  async function submit(){
    const e={};
    if(!f.name.trim()) e.name="Name required";
    if(!/^0\d{10}$/.test(f.phone)) e.phone="Valid number (03XX-XXXXXXX)";
    if(!f.address.trim()) e.address="Address required";
    if(Object.keys(e).length){ setErr(e); return; }
    setSub(true);
    await onSubmit(Object.assign({},f,{cart,total,id:Date.now(),status:"Pending",at:new Date().toISOString()}));
    setSub(false);
  }
  const fields=[
    {k:"name",lbl:"Full Name *",ph:"e.g. Ali Ahmed"},
    {k:"phone",lbl:"Phone Number *",ph:"03XX-XXXXXXX"},
    {k:"address",lbl:"Delivery Address *",ph:"House no, street, mohalla…",rows:2},
    {k:"area",lbl:"Area / Sector",ph:"e.g. Raja Sultan Town"},
    {k:"notes",lbl:"Special Instructions",ph:"Substitutions, timing…",rows:2},
  ];
  return(
    <div style={{maxWidth:540,margin:"0 auto",padding:"0 16px 50px"}}>
      <button onClick={onBack} style={bs(BG,GN,{marginBottom:16,padding:"8px 16px"})}>← Back</button>
      <h2 style={{color:GN,marginBottom:4}}>📋 Complete Your Order</h2>
      <p style={{color:MUTED,fontSize:13,marginBottom:18}}>Fill in your details and we'll deliver to you.</p>
      <div style={{background:"#fff",borderRadius:18,padding:22,boxShadow:SHD,display:"flex",flexDirection:"column",gap:14}}>
        {fields.map(({k,lbl,ph,rows})=>(
          <div key={k}>
            <label style={{fontSize:13,fontWeight:700,color:"#1C2B1E",display:"block",marginBottom:4}}>{lbl}</label>
            {rows?<textarea value={f[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} rows={rows} style={INP}/>
                 :<input value={f[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={INP}/>}
            {err[k]&&<div style={{color:RED,fontSize:12,marginTop:3}}>⚠ {err[k]}</div>}
          </div>
        ))}
        <div>
          <label style={{fontSize:13,fontWeight:700,color:"#1C2B1E",display:"block",marginBottom:8}}>Payment Method</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {activePay.map(m=>(
              <label key={m} style={{flex:"1 1 120px",border:"2px solid "+(f.pay===m?GN:BDR),borderRadius:10,
                                     padding:"9px 6px",textAlign:"center",cursor:"pointer",fontSize:12,
                                     fontWeight:f.pay===m?800:500,background:f.pay===m?BG:"#fff",
                                     color:f.pay===m?GN:MUTED,transition:"all .15s",display:"block"}}>
                <input type="radio" style={{display:"none"}} checked={f.pay===m} onChange={()=>set("pay",m)}/>
                {m==="Cash on Delivery"?"💵 Cash on Delivery":m}
              </label>
            ))}
          </div>
          {/* Show account details when bank/easypaisa selected */}
          {selectedAccount && (
            <div style={{background:"#E8F5E9",border:"1.5px solid #A5D6A7",borderRadius:10,padding:"12px 14px",marginTop:10}}>
              <div style={{fontWeight:800,fontSize:13,color:GN,marginBottom:6}}>
                📲 Send payment to:
              </div>
              <div style={{fontSize:14,fontWeight:900,color:"#1C2B1E",letterSpacing:0.5}}>{selectedAccount.number}</div>
              <div style={{fontSize:13,color:MUTED,marginTop:2}}>{selectedAccount.name}</div>
              <div style={{fontSize:12,color:ORG,marginTop:6,fontWeight:600}}>
                ⚠ Send <strong>₨{total}</strong> then place order. Share screenshot on WhatsApp.
              </div>
            </div>
          )}
        </div>
        <div style={{background:BG,borderRadius:12,padding:14}}>
          <div style={{fontWeight:800,color:GN,marginBottom:10}}>Summary — {cart.length} item{cart.length!==1?"s":""}</div>
          {cart.map(i=>(
            <div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#1C2B1E",marginBottom:4}}>
              <span>{i.e} {i.n} × {i.qty}</span><span style={{fontWeight:700}}>₨{i.p*i.qty}</span>
            </div>
          ))}
          <div style={{fontWeight:900,fontSize:19,color:GN,display:"flex",justifyContent:"space-between",marginTop:10,borderTop:"1px solid #C8E6C9",paddingTop:10}}>
            <span>Total</span><span>₨{total}</span>
          </div>
        </div>
        <button onClick={submit} disabled={sub}
                style={bs(GN,"#fff",{padding:14,fontSize:15,borderRadius:12,width:"100%",opacity:sub?0.7:1})}>
          {sub?"Placing order…":"✅ Confirm Order"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS
// ─────────────────────────────────────────────────────────────────────────────
function Success({order,info,onBack,onSave}){
  const [step,setStep]=useState("idle");
  const [nm,setNm]=useState("");
  async function doSave(){ if(!nm.trim())return; await onSave(nm.trim()); setStep("done"); }
  return(
    <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Nunito',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:24,padding:38,textAlign:"center",maxWidth:420,width:"100%",boxShadow:"0 8px 48px rgba(27,94,32,0.15)"}}>
        <div style={{fontSize:66,animation:"bounce .6s ease"}}>✅</div>
        <h1 style={{color:GN,fontFamily:"'Noto Nastaliq Urdu',serif",margin:"8px 0 4px"}}>آرڈر مل گیا!</h1>
        <h2 style={{color:GM,marginTop:0,marginBottom:10}}>Order Confirmed!</h2>
        <p style={{color:MUTED,fontSize:14,margin:"0 0 14px"}}>Thank you <strong>{order.name}</strong>! We'll call you on <strong>{order.phone}</strong>.</p>
        <div style={{background:BG,borderRadius:12,padding:14,marginBottom:16,textAlign:"left"}}>
          <div style={{fontSize:13,color:MUTED}}>Order #{String(order.id).slice(-6)} · {order.pay}</div>
          <div style={{fontWeight:900,color:GN,fontSize:20,marginTop:6}}>Total: ₨{order.total}</div>
        </div>
        {step==="idle"&&<button onClick={()=>setStep("naming")} style={bs("#FFFDE7","#5D4037",{width:"100%",marginBottom:10,border:"1.5px solid #F9A825",padding:11,borderRadius:12})}>💾 Save for quick reorder</button>}
        {step==="naming"&&(
          <div style={{background:"#FFFDE7",borderRadius:12,padding:14,marginBottom:10,textAlign:"left"}}>
            <p style={{fontSize:13,fontWeight:700,color:"#5D4037",margin:"0 0 8px"}}>Name this order:</p>
            <input value={nm} onChange={e=>setNm(e.target.value)} placeholder="e.g. Weekly Groceries" style={Object.assign({},INP,{marginBottom:8})}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={doSave} style={bs(GN,"#fff",{flex:1,padding:9,fontSize:13,borderRadius:9})}>Save</button>
              <button onClick={()=>setStep("idle")} style={bs(BG,MUTED,{padding:9,fontSize:13,borderRadius:9})}>Cancel</button>
            </div>
          </div>
        )}
        {step==="done"&&<div style={{background:"#E8F5E9",borderRadius:10,padding:"8px 12px",marginBottom:10,color:GN,fontSize:13,fontWeight:700}}>✓ Saved! Find it in "Saved Orders".</div>}
        <a href={"https://wa.me/"+(info.wa||"923170500507")+"?text="+encodeURIComponent("Hi! Order #"+String(order.id).slice(-6)+" placed. Please confirm. Total: ₨"+order.total)}
           target="_blank" rel="noreferrer"
           style={{display:"block",background:"#25D366",color:"#fff",padding:"11px 20px",borderRadius:12,textDecoration:"none",fontWeight:800,marginBottom:10,fontSize:14}}>
          💬 Confirm on WhatsApp
        </a>
        <button onClick={onBack} style={bs(BG,GN,{width:"100%",padding:11,borderRadius:12})}>← Continue Shopping</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVED ORDERS
// ─────────────────────────────────────────────────────────────────────────────
function SavedOrders({saved,catalog,onReorder,onDelete,onBack}){
  if(!saved.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:MUTED}}>
      <div style={{fontSize:52}}>📋</div>
      <h3 style={{marginTop:12}}>No saved orders yet</h3>
      <p style={{fontSize:13}}>After placing an order, save it for one-tap reorder.</p>
      <button onClick={onBack} style={bs(GN,"#fff",{marginTop:8})}>← Browse</button>
    </div>
  );
  return(
    <div>
      <h2 style={{color:GN,marginBottom:16}}>📋 Saved Orders</h2>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {saved.map(sv=>{
          const enriched=sv.items.map(si=>{
            const live=catalog.find(c=>c.id===si.id);
            return live?Object.assign({},live,{qty:si.qty}):Object.assign({},si,{qty:si.qty,gone:true});
          });
          const curTotal=enriched.filter(i=>!i.gone).reduce((s,i)=>s+i.p*i.qty,0);
          return(
            <div key={sv.id} style={{background:"#fff",borderRadius:16,padding:18,boxShadow:SHD,border:"1.5px solid #C8E6C9"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>{sv.name}</div>
                  <div style={{color:MUTED,fontSize:12,marginTop:2}}>{new Date(sv.at).toLocaleDateString("en-PK",{day:"numeric",month:"short",year:"numeric"})} · {sv.items.length} items</div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button onClick={()=>onReorder(enriched.filter(i=>!i.gone))} style={bs(GN,"#fff",{padding:"7px 13px",fontSize:13,borderRadius:9})}>🔄 Reorder</button>
                  <button onClick={()=>onDelete(sv.id)} style={bs("#FFEBEE",RED,{padding:"7px 10px",fontSize:13,borderRadius:9})}>✕</button>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                {enriched.map(i=>(
                  <span key={i.id} style={{background:i.gone?"#FFEBEE":BG,border:"1px solid "+(i.gone?"#FFCDD2":BDR),borderRadius:8,padding:"4px 10px",fontSize:12,color:i.gone?RED:"#1C2B1E"}}>
                    {i.e||""} {i.n} ×{i.qty}{i.gone?" (unavailable)":" ₨"+(i.p*i.qty)}
                  </span>
                ))}
              </div>
              <div style={{fontWeight:800,color:GN,fontSize:15}}>Current total: ₨{curTotal}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY RENAME — click name to edit inline
// ─────────────────────────────────────────────────────────────────────────────
function CatRenameField({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  useEffect(()=>setVal(name),[name]);
  function done() {
    setEditing(false);
    if(val.trim() && val.trim()!==name) onRename(val.trim());
    else setVal(name);
  }
  if(editing) return(
    <input value={val} onChange={e=>setVal(e.target.value)} autoFocus
           onBlur={done} onKeyDown={e=>{ if(e.key==="Enter") done(); if(e.key==="Escape"){setVal(name);setEditing(false);} }}
           style={Object.assign({},INP,{flex:1,padding:"6px 10px",fontSize:14,fontWeight:700})}/>
  );
  return(
    <div style={{flex:1,cursor:"pointer"}} onClick={()=>setEditing(true)}
         title="Click to rename">
      <div style={{fontWeight:800,fontSize:14}}>{name}</div>
      <div style={{fontSize:11,color:MUTED}}>✏️ Click to rename</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK REASSIGN — move all items from one category to another
// ─────────────────────────────────────────────────────────────────────────────
function BulkReassign({ cats, onReassign }) {
  const [from, setFrom] = useState("");
  const [to,   setTo]   = useState("");
  return(
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:200}}>
        <label style={{fontSize:13,fontWeight:700,color:MUTED,flexShrink:0}}>From:</label>
        <select value={from} onChange={e=>setFrom(e.target.value)} style={Object.assign({},INP,{flex:1})}>
          <option value="">-- Select --</option>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:200}}>
        <label style={{fontSize:13,fontWeight:700,color:MUTED,flexShrink:0}}>To:</label>
        <select value={to} onChange={e=>setTo(e.target.value)} style={Object.assign({},INP,{flex:1})}>
          <option value="">-- Select --</option>
          {cats.filter(c=>c!==from).map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <button onClick={()=>{
        if(!from||!to){alert("Select both categories");return;}
        if(!window.confirm("Move ALL items from \""+from+"\" to \""+to+"\"?")) return;
        onReassign(from,to);
        setFrom(""); setTo("");
      }} style={bs(GN,"#fff",{padding:"10px 18px",whiteSpace:"nowrap"})}>Move All →</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────
function Admin({store,orders,onSaveStore,onLogout}){
  const [tab,setTab]=useState("catalog"); // start on catalog for bulk adding
  const [st,setSt]=useState(store);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState("");
  const [editId,setEditId]=useState(null);
  const [showBulk,setShowBulk]=useState(false);
  const [catFilter,setCatFilter]=useState("All");
  const [catSearch,setCatSearch]=useState("");
  const [newCat,setNewCat]=useState("");
  const [ndForm,setNdForm]=useState({title:"",urdu:"",desc:"",price:"",was:"",emoji:"🎁",on:true,exp:""});
  const [ntText,setNtText]=useState("");
  const [oSrch,setOSrch]=useState("");
  const [oStat,setOStat]=useState("All");
  const [liveOrders,setLiveOrders]=useState(orders);
  useEffect(()=>setLiveOrders(orders),[orders]);

  function showToast(m){ setToast(m); setTimeout(()=>setToast(""),2500); }

  async function saveStore(d){
    setSaving(true);
    await onSaveStore(d||st);
    setSaving(false); showToast("✓ Saved to Firebase!");
  }
  function upStore(fn){ setSt(prev=>{ const n=fn(prev); saveStore(n); return n; }); }

  function bulkAdd(rows){
    const newItems = rows.map(r=>Object.assign({},r,{id:Date.now()+Math.random(),p:+r.p,s:+r.s||0}));
    upStore(d=>Object.assign({},d,{items:[...d.items,...newItems]}));
    setShowBulk(false);
    showToast(newItems.length+" items added!");
  }

  const STATUSES=["Pending","Confirmed","Preparing","Out for Delivery","Delivered","Cancelled"];
  const SCOL={Pending:"#E65100",Confirmed:"#1565C0",Preparing:"#6A1B9A","Out for Delivery":"#00838F",Delivered:"#2E7D32",Cancelled:RED};
  const pending=liveOrders.filter(o=>o.status==="Pending").length;

  const fOrds=liveOrders.filter(o=>{
    if(oStat!=="All"&&o.status!==oStat) return false;
    if(oSrch&&![o.name,o.phone,String(o.id||o._id)].some(x=>(x||"").toLowerCase().includes(oSrch.toLowerCase()))) return false;
    return true;
  });

  // Filtered catalog view
  const catItems = st.items.filter(it=>{
    if(catFilter!=="All"&&it.c!==catFilter) return false;
    if(catSearch&&![it.n,it.u,it.c].some(x=>(x||"").toLowerCase().includes(catSearch.toLowerCase()))) return false;
    return true;
  });

  const TABS=[
    {id:"orders",  lbl:"🧾 Orders",      badge:pending},
    {id:"catalog", lbl:"📦 Catalog ("+st.items.length+")"},
    {id:"cats",    lbl:"🏷 Categories"},
    {id:"deals",   lbl:"🎁 Deals"},
    {id:"tickers", lbl:"📢 Ticker"},
    {id:"settings",lbl:"⚙️ Settings"},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#F5F5F5",fontFamily:"'Nunito',sans-serif"}}>
      <style>{".atab{padding:12px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;color:#666;white-space:nowrap;}.atab:hover{color:"+GN+"}.atab.on{border-bottom-color:"+GN+";color:"+GN+";font-weight:800;}"}</style>
      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:GN,color:"#fff",borderRadius:12,padding:"10px 24px",fontSize:14,fontWeight:700,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>{toast}</div>}

      <div style={{background:GN,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
        <div>
          <div style={{fontWeight:900,fontSize:18}}>⚙️ Admin Panel</div>
          <div style={{fontSize:11,opacity:0.7}}>🔥 Firebase live sync · {st.info.name}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>saveStore()} style={bs(GOLD,GN,{padding:"7px 14px",fontSize:12})}>{saving?"Syncing…":"💾 Save"}</button>
          <button onClick={onLogout} style={bs("rgba(255,255,255,0.18)","#fff",{padding:"7px 12px",fontSize:12})}>← Store</button>
        </div>
      </div>

      <div style={{background:"#fff",borderBottom:"2px solid #C8E6C9",display:"flex",overflowX:"auto",padding:"0 14px"}}>
        {TABS.map(t=>(
          <button key={t.id} className={"atab"+(tab===t.id?" on":"")} onClick={()=>setTab(t.id)}>
            {t.lbl}{t.badge>0&&<span style={{marginLeft:5,background:RED,color:"#fff",borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:900}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <div style={{padding:20,maxWidth:1200,margin:"0 auto"}}>

        {/* ── ORDERS ── */}
        {tab==="orders"&&(
          <div>
            <h2 style={{color:GN,marginBottom:14}}>Orders — Live 🔥</h2>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {["All","Pending","Confirmed","Preparing","Out for Delivery","Delivered","Cancelled"].map(s=>{
                const cnt=s==="All"?liveOrders.length:liveOrders.filter(o=>o.status===s).length;
                return(
                  <div key={s} onClick={()=>setOStat(s)}
                       style={{background:oStat===s?GN:"#fff",color:oStat===s?"#fff":"#1C2B1E",borderRadius:12,padding:"10px 14px",cursor:"pointer",border:"2px solid "+(oStat===s?GN:BDR),transition:"all .15s",minWidth:80}}>
                    <div style={{fontSize:20,fontWeight:900}}>{cnt}</div>
                    <div style={{fontSize:10,opacity:0.75}}>{s}</div>
                  </div>
                );
              })}
            </div>
            <input value={oSrch} onChange={e=>setOSrch(e.target.value)} placeholder="Search name, phone, ID…" style={Object.assign({},INP,{maxWidth:360,marginBottom:14})}/>
            {!fOrds.length
              ?<div style={{textAlign:"center",padding:48,color:MUTED}}>No orders found</div>
              :fOrds.map(ord=>(
                <div key={ord._id||ord.id} style={{background:"#fff",borderRadius:14,padding:18,marginBottom:12,boxShadow:SHD,borderLeft:"5px solid "+(SCOL[ord.status]||"#ccc")}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,alignItems:"flex-start"}}>
                    <div>
                      <span style={{fontWeight:900,fontSize:16}}>{ord.name}</span>
                      <span style={{marginLeft:8,color:MUTED,fontSize:12}}>#{String(ord.id||"").slice(-6)}</span>
                      <div style={{color:MUTED,fontSize:13,marginTop:2}}>📞 {ord.phone} · {ord.pay}</div>
                      {ord.address&&<div style={{color:MUTED,fontSize:13}}>📍 {ord.address}{ord.area?", "+ord.area:""}</div>}
                      {ord.notes&&<div style={{color:"#795548",fontSize:12,marginTop:2}}>📝 {ord.notes}</div>}
                      <div style={{color:MUTED,fontSize:11,marginTop:2}}>{new Date(ord.at||ord.createdAt||ord.id).toLocaleString("en-PK")}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:7,alignItems:"flex-end"}}>
                      <span style={{background:(SCOL[ord.status]||"#999")+"22",color:SCOL[ord.status]||"#999",fontWeight:800,fontSize:12,borderRadius:8,padding:"3px 12px"}}>{ord.status}</span>
                      <select value={ord.status} onChange={e=>fbUpdateOrderStatus(ord._id,e.target.value)}
                              style={{border:"1.5px solid #C8E6C9",borderRadius:8,padding:"5px 8px",fontSize:12,fontFamily:"'Nunito',sans-serif",outline:"none"}}>
                        {STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{borderTop:"1px solid #C8E6C9",marginTop:12,paddingTop:10}}>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                      {(ord.cart||[]).map((i,idx)=>(
                        <span key={idx} style={{background:BG,borderRadius:7,padding:"3px 9px",fontSize:12}}>
                          {i.e} {i.n} ×{i.qty} — <strong>₨{i.p*i.qty}</strong>
                        </span>
                      ))}
                    </div>
                    <span style={{fontWeight:900,fontSize:17,color:GN}}>Total: ₨{ord.total}</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── CATALOG ── */}
        {tab==="catalog"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
              <h2 style={{color:GN,margin:0}}>Product Catalog ({st.items.length} items)</h2>
              <button onClick={()=>setShowBulk(!showBulk)}
                      style={bs(showBulk?"#FFEBEE":GOLD,showBulk?RED:GN,{padding:"9px 18px",fontSize:14})}>
                {showBulk?"✕ Close Bulk Add":"⚡ Bulk Add Items"}
              </button>
            </div>

            {/* Bulk add panel */}
            {showBulk&&<BulkAdd cats={st.cats} onAdd={bulkAdd} onClose={()=>setShowBulk(false)}/>}

            {/* Single add form */}
            {!showBulk&&(
              <div style={{background:"#fff",borderRadius:16,padding:18,marginBottom:20,boxShadow:SHD}}>
                <h3 style={{color:GM,marginTop:0}}>+ Add Single Product</h3>
                <SingleAddForm cats={st.cats} onAdd={item=>{
                  upStore(d=>Object.assign({},d,{items:[...d.items,item]}));
                  showToast("Product added!");
                }}/>
              </div>
            )}

            {/* Filter bar */}
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <input value={catSearch} onChange={e=>setCatSearch(e.target.value)}
                     placeholder="Search catalog…" style={Object.assign({},INP,{maxWidth:220,padding:"7px 12px"})}/>
              <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={Object.assign({},INP,{width:"auto",padding:"7px 12px"})}>
                <option value="All">All Categories</option>
                {st.cats.map(c=><option key={c}>{c}</option>)}
              </select>
              <span style={{color:MUTED,fontSize:13}}>{catItems.length} showing</span>
            </div>

            {/* Table */}
            <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:SHD}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:BG}}>
                      {["Img","Name","Urdu","Cat","Price","Unit","Stock","⭐",""].map((h,i)=>(
                        <th key={i} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:800,color:GN,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((it,idx)=>{
                      const ed=editId===it.id;
                      const up=(k,v)=>setSt(d=>Object.assign({},d,{items:d.items.map(i=>i.id===it.id?Object.assign({},i,{[k]:v}):i)}));
                      return(
                        <tr key={it.id} style={{borderTop:"1px solid #C8E6C9",background:idx%2===0?"#fff":"#fafff8",verticalAlign:"middle"}}>
                          {/* Image upload */}
                          <td style={{padding:"8px 12px"}}>
                            <ImgUpload currentImg={it.img||""} onDone={url=>{up("img",url);saveStore();}}/>
                          </td>
                          <td style={{padding:"8px 12px"}}>{ed?<input value={it.n} onChange={e=>up("n",e.target.value)} style={Object.assign({},INP,{width:120})}/>:<span style={{fontWeight:700}}>{it.n}</span>}</td>
                          <td style={{padding:"8px 12px",fontFamily:"'Noto Nastaliq Urdu',serif",fontSize:12}}>{ed?<input value={it.u} onChange={e=>up("u",e.target.value)} style={Object.assign({},INP,{width:100,fontFamily:"'Noto Nastaliq Urdu',serif"})}/>:it.u}</td>
                          <td style={{padding:"8px 12px"}}>
                            {ed
                              ? <select value={it.c} onChange={e=>up("c",e.target.value)} style={Object.assign({},INP,{width:130,padding:"5px 8px"})}>
                                  {st.cats.map(c=><option key={c}>{c}</option>)}
                                </select>
                              : <span style={{background:BG,borderRadius:5,padding:"2px 7px",fontSize:11}}>{it.c}</span>
                            }
                          </td>
                          <td style={{padding:"8px 12px"}}>{ed?<input type="number" value={it.p} onChange={e=>up("p",+e.target.value)} style={Object.assign({},INP,{width:80})}/>:<span style={{fontWeight:900,color:GM}}>₨{it.p}</span>}</td>
                          <td style={{padding:"8px 12px",color:MUTED,fontSize:12}}>{it.unit}</td>
                          <td style={{padding:"8px 12px"}}>{ed?<input type="number" value={it.s} onChange={e=>up("s",+e.target.value)} style={Object.assign({},INP,{width:70})}/>:<span style={{fontWeight:700,color:it.s>10?"#388E3C":it.s>0?ORG:RED}}>{it.s}</span>}</td>
                          <td style={{padding:"8px 12px",textAlign:"center"}}><input type="checkbox" checked={!!it.f} onChange={e=>up("f",e.target.checked)}/></td>
                          <td style={{padding:"8px 12px"}}>
                            <div style={{display:"flex",gap:5}}>
                              <button onClick={()=>{if(ed){saveStore();setEditId(null);}else setEditId(it.id);}} style={bs(ed?"#388E3C":BG,ed?"#fff":GN,{padding:"4px 10px",fontSize:11})}>{ed?"✓":"Edit"}</button>
                              <button onClick={()=>{if(!window.confirm("Delete?"))return;upStore(d=>Object.assign({},d,{items:d.items.filter(i=>i.id!==it.id)}));}} style={bs("#FFEBEE",RED,{padding:"4px 10px",fontSize:11})}>Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CATEGORIES ── */}
        {tab==="cats"&&(
          <div>
            <h2 style={{color:GN,marginBottom:4}}>Manage Categories</h2>
            <p style={{color:MUTED,fontSize:13,marginBottom:16}}>Drag ↑↓ to reorder. Order here = order shown in store and admin.</p>

            {/* Add new */}
            <div style={{background:"#fff",borderRadius:14,padding:18,marginBottom:18,boxShadow:SHD}}>
              <div style={{display:"flex",gap:10}}>
                <input value={newCat} onChange={e=>setNewCat(e.target.value)}
                       placeholder="New category name…" style={Object.assign({},INP,{flex:1})}
                       onKeyDown={e=>{if(e.key==="Enter"){const t=newCat.trim();if(!t||st.cats.includes(t)){showToast("Invalid or duplicate");return;}upStore(d=>Object.assign({},d,{cats:[...d.cats,t]}));setNewCat("");showToast("Added!");}}}/>
                <button onClick={()=>{
                  const t=newCat.trim();
                  if(!t||st.cats.includes(t)){showToast("Invalid or duplicate");return;}
                  upStore(d=>Object.assign({},d,{cats:[...d.cats,t]}));
                  setNewCat(""); showToast("Added!");
                }} style={bs(GN,"#fff",{whiteSpace:"nowrap"})}>+ Add</button>
              </div>
            </div>

            {/* Category list with reorder + rename */}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {st.cats.map((cat,idx)=>{
                const cnt=st.items.filter(i=>i.c===cat).length;
                return(
                  <div key={cat} style={{background:"#fff",borderRadius:12,padding:"12px 16px",
                                          boxShadow:SHD,display:"flex",gap:10,alignItems:"center",
                                          border:"1.5px solid #C8E6C9"}}>
                    {/* Position arrows */}
                    <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                      <button
                        disabled={idx===0}
                        onClick={()=>{
                          const c=[...st.cats];
                          [c[idx-1],c[idx]]=[c[idx],c[idx-1]];
                          upStore(d=>Object.assign({},d,{cats:c}));
                        }}
                        style={bs(idx===0?"#f5f5f5":BG,idx===0?"#ccc":GN,{padding:"2px 8px",fontSize:13,borderRadius:6,cursor:idx===0?"default":"pointer"})}>▲</button>
                      <button
                        disabled={idx===st.cats.length-1}
                        onClick={()=>{
                          const c=[...st.cats];
                          [c[idx],c[idx+1]]=[c[idx+1],c[idx]];
                          upStore(d=>Object.assign({},d,{cats:c}));
                        }}
                        style={bs(idx===st.cats.length-1?"#f5f5f5":BG,idx===st.cats.length-1?"#ccc":GN,{padding:"2px 8px",fontSize:13,borderRadius:6,cursor:idx===st.cats.length-1?"default":"pointer"})}>▼</button>
                    </div>

                    {/* Position number */}
                    <div style={{width:24,height:24,borderRadius:"50%",background:BG,
                                 display:"flex",alignItems:"center",justifyContent:"center",
                                 fontSize:11,fontWeight:800,color:GN,flexShrink:0}}>
                      {idx+1}
                    </div>

                    {/* Name — click to rename */}
                    <CatRenameField
                      name={cat}
                      onRename={newName=>{
                        if(!newName.trim()||newName===cat) return;
                        if(st.cats.includes(newName)){showToast("Name already exists");return;}
                        // Update category name AND update all items using this category
                        upStore(d=>Object.assign({},d,{
                          cats: d.cats.map(c=>c===cat?newName:c),
                          items: d.items.map(i=>i.c===cat?Object.assign({},i,{c:newName}):i),
                        }));
                        showToast("Renamed & all items updated!");
                      }}
                    />

                    <div style={{fontSize:12,color:MUTED,flexShrink:0}}>{cnt} item{cnt!==1?"s":""}</div>

                    {/* Delete */}
                    <button onClick={()=>{
                      if(cnt>0){showToast("Move "+cnt+" items to another category first");return;}
                      if(!window.confirm("Delete category \""+cat+"\"?"))return;
                      upStore(d=>Object.assign({},d,{cats:d.cats.filter(c=>c!==cat)}));
                      showToast("Deleted!");
                    }} style={bs("#FFEBEE",RED,{padding:"4px 10px",fontSize:11,flexShrink:0})}>✕ Delete</button>
                  </div>
                );
              })}
            </div>

            {/* Bulk reassign — move all items from one cat to another */}
            <div style={{background:"#fff",borderRadius:14,padding:18,marginTop:20,boxShadow:SHD}}>
              <h3 style={{color:GM,marginTop:0}}>🔄 Move all items between categories</h3>
              <p style={{fontSize:13,color:MUTED,marginTop:0}}>Useful if you want to merge two categories or reorganize.</p>
              <BulkReassign cats={st.cats} onReassign={(from,to)=>{
                upStore(d=>Object.assign({},d,{
                  items:d.items.map(i=>i.c===from?Object.assign({},i,{c:to}):i)
                }));
                showToast("All items moved from "+from+" → "+to);
              }}/>
            </div>
          </div>
        )}

        {/* ── DEALS ── */}
        {tab==="deals"&&(
          <div>
            <h2 style={{color:GN,marginBottom:14}}>DC Deals & Bundles</h2>
            <div style={{background:"#fff",borderRadius:14,padding:18,marginBottom:18,boxShadow:SHD}}>
              <h3 style={{color:GM,marginTop:0}}>+ Add Deal</h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10}}>
                {[["title","Title (English)"],["urdu","عنوان (اردو)"],["desc","Items included"],["price","Deal Price ₨"],["was","Original Price ₨"],["emoji","Emoji"]].map(([k,lbl])=>(
                  <div key={k}><label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>{lbl}</label>
                  <input value={ndForm[k]} onChange={e=>setNdForm(x=>Object.assign({},x,{[k]:e.target.value}))} style={INP}/></div>
                ))}
                <div><label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>Expiry</label>
                <input type="date" value={ndForm.exp} onChange={e=>setNdForm(x=>Object.assign({},x,{exp:e.target.value}))} style={INP}/></div>
              </div>
              <button onClick={()=>{
                if(!ndForm.title||!ndForm.price){showToast("Title & price required");return;}
                upStore(d=>Object.assign({},d,{deals:[...d.deals,Object.assign({},ndForm,{id:Date.now(),price:+ndForm.price,was:+ndForm.was||0,on:true})]}));
                setNdForm({title:"",urdu:"",desc:"",price:"",was:"",emoji:"🎁",on:true,exp:""});
                showToast("Deal added!");
              }} style={bs(GN,"#fff",{marginTop:12,padding:"9px 22px"})}>Add Deal</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {st.deals.map(d=>(
                <div key={d.id} style={{background:"#fff",borderRadius:14,padding:16,boxShadow:SHD,display:"flex",gap:14,alignItems:"center",borderLeft:"5px solid "+(d.on?GOLD:"#ccc")}}>
                  <span style={{fontSize:30,flexShrink:0}}>{d.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:15}}>{d.title}</div>
                    <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",color:MUTED,fontSize:13}}>{d.urdu}</div>
                    <div style={{color:MUTED,fontSize:12,marginTop:3}}>{d.desc}</div>
                    <div style={{display:"flex",gap:8,marginTop:5,alignItems:"center"}}>
                      <span style={{fontWeight:900,color:GM,fontSize:17}}>₨{d.price}</span>
                      {d.was>0&&<><span style={{textDecoration:"line-through",color:"#aaa",fontSize:13}}>₨{d.was}</span>
                      <span style={{background:RED,color:"#fff",fontSize:10,borderRadius:5,padding:"2px 7px",fontWeight:700}}>-{Math.round((1-d.price/d.was)*100)}%</span></>}
                    </div>
                    {d.exp&&<div style={{fontSize:11,color:ORG,marginTop:3}}>⏰ Expires {d.exp}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:7,flexShrink:0}}>
                    <label style={{display:"flex",gap:5,alignItems:"center",fontSize:13,cursor:"pointer",fontWeight:700}}>
                      <input type="checkbox" checked={d.on} onChange={()=>upStore(x=>Object.assign({},x,{deals:x.deals.map(z=>z.id===d.id?Object.assign({},z,{on:!z.on}):z)}))}/>
                      Active
                    </label>
                    <button onClick={()=>{if(!window.confirm("Delete?"))return;upStore(x=>Object.assign({},x,{deals:x.deals.filter(z=>z.id!==d.id)}));}} style={bs("#FFEBEE",RED,{padding:"4px 10px",fontSize:11})}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TICKER ── */}
        {tab==="tickers"&&(
          <div>
            <h2 style={{color:GN,marginBottom:14}}>Announcement Ticker</h2>
            <div style={{background:"#fff",borderRadius:14,padding:18,marginBottom:18,boxShadow:SHD}}>
              <textarea value={ntText} onChange={e=>setNtText(e.target.value)} rows={2} placeholder="Message (English + اردو)…" style={INP}/>
              <button onClick={()=>{
                if(!ntText.trim())return;
                upStore(d=>Object.assign({},d,{tickers:[...d.tickers,{id:Date.now(),text:ntText.trim(),on:true}]}));
                setNtText(""); showToast("Posted!");
              }} style={bs(GN,"#fff",{marginTop:10,padding:"9px 20px"})}>Post</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {st.tickers.map(t=>(
                <div key={t.id} style={{background:"#fff",borderRadius:12,padding:"12px 16px",boxShadow:SHD,display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:18}}>📢</span>
                  <p style={{flex:1,margin:0,fontSize:13,lineHeight:1.6}}>{t.text}</p>
                  <label style={{display:"flex",gap:5,alignItems:"center",fontSize:12,cursor:"pointer",fontWeight:700,flexShrink:0}}>
                    <input type="checkbox" checked={t.on} onChange={()=>upStore(d=>Object.assign({},d,{tickers:d.tickers.map(x=>x.id===t.id?Object.assign({},x,{on:!x.on}):x)}))}/>
                    On
                  </label>
                  <button onClick={()=>upStore(d=>Object.assign({},d,{tickers:d.tickers.filter(x=>x.id!==t.id)}))} style={bs("#FFEBEE",RED,{padding:"4px 9px",fontSize:11})}>Del</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab==="settings"&&(
          <div>
            <h2 style={{color:GN,marginBottom:18}}>Store Settings</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
              <div style={{background:"#fff",borderRadius:16,padding:22,boxShadow:SHD}}>
                <h3 style={{color:GM,marginTop:0}}>Store Info</h3>
                {[["name","Store Name"],["urdu","Urdu Name"],["owner","Owner"],["phone","Phone"],["wa","WhatsApp (with country code)"],["address","Address"],["deliveryNote","Delivery Note"]].map(([k,lbl])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:3}}>{lbl}</label>
                    <input value={st.info[k]||""} onChange={e=>setSt(d=>Object.assign({},d,{info:Object.assign({},d.info,{[k]:e.target.value})}))} style={INP}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div style={{background:"#fff",borderRadius:16,padding:22,boxShadow:SHD}}>
                  <h3 style={{color:GM,marginTop:0}}>Delivery</h3>
                  {[["minOrder","Min Order ₨"],["delFee","Delivery Fee ₨"],["freeAbove","Free Delivery Above ₨"]].map(([k,lbl])=>(
                    <div key={k} style={{marginBottom:12}}>
                      <label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:3}}>{lbl}</label>
                      <input type="number" value={st.info[k]||""} onChange={e=>setSt(d=>Object.assign({},d,{info:Object.assign({},d.info,{[k]:+e.target.value})}))} style={INP}/>
                    </div>
                  ))}
                </div>
                <div style={{background:"#fff",borderRadius:16,padding:22,boxShadow:SHD}}>
                  <h3 style={{color:GM,marginTop:0}}>💳 Payment Accounts</h3>
                  <p style={{fontSize:12,color:MUTED,marginTop:0,marginBottom:12}}>Customers see these on the order form. "Cash on Delivery" is always shown automatically.</p>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                    {(st.paymentAccounts||[]).map(acc=>(
                      <div key={acc.id} style={{display:"flex",gap:10,alignItems:"center",background:BG,borderRadius:10,padding:"10px 12px",border:"1.5px solid "+(acc.active?BDR:"#eee")}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:800,fontSize:13}}>{acc.title}</div>
                          <div style={{fontWeight:700,fontSize:14,color:GN,marginTop:2}}>{acc.number}</div>
                          <div style={{fontSize:12,color:MUTED}}>{acc.name}</div>
                        </div>
                        <label style={{display:"flex",gap:5,alignItems:"center",fontSize:12,cursor:"pointer",fontWeight:700,flexShrink:0}}>
                          <input type="checkbox" checked={acc.active}
                                 onChange={()=>setSt(d=>Object.assign({},d,{paymentAccounts:(d.paymentAccounts||[]).map(a=>a.id===acc.id?Object.assign({},a,{active:!a.active}):a)}))}/>
                          Show
                        </label>
                        <button onClick={()=>setSt(d=>Object.assign({},d,{paymentAccounts:(d.paymentAccounts||[]).filter(a=>a.id!==acc.id)}))}
                                style={bs("#FFEBEE",RED,{padding:"4px 9px",fontSize:11,flexShrink:0})}>✕</button>
                      </div>
                    ))}
                  </div>
                  {/* Add new account */}
                  <AddPaymentAccount onAdd={acc=>setSt(d=>Object.assign({},d,{paymentAccounts:[...(d.paymentAccounts||[]),acc]}))}/>
                </div>
              </div>
            </div>
            {/* Security */}
            <div style={{background:"#fff",borderRadius:16,padding:22,boxShadow:SHD,marginTop:18}}>
              <h3 style={{color:GM,marginTop:0}}>Security</h3>
              <label style={{fontSize:12,fontWeight:700,color:MUTED,display:"block",marginBottom:3}}>Admin Password</label>
              <input type="password" value={st.pw||""} onChange={e=>setSt(d=>Object.assign({},d,{pw:e.target.value}))} style={INP}/>
              <p style={{color:MUTED,fontSize:11,marginTop:6}}>Synced to Firebase — all devices.</p>
            </div>
            <button onClick={()=>saveStore()} style={bs(GN,"#fff",{marginTop:18,padding:"11px 30px",fontSize:15})}>{saving?"Saving…":"💾 Save Settings"}</button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD PAYMENT ACCOUNT FORM
// ─────────────────────────────────────────────────────────────────────────────
function AddPaymentAccount({ onAdd }) {
  const blank = {title:"",number:"",name:"",type:"EasyPaisa",active:true};
  const [form, setForm] = useState(blank);
  const set = (k,v) => setForm(x=>Object.assign({},x,{[k]:v}));
  function save(){
    if(!form.title.trim()||!form.number.trim()){alert("Title and number required");return;}
    onAdd(Object.assign({},form,{id:Date.now()}));
    setForm(blank);
  }
  return(
    <div style={{borderTop:"1.5px solid #C8E6C9",paddingTop:12,marginTop:4}}>
      <div style={{fontSize:13,fontWeight:700,color:GN,marginBottom:8}}>+ Add Account</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>Label (shown to customer)</label>
          <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. EasyPaisa / MCB Bank" style={INP}/>
        </div>
        <div>
          <label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>Account / Phone Number</label>
          <input value={form.number} onChange={e=>set("number",e.target.value)} placeholder="03XX-XXXXXXX or IBAN" style={INP}/>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>Account Holder Name / Bank</label>
          <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Hassan Rasool — MCB Bank" style={INP}/>
        </div>
      </div>
      <button onClick={save} style={bs(GN,"#fff",{padding:"8px 18px",fontSize:13})}>Add Account</button>
    </div>
  );
}
function SingleAddForm({ cats, onAdd }) {
  const blank = {n:"",u:"",c:cats[0]||"",p:"",unit:"kg",s:"",e:"🛒",d:"",t:"",f:false,img:""};
  const [form, setForm] = useState(blank);
  function set(k,v){ setForm(x=>Object.assign({},x,{[k]:v})); }
  function save(){
    if(!form.n||!form.p){alert("Name & price required");return;}
    onAdd(Object.assign({},form,{id:Date.now(),p:+form.p,s:+form.s||0}));
    setForm(blank);
  }
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
        {[["n","Name (English)"],["u","اردو نام"],["p","Price ₨"],["unit","Unit"],["s","Stock"],["e","Emoji"],["d","Description"],["t","Search Tags"]].map(([k,lbl])=>(
          <div key={k}>
            <label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>{lbl}</label>
            <input value={form[k]} onChange={e=>set(k,e.target.value)} style={INP}/>
          </div>
        ))}
        <div>
          <label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>Category</label>
          <select value={form.c} onChange={e=>set("c",e.target.value)} style={INP}>
            {cats.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,color:MUTED,fontWeight:700,display:"block",marginBottom:3}}>Image</label>
          <ImgUpload currentImg={form.img} onDone={url=>set("img",url)}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,paddingTop:18}}>
          <input type="checkbox" id="feat_s" checked={form.f} onChange={e=>set("f",e.target.checked)}/>
          <label htmlFor="feat_s" style={{cursor:"pointer",fontWeight:700,fontSize:13}}>⭐ Featured</label>
        </div>
      </div>
      <button onClick={save} style={bs(GN,"#fff",{marginTop:12,padding:"9px 22px"})}>Add Product</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const [store,  setStore]  = useState(null);
  const [orders, setOrders] = useState([]);
  const [saved,  setSaved]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [cart,    setCart]    = useState([]);
  const [drawer,  setDrawer]  = useState(false);
  const [screen,  setScreen]  = useState("store");
  const [curOrd,  setCurOrd]  = useState(null);
  const [ordTotal,setOrdTotal]= useState(0);
  const [search,  setSearch]  = useState("");
  const [cat,     setCat]     = useState("All");
  const [pw,      setPw]      = useState("");
  const [pwErr,   setPwErr]   = useState(false);

  useEffect(()=>{
    (async()=>{
      const s=await fbGet(STORE_PATH);
      const init=s||SEED;
      if(!s) await fbSet(STORE_PATH,SEED);
      setStore(init);
      setSaved(lsGet(SAVED_LS)||[]);
      setLoading(false);
    })();
    const unsubStore  = fbListen(STORE_PATH, d=>{ if(d) setStore(d); });
    const unsubOrders = fbListenOrders(d=>setOrders(d));
    return ()=>{ unsubStore(); unsubOrders(); };
  },[]);

  const saveStore = async d=>{ setStore(d); await fbSet(STORE_PATH,d); };
  const saveSaved = v=>{ setSaved(v); lsSet(SAVED_LS,v); };

  function addToCart(item,qty){ setCart(c=>{ const x=c.find(i=>i.id===item.id); return x?c.map(i=>i.id===item.id?Object.assign({},i,{qty:i.qty+qty}):i):[...c,Object.assign({},item,{qty})]; }); }
  function updCart(id,qty){ setCart(c=>qty<=0?c.filter(i=>i.id!==id):c.map(i=>i.id===id?Object.assign({},i,{qty}):i)); }
  function rmCart(id){ setCart(c=>c.filter(i=>i.id!==id)); }

  async function submitOrder(od){
    await fbAddOrder(od);
    setCurOrd(od); setCart([]); setDrawer(false); setScreen("success");
  }
  function saveOrder(name){
    if(!curOrd) return;
    const entry={id:Date.now(),name,at:new Date().toISOString(),
                 items:curOrd.cart.map(i=>({id:i.id,qty:i.qty,n:i.n,e:i.e,p:i.p}))};
    saveSaved([...saved,entry]);
  }
  function delSaved(id){ saveSaved(saved.filter(s=>s.id!==id)); }
  function reorder(items){ items.forEach(i=>addToCart(i,i.qty)); setScreen("store"); setTimeout(()=>setDrawer(true),80); }

  const cartCount=cart.reduce((s,i)=>s+i.qty,0);

  if(loading) return(
    <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,fontFamily:"'Nunito',sans-serif"}}>
      <div style={{width:44,height:44,border:"4px solid #C8E6C9",borderTopColor:GN,borderRadius:"50%",animation:"spin .75s linear infinite"}}/>
      <span style={{color:MUTED}}>Loading Hassan Karyana…</span>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  if(screen==="login") return(
    <div style={{minHeight:"100vh",background:GN,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Nunito',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:22,padding:36,width:300,textAlign:"center",boxShadow:"0 16px 64px rgba(0,0,0,0.25)"}}>
        <div style={{fontSize:50}}>🔐</div>
        <h2 style={{color:GN,margin:"8px 0 4px"}}>Admin Login</h2>
        <p style={{color:MUTED,fontSize:12,marginTop:0,marginBottom:16}}>🔥 Firebase synced</p>
        <input type="password" placeholder="Password" value={pw}
               onChange={e=>{setPw(e.target.value);setPwErr(false);}}
               onKeyDown={e=>{ if(e.key==="Enter"){ if(pw===(store&&store.pw||"hassan123"))setScreen("admin"); else setPwErr(true); } }}
               style={Object.assign({},INP,{textAlign:"center",fontSize:15,marginBottom:10})}/>
        {pwErr&&<div style={{color:RED,fontSize:13,marginBottom:8}}>⚠ Wrong password</div>}
        <button onClick={()=>{ if(pw===(store&&store.pw||"hassan123"))setScreen("admin"); else setPwErr(true); }}
                style={bs(GN,"#fff",{width:"100%",padding:12,fontSize:15,marginBottom:8,borderRadius:12})}>Login →</button>
        <button onClick={()=>setScreen("store")} style={{background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:13}}>← Back</button>
      </div>
    </div>
  );

  if(screen==="admin") return <Admin store={store} orders={orders} onSaveStore={saveStore} onLogout={()=>setScreen("store")}/>;
  if(screen==="success") return <Success order={curOrd} info={store.info} onBack={()=>setScreen("store")} onSave={saveOrder}/>;

  const allCats=["All",...(store.cats||[])];
  const base=cat==="All"?store.items:store.items.filter(i=>i.c===cat);
  const shown=search.trim()?doSearch(store.items,search):base;
  const featured=store.items.filter(i=>i.f&&i.s>0);

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Nunito',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Noto+Nastaliq+Urdu&display=swap');
        *{box-sizing:border-box;}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#C8E6C9;border-radius:3px}
        input:focus,textarea:focus,select:focus{border-color:#43A047!important;box-shadow:0 0 0 3px rgba(67,160,71,0.14)!important;}
      `}</style>

      <Ticker tickers={store.tickers}/>

      <header style={{background:GN,color:"#fff",position:"sticky",top:0,zIndex:500,boxShadow:"0 3px 20px rgba(0,0,0,0.22)"}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"10px 14px 8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{flexShrink:0,cursor:"pointer"}} onClick={()=>{setScreen("store");setSearch("");setCat("All");}}>
            <div style={{fontWeight:900,fontSize:17,lineHeight:1.1}}>Hassan Karyana</div>
            <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",fontSize:12,opacity:0.82}}>حسن کریانہ اسٹور</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            {saved.length>0&&<button onClick={()=>setScreen("saved")} style={bs("rgba(255,255,255,0.12)","#fff",{padding:"7px 11px",fontSize:12,borderRadius:9,border:"1px solid rgba(255,255,255,0.22)"})}>📋 {saved.length}</button>}
            <button onClick={()=>setDrawer(true)}
                    style={{background:cartCount>0?GOLD:"rgba(255,255,255,0.12)",color:cartCount>0?GN:"#fff",border:"none",borderRadius:10,padding:"8px 13px",cursor:"pointer",fontWeight:900,fontSize:13,display:"flex",alignItems:"center",gap:5,fontFamily:"'Nunito',sans-serif",transition:"all .2s"}}>
              🛒 {cartCount>0?<span style={{background:GN,color:GOLD,borderRadius:7,padding:"1px 7px",fontSize:11}}>{cartCount}</span>:"Cart"}
            </button>
            <button onClick={()=>setScreen("login")} style={bs("rgba(255,255,255,0.12)","#fff",{padding:"7px 11px",fontSize:12,borderRadius:9,border:"1px solid rgba(255,255,255,0.22)"})}>⚙ Admin</button>
          </div>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 14px 12px",position:"relative"}}>
          <span style={{position:"absolute",left:26,top:"50%",transform:"translateY(-60%)",fontSize:16,pointerEvents:"none"}}>🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setScreen("store");}}
                 placeholder="Search: rice / چاول / daal / tel / mirch…"
                 style={{width:"100%",border:"1.5px solid rgba(255,255,255,0.35)",borderRadius:12,padding:"11px 16px 11px 38px",fontSize:15,outline:"none",background:"rgba(255,255,255,0.15)",color:"#fff",fontFamily:"'Nunito',sans-serif",boxSizing:"border-box"}}/>
        </div>
      </header>

      {drawer&&<div onClick={()=>setDrawer(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:999}}/>}
      {drawer&&<CartDrawer cart={cart} info={store.info} onUpdate={updCart} onRemove={rmCart} onCheckout={tot=>{setOrdTotal(tot);setDrawer(false);setScreen("order");}} onClose={()=>setDrawer(false)}/>}

      {screen==="store"&&(
        <div style={{maxWidth:1280,margin:"0 auto",padding:"20px 14px 60px"}}>
          <div style={{background:"linear-gradient(135deg,#1B5E20 0%,#2E7D32 60%,#66BB6A 100%)",borderRadius:20,padding:"24px 26px",marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-10,top:-18,fontSize:120,opacity:0.07,pointerEvents:"none"}}>🛒</div>
            <div>
              <h1 style={{margin:"0 0 4px",color:"#fff",fontWeight:900,fontSize:26}}>{store.info.name}</h1>
              <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",fontSize:17,color:"rgba(255,255,255,0.82)",marginBottom:6}}>{store.info.urdu}</div>
              <p style={{margin:0,color:"rgba(255,255,255,0.73)",fontSize:13}}>📍 {store.info.address}</p>
              {store.info.deliveryNote&&<p style={{margin:"5px 0 0",color:GOLD,fontSize:12,fontWeight:700}}>🚚 {store.info.deliveryNote}</p>}
            </div>
            <a href={"tel:"+store.info.phone} style={{background:GOLD,color:GN,borderRadius:14,padding:"11px 22px",fontWeight:900,fontSize:15,flexShrink:0,textDecoration:"none",display:"inline-block"}}>📞 {store.info.phone}</a>
          </div>

          {featured.length>0&&!search.trim()&&cat==="All"&&(
            <div style={{marginBottom:22}}>
              <h2 style={{color:GN,marginBottom:10,fontSize:18}}>⭐ Popular Items</h2>
              <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6}}>
                {featured.map(item=>(
                  <div key={item.id} onClick={()=>addToCart(item,1)}
                       style={{background:"#fff",borderRadius:13,padding:"10px 14px",display:"flex",gap:10,alignItems:"center",cursor:"pointer",flexShrink:0,border:"1.5px solid #C8E6C9",boxShadow:SHD,minWidth:180,transition:"background .15s"}}
                       onMouseEnter={e=>e.currentTarget.style.background=BG}
                       onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{width:32,height:32,borderRadius:6,overflow:"hidden",flexShrink:0,background:"#DCEDC8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                      {item.img?<img src={item.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:item.e}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.n}</div>
                      <div style={{fontWeight:900,color:GM,fontSize:13}}>₨{item.p}/{item.unit}</div>
                    </div>
                    <span style={{background:BG,border:"1.5px solid #C8E6C9",borderRadius:7,padding:"4px 8px",fontSize:11,fontWeight:700,color:GN,flexShrink:0}}>+Add</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {store.deals.filter(d=>d.on).length>0&&!search.trim()&&(
            <div style={{marginBottom:22}}>
              <h2 style={{color:GN,marginBottom:10,fontSize:18}}>🎁 Special Deals</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {store.deals.filter(d=>d.on).map(d=>(
                  <div key={d.id} style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)",color:"#fff",borderRadius:16,padding:20,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-10,right:-10,fontSize:66,opacity:0.1}}>{d.emoji}</div>
                    <div style={{fontWeight:900,fontSize:17}}>{d.emoji} {d.title}</div>
                    <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",textAlign:"right",fontSize:13,opacity:0.78,margin:"4px 0 8px"}}>{d.urdu}</div>
                    <div style={{fontSize:13,opacity:0.88,marginBottom:12}}>{d.desc}</div>
                    {d.exp&&<div style={{fontSize:11,color:GOLD,marginBottom:8}}>⏰ Ends {d.exp}</div>}
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{background:GOLD,color:GN,fontWeight:900,fontSize:20,borderRadius:9,padding:"4px 12px"}}>₨{d.price}</span>
                      {d.was>0&&<><span style={{textDecoration:"line-through",opacity:0.55,fontSize:13}}>₨{d.was}</span><span style={{background:RED,color:"#fff",fontSize:10,borderRadius:5,padding:"2px 7px",fontWeight:700}}>-{Math.round((1-d.price/d.was)*100)}%</span></>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
            {allCats.map(c=>(
              <button key={c} onClick={()=>{setCat(c);setSearch("");}}
                      style={{background:cat===c&&!search.trim()?GN:"#fff",color:cat===c&&!search.trim()?"#fff":MUTED,border:"2px solid "+(cat===c&&!search.trim()?GN:BDR),borderRadius:22,padding:"6px 16px",cursor:"pointer",whiteSpace:"nowrap",fontSize:13,fontWeight:cat===c&&!search.trim()?800:600,fontFamily:"'Nunito',sans-serif",transition:"all .15s"}}>
                {c}
              </button>
            ))}
          </div>

          <div style={{color:MUTED,fontSize:12,marginBottom:12}}>
            {shown.length} item{shown.length!==1?"s":""}{search.trim()?" for \""+search+"\"":cat!=="All"?" in "+cat:""}
          </div>

          {shown.length===0
            ?<div style={{textAlign:"center",padding:"52px 20px",color:MUTED}}>
               <div style={{fontSize:54}}>🔍</div>
               <h3 style={{marginTop:12,marginBottom:6}}>No items found</h3>
               <p style={{fontSize:13}}>Try Urdu or English, check spelling</p>
               <button onClick={()=>{setSearch("");setCat("All");}} style={bs(GN,"#fff",{marginTop:10})}>Show All</button>
             </div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(186px,1fr))",gap:14}}>
               {shown.map(item=><Card key={item.id} item={item} onAdd={addToCart}/>)}
             </div>
          }
        </div>
      )}

      {screen==="order"&&(
        <div style={{maxWidth:1280,margin:"0 auto",padding:"22px 14px 60px"}}>
          <OrderForm cart={cart} total={ordTotal} info={store.info} paymentAccounts={store.paymentAccounts||[]} onSubmit={submitOrder} onBack={()=>{setDrawer(true);setScreen("store");}}/>
        </div>
      )}

      {screen==="saved"&&(
        <div style={{maxWidth:860,margin:"0 auto",padding:"22px 14px 60px"}}>
          <button onClick={()=>setScreen("store")} style={bs(BG,GN,{marginBottom:16,padding:"8px 16px"})}>← Store</button>
          <SavedOrders saved={saved} catalog={store.items} onReorder={reorder} onDelete={delSaved} onBack={()=>setScreen("store")}/>
        </div>
      )}

      {(screen==="store"||screen==="saved")&&(
        <footer style={{background:GN,color:"rgba(255,255,255,0.68)",textAlign:"center",padding:"20px 16px",fontSize:12}}>
          <div style={{fontFamily:"'Noto Nastaliq Urdu',serif",fontSize:15,color:GOLD,marginBottom:5}}>{store.info.urdu}</div>
          <div style={{marginBottom:3}}>{store.info.address}</div>
          <div>📞 {store.info.phone} · {store.info.owner}</div>
        </footer>
      )}
    </div>
  );
}
