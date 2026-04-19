/* ══════════════════════════════════════════════
   TIME APP — main.js unificado
   MiniKit se instala PRIMERO, luego Firebase y lógica
══════════════════════════════════════════════ */
const sdk = window.MiniKit
console.log("SDK:",sdk)
import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════════
   1. INSTALAR MINIKIT — lo primero de todo
══════════════════════════════════════════════ */
window._dbg = function(msg) {
  console.log("[DBG]", msg);
  let p = document.getElementById("debug-panel");
  if (!p) {
    p = document.createElement("div");
    p.id = "debug-panel";
    p.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:#000;color:#0f0;font-size:10px;padding:6px;z-index:9999;max-height:140px;overflow-y:auto;font-family:monospace;border-top:1px solid #0f0";
    document.body.appendChild(p);
  }
  p.innerHTML += "<div>" + String(msg) + "</div>";
  p.scrollTop = p.scrollHeight;
};

try {
  MiniKit.install("app_d8fe914322b26e067cd72b0a5780319a");
  window.MiniKit = MiniKit;
  window.__mkReady = true;
  _dbg("✓ MiniKit instalado OK");
  _dbg("isInstalled: " + MiniKit.isInstalled?.());
  _dbg("commandsAsync.pay: " + typeof MiniKit.commandsAsync?.pay);
} catch(e) {
  window.__mkReady = false;
  _dbg("⚠ MiniKit install error: " + e.message);
}

/* ══════════════════════════════════════════════
   2. CONFIG
══════════════════════════════════════════════ */
const APP_ID       = "app_d8fe914322b26e067cd72b0a5780319a";
const ACTION_ID    = "verificacion-time";
const BASE_RATE    = 0.1 / 3600;
const SYNC_CADA    = 10;
const PAYMENT_WALLET = "0xbfab37c6703e853944696dc9400be77f3878df7b";

const firebaseConfig = {
  apiKey:            "AIzaSyC7GfllFG3MBWb_190pi_nhakAJk4kmn5Y",
  authDomain:        "time-2e941.firebaseapp.com",
  projectId:         "time-2e941",
  storageBucket:     "time-2e941.firebasestorage.app",
  messagingSenderId: "459114330177",
  appId:             "1:459114330177:web:74771a874c21060e8d2ec0"
};

/* ══════════════════════════════════════════════
   3. CATÁLOGO DE BOOSTS
══════════════════════════════════════════════ */
const BOOSTS = {
  spark:   { name:"SPARK",    sub:"2X · 1 HORA",      multi:2,   durMs:1*3600*1000, wld:"0.05", usdc:"0.10",  tipo:"temp" },
  blaze:   { name:"BLAZE",    sub:"5X · 3 HORAS",     multi:5,   durMs:3*3600*1000, wld:"0.10", usdc:"0.25",  tipo:"temp" },
  inferno: { name:"INFERNO",  sub:"10X · 6 HORAS",    multi:10,  durMs:6*3600*1000, wld:"0.18", usdc:"0.50",  tipo:"temp" },
  tier1:   { name:"TIER I",   sub:"1.5X PERMANENTE",  multi:1.5, wld:"0.50",  usdc:"1.50",  tipo:"perm" },
  tier2:   { name:"TIER II",  sub:"2X PERMANENTE",    multi:2,   wld:"1.20",  usdc:"3.50",  tipo:"perm" },
  tier3:   { name:"TIER III", sub:"3X PERMANENTE",    multi:3,   wld:"2.50",  usdc:"7.00",  tipo:"perm" },
  tier4:   { name:"TIER IV",  sub:"5X PERMANENTE",    multi:5,   wld:"5.00",  usdc:"14.00", tipo:"perm" },
};

const TIER_ORDER = ["tier4","tier3","tier2","tier1"];

/* ══════════════════════════════════════════════
   4. FIREBASE
══════════════════════════════════════════════ */
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

/* ══════════════════════════════════════════════
   5. ESTADO
══════════════════════════════════════════════ */
let segundos      = 0;
let earnedToday   = 0;
let earnedTotal   = 0;
let streak        = 1;
let userHash      = null;
let timerInterval = null;
let segsSinSync   = 0;
let inicioReal    = null;
let guardando     = false;

let boostState = {
  spark:   null,
  blaze:   null,
  inferno: null,
  tier1:   false,
  tier2:   false,
  tier3:   false,
  tier4:   false,
};

let modalBoostId = null;
let modalMoneda  = null;

/* ══════════════════════════════════════════════
   6. HELPERS
══════════════════════════════════════════════ */
const pad   = n => String(n).padStart(2,"0");
const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
const lsKey      = h => "time_bk_"    + h;
const lsBoostKey = h => "time_boost_" + h;

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
window.mostrarToast = toast;

function getDeviceId() {
  let id = localStorage.getItem("time_device_id");
  if (!id) {
    id = "dev_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    localStorage.setItem("time_device_id", id);
  }
  return id;
}

/* ══════════════════════════════════════════════
   7. MULTIPLICADORES
══════════════════════════════════════════════ */
function getMultiplicador() {
  const now = Date.now();
  let permMulti = 1;
  for (const tid of TIER_ORDER) {
    if (boostState[tid]) { permMulti = BOOSTS[tid].multi; break; }
  }
  let tempMulti = 1;
  for (const tid of ["inferno","blaze","spark"]) {
    if (boostState[tid] && boostState[tid].expireAt > now) {
      tempMulti = BOOSTS[tid].multi; break;
    }
  }
  return permMulti * tempMulti;
}

function getActiveTemp() {
  const now = Date.now();
  for (const tid of ["inferno","blaze","spark"]) {
    if (boostState[tid] && boostState[tid].expireAt > now) return tid;
  }
  return null;
}

function getActivePerm() {
  for (const tid of TIER_ORDER) {
    if (boostState[tid]) return tid;
  }
  return null;
}

/* ══════════════════════════════════════════════
   8. LOCAL STORAGE
══════════════════════════════════════════════ */
function guardarLocal() {
  if (!userHash) return;
  try {
    localStorage.setItem(lsKey(userHash), JSON.stringify({
      total: earnedTotal, today: earnedToday, streak,
      lastDate: new Date().toDateString()
    }));
    localStorage.setItem(lsBoostKey(userHash), JSON.stringify(boostState));
  } catch(_) {}
}

function cargarLocal(hash) {
  try {
    const raw = localStorage.getItem(lsKey(hash));
    if (raw) {
      const d = JSON.parse(raw);
      const hoy  = new Date().toDateString();
      const ayer = new Date(); ayer.setDate(ayer.getDate()-1);
      earnedTotal = d.total || 0;
      if (d.lastDate === hoy) {
        earnedToday = d.today  || 0;
        streak      = d.streak || 1;
      } else {
        earnedToday = 0;
        streak = d.lastDate === ayer.toDateString() ? (d.streak||1)+1 : 1;
      }
    }
    const rawB = localStorage.getItem(lsBoostKey(hash));
    if (rawB) {
      const b = JSON.parse(rawB);
      const now = Date.now();
      for (const tid of ["spark","blaze","inferno"]) {
        boostState[tid] = (b[tid] && b[tid].expireAt > now) ? b[tid] : null;
      }
      for (const tid of ["tier1","tier2","tier3","tier4"]) {
        boostState[tid] = !!b[tid];
      }
    }
  } catch(_) {}
}

/* ══════════════════════════════════════════════
   9. FIREBASE SYNC
══════════════════════════════════════════════ */
async function syncFirebaseBg(hash) {
  const hoy  = new Date().toDateString();
  const ayer = new Date(); ayer.setDate(ayer.getDate()-1);
  try {
    const ref  = doc(db,"usuarios",hash);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      if ((d.total||0) > earnedTotal) {
        earnedTotal = d.total;
        if (d.lastDate === hoy) {
          earnedToday = Math.max(earnedToday, d.today||0);
          streak = d.streak || streak;
        } else {
          streak = d.lastDate === ayer.toDateString() ? (d.streak||1)+1 : streak;
        }
      }
      if (d.boosts) {
        const b = d.boosts, now = Date.now();
        for (const tid of ["spark","blaze","inferno"]) {
          if (b[tid] && b[tid].expireAt > now) boostState[tid] = b[tid];
        }
        for (const tid of ["tier1","tier2","tier3","tier4"]) {
          if (b[tid]) boostState[tid] = true;
        }
        guardarLocal();
      }
      actualizarUI();
    } else {
      await setDoc(ref, {
        total:earnedTotal, today:earnedToday, streak,
        lastDate:hoy, boosts:boostState, creadoEn:serverTimestamp()
      });
    }
  } catch(e) { console.warn("[TIME] Firebase bg:", e); }
}

async function sync() {
  guardarLocal();
  if (!userHash || guardando) return;
  guardando = true;
  try {
    await setDoc(doc(db,"usuarios",userHash), {
      total:earnedTotal, today:earnedToday, streak,
      lastDate:new Date().toDateString(), boosts:boostState, ultimaSync:serverTimestamp()
    }, { merge:true });
  } catch(e) { console.warn("[TIME] sync:", e); }
  finally { guardando = false; }
}

/* ══════════════════════════════════════════════
   10. VERIFICAR CON WORLD ID
══════════════════════════════════════════════ */
window.verificar = async function() {
  const btn = document.getElementById("btn-verify");
  const err = document.getElementById("error-msg");
  btn.textContent = "VERIFICANDO...";
  btn.disabled    = true;
  err.textContent = "";

  // Pequeño delay para que el UI se actualice antes de llamadas async
  await new Promise(r => setTimeout(r, 80));

  const mkOk = window.__mkReady && MiniKit.isInstalled?.();
  _dbg("verificar — mkOk=" + mkOk + " isInstalled=" + MiniKit.isInstalled?.());

  if (!mkOk) {
    // Fallback: fuera de World App
    const wallet = window.__mkReady ? MiniKit?.user?.walletAddress : null;
    userHash = wallet || getDeviceId();
    cargarLocal(userHash);
    entrarApp(!!wallet);
    syncFirebaseBg(userHash);
    return;
  }

  try {
    if (typeof MiniKit.commandsAsync?.verify !== "function") {
      userHash = MiniKit?.user?.walletAddress || getDeviceId();
      cargarLocal(userHash);
      entrarApp(true);
      syncFirebaseBg(userHash);
      return;
    }

    const resp = await Promise.race([
      MiniKit.commandsAsync.verify({ action:ACTION_ID, signal:"", verification_level:"orb" }),
      new Promise((_,rej) => setTimeout(()=>rej(new Error("timeout")),20000))
    ]);
    const p = resp?.finalPayload ?? resp;

    if (p?.status==="success") {
      userHash = p.nullifier_hash;
    } else if (p?.error_code==="already_verified") {
      userHash = p.nullifier_hash || MiniKit?.user?.walletAddress || getDeviceId();
    } else {
      userHash = MiniKit?.user?.walletAddress || null;
    }
  } catch(e) {
    _dbg("verificar error: " + e.message);
    userHash = MiniKit?.user?.walletAddress || null;
  }

  if (!userHash) {
    userHash = getDeviceId();
    document.getElementById("badge-status").style.display = "none";
  }
  cargarLocal(userHash);
  entrarApp(true);
  syncFirebaseBg(userHash);
};

/* ══════════════════════════════════════════════
   11. ENTRAR A LA APP
══════════════════════════════════════════════ */
function entrarApp(verificado) {
  document.getElementById("screen-verify").style.display = "none";
  document.getElementById("screen-main").style.display   = "flex";
  if (!verificado) document.getElementById("badge-status").style.display = "none";
  actualizarUI();
  iniciarTimer();
  sync();
  window.addEventListener("beforeunload", () => guardarLocal());
  document.addEventListener("visibilitychange", () => { if (document.hidden) sync(); });
  try { MiniKit?.subscribe?.("miniapp-close", () => sync()); } catch(_) {}
}

/* ══════════════════════════════════════════════
   12. TIMER
══════════════════════════════════════════════ */
function iniciarTimer() {
  if (timerInterval) return;
  inicioReal = Date.now();
  timerInterval = setInterval(() => {
    segundos = Math.floor((Date.now()-inicioReal)/1000);
    const multi = getMultiplicador();
    earnedToday += BASE_RATE * multi;
    earnedTotal += BASE_RATE * multi;
    segsSinSync++;
    actualizarUI();
    if (segsSinSync >= SYNC_CADA) { segsSinSync = 0; sync(); }
  }, 1000);
}

/* ══════════════════════════════════════════════
   13. UI — ACTUALIZAR TODO
══════════════════════════════════════════════ */
function actualizarUI() {
  const m = Math.floor(segundos/60), s = segundos%60;
  setEl("timer-display", pad(m)+":"+pad(s));
  const arc = document.getElementById("timer-arc");
  if (arc) arc.style.strokeDashoffset = 502*(1-(segundos%60)/60);

  const multi = getMultiplicador();
  const rateActual = (0.1 * multi).toFixed(multi>=10 ? 0 : 1);

  setEl("earned-today",    earnedToday.toFixed(4));
  setEl("earned-total",    earnedTotal.toFixed(4));
  setEl("balance-display", earnedTotal.toFixed(4));
  setEl("hist-today",      "+"+earnedToday.toFixed(4)+" TIME");
  setEl("streak-val",      streak);
  setEl("rate-display",    rateActual);

  const rateEl = document.getElementById("rate-display");
  if (rateEl) rateEl.className = "stat-val" + (multi>1 ? " boosted" : "");

  const badge     = document.getElementById("active-boost-badge");
  const activeTemp = getActiveTemp();
  if (activeTemp && badge) {
    badge.textContent = "⚡ " + multi + "x";
    badge.classList.remove("hidden");
  } else if (badge) {
    badge.classList.add("hidden");
  }

  const activePerm = getActivePerm();
  if (activeTemp) {
    setEl("status-text", "⚡ BOOST ACTIVO "+multi+"x");
  } else if (activePerm) {
    setEl("status-text", "◈ "+BOOSTS[activePerm].name+" ACTIVO");
  } else {
    setEl("status-text", "ACUMULANDO TIME...");
  }

  actualizarBoostCards();
}

function actualizarBoostCards() {
  const now = Date.now();

  for (const tid of ["spark","blaze","inferno"]) {
    const b      = boostState[tid];
    const barWrap = document.getElementById(tid+"-bar-wrap");
    const timerEl = document.getElementById(tid+"-timer");
    const btnW    = document.getElementById("btn-"+tid+"-wld");
    const btnU    = document.getElementById("btn-"+tid+"-usdc");
    const card    = document.getElementById("card-"+tid);

    if (b && b.expireAt > now) {
      const left  = b.expireAt - now;
      const total = BOOSTS[tid].durMs;
      const pct   = (left/total)*100;
      const hh    = Math.floor(left/3600000);
      const mm    = Math.floor((left%3600000)/60000);
      const ss    = Math.floor((left%60000)/1000);
      if (barWrap) barWrap.style.display = "block";
      if (timerEl) { timerEl.style.display="block"; timerEl.textContent=`⏱ ${pad(hh)}:${pad(mm)}:${pad(ss)} restantes`; }
      const fill = document.getElementById(tid+"-bar");
      if (fill) fill.style.width = pct+"%";
      if (btnW) btnW.disabled = true;
      if (btnU) btnU.disabled = true;
      if (card) card.classList.add("active-boost");
    } else {
      if (barWrap) barWrap.style.display="none";
      if (timerEl) timerEl.style.display="none";
      if (btnW) btnW.disabled = false;
      if (btnU) btnU.disabled = false;
      if (card) card.classList.remove("active-boost");
      if (b) boostState[tid] = null;
    }
  }

  const perm = getActivePerm();
  for (const tid of ["tier1","tier2","tier3","tier4"]) {
    const owned  = document.getElementById(tid+"-owned");
    const buyRow = document.getElementById(tid+"-buy");
    const isOwned = boostState[tid];
    if (owned)  owned.style.display  = isOwned ? "flex" : "none";
    if (buyRow) buyRow.style.display = isOwned ? "none" : "flex";
  }

  if (perm) {
    setEl("perm-tier-name",  BOOSTS[perm].name);
    setEl("perm-tier-multi", BOOSTS[perm].multi+"x");
  } else {
    setEl("perm-tier-name",  "SIN TIER");
    setEl("perm-tier-multi", "1x");
  }
}

/* ══════════════════════════════════════════════
   14. MODAL DE COMPRA
══════════════════════════════════════════════ */
window.abrirModal = function(boostId, moneda) {
  const b = BOOSTS[boostId];
  modalBoostId = boostId;
  modalMoneda  = moneda;

  setEl("modal-title",      b.name);
  setEl("modal-sub",        b.sub);
  setEl("modal-price-wld",  b.wld + " WLD");
  setEl("modal-price-usdc", "$" + b.usdc + " USDC");

  const wallet = window.__mkReady ? MiniKit?.user?.walletAddress : null;
  const wRow   = document.getElementById("modal-wallet-row");
  if (wallet && wRow) {
    wRow.style.display = "flex";
    setEl("modal-wallet-addr", wallet.slice(0,6)+"..."+wallet.slice(-4));
  }

  document.getElementById("modal-btn-wld").style.opacity  = moneda==="wld"  ? "1" : "0.5";
  document.getElementById("modal-btn-usdc").style.opacity = moneda==="usdc" ? "1" : "0.5";
  document.getElementById("modal-overlay").classList.add("open");
};

window.cerrarModal = function() {
  document.getElementById("modal-overlay").classList.remove("open");
};

window.cerrarModalOverlay = function(e) {
  if (e.target === document.getElementById("modal-overlay")) cerrarModal();
};

/* ══════════════════════════════════════════════
   15. COMPRAR BOOST — MiniKit Pay
══════════════════════════════════════════════ */
window.comprar = async function(moneda) {
  const b    = BOOSTS[modalBoostId];
  const btnW = document.getElementById("modal-btn-wld");
  const btnU = document.getElementById("modal-btn-usdc");
  const resetBtns = () => {
    btnW.disabled = btnU.disabled = false;
    btnW.textContent = "PAGAR WLD";
    btnU.textContent = "PAGAR USDC";
  };

  btnW.disabled = btnU.disabled = true;
  btnW.textContent = btnU.textContent = "PROCESANDO...";

  _dbg("comprar moneda=" + moneda + " boost=" + modalBoostId);
  _dbg("__mkReady=" + window.__mkReady);

  if (!window.__mkReady) {
    _dbg("ERROR: MiniKit no está listo");
    toast("Abre la app en World App");
    resetBtns(); return;
  }

  _dbg("isInstalled=" + MiniKit.isInstalled?.());
  _dbg("commandsAsync.pay=" + typeof MiniKit.commandsAsync?.pay);

  const isWld    = moneda === "wld";
  const symbol   = isWld ? "WLD" : "USDCE";
  const raw      = parseFloat(isWld ? b.wld : b.usdc);
  const dec      = isWld ? 18 : 6;
  const tokenAmt = BigInt(Math.round(raw * Math.pow(10, dec))).toString();
  const refId    = "time_" + modalBoostId + "_" + (userHash||"anon").slice(-6) + "_" + Date.now();

  const payload = {
    reference:   refId,
    to:          PAYMENT_WALLET,
    tokens:      [{ symbol, token_amount: tokenAmt }],
    description: "TIME App — Boost: " + b.name,
  };

  _dbg("payload=" + JSON.stringify(payload));

  try {
    let finalPayload;

    if (typeof MiniKit.commandsAsync?.pay === "function") {
      _dbg("usando commandsAsync.pay");
      const r = await MiniKit.commandsAsync.pay(payload);
      _dbg("resp=" + JSON.stringify(r));
      finalPayload = r?.finalPayload ?? r;

    } else if (typeof MiniKit.pay === "function") {
      _dbg("usando MiniKit.pay");
      const r = await MiniKit.pay(payload);
      _dbg("resp=" + JSON.stringify(r));
      finalPayload = r?.data ?? r?.finalPayload ?? r;

    } else {
      _dbg("ERROR: ninguna fn pay disponible. Keys=" + Object.keys(MiniKit).join(","));
      toast("Error: World App no soporta pagos aquí");
      resetBtns(); return;
    }

    _dbg("finalPayload=" + JSON.stringify(finalPayload));

    const exito = finalPayload?.status === "success"
      || finalPayload?.transactionId
      || finalPayload?.transaction_id
      || finalPayload?.transaction_hash;

    if (exito) {
      const txHash = finalPayload?.transaction_hash || finalPayload?.transactionId || finalPayload?.transaction_id || "";
      registrarPago({ ref:refId, boost:modalBoostId, moneda, amount:raw.toString(), token:symbol, txHash, usuario:userHash, ts:Date.now() });
      activarBoost(modalBoostId);
      cerrarModal();
      toast("✓ " + b.name + " ACTIVADO");
      sync();

    } else if (finalPayload?.status === "error" || finalPayload?.error_code) {
      _dbg("Pago error: " + (finalPayload?.error_code || finalPayload?.status));
      toast("Pago fallido: " + (finalPayload?.error_code || "error"));
      resetBtns();

    } else {
      _dbg("Cancelado. status=" + finalPayload?.status);
      toast("Pago cancelado");
      resetBtns();
    }

  } catch(e) {
    _dbg("EXCEPCION: " + e.message);
    toast("Error: " + e.message);
    resetBtns();
  }
};

/* ══════════════════════════════════════════════
   16. REGISTRAR PAGO EN FIREBASE
══════════════════════════════════════════════ */
async function registrarPago(datos) {
  try {
    const pagoRef = doc(db, "pagos", datos.ref);
    await setDoc(pagoRef, { ...datos, creadoEn: serverTimestamp() });
  } catch(e) { console.warn("[TIME] registrarPago:", e); }
}

/* ══════════════════════════════════════════════
   17. ACTIVAR BOOST (post-pago)
══════════════════════════════════════════════ */
function activarBoost(boostId) {
  const b = BOOSTS[boostId];
  if (b.tipo === "temp") {
    const now = Date.now();
    const ya  = boostState[boostId];
    const base = (ya && ya.expireAt > now) ? ya.expireAt : now;
    boostState[boostId] = { expireAt: base + b.durMs };
  } else {
    boostState[boostId] = true;
  }
  guardarLocal();
  actualizarUI();
}

/* ══════════════════════════════════════════════
   18. TABS
══════════════════════════════════════════════ */
window.switchTab = function(tab) {
  const TABS = ["earn","boost","balance","info"];
  document.querySelectorAll(".tab").forEach((t,i) =>
    t.classList.toggle("active", TABS[i]===tab));
  document.querySelectorAll(".tab-content").forEach(c =>
    c.classList.remove("active"));
  document.getElementById("tab-"+tab)?.classList.add("active");
  if (tab==="boost") actualizarBoostCards();
};

window.retirar = () => toast("Retiro disponible próximamente");
