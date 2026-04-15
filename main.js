import { MiniKit } from '@worldcoin/minikit-js';

// Panel de debug visible en pantalla
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

// Instalar MiniKit una sola vez al cargar
window.__mkReady = true;

try {
  MiniKit.install("app_d8fe914322b26e067cd72b0a5780319a");
  window.MiniKit = MiniKit;
  window.__mkReady = true;
  _dbg("✓ MiniKit instalado OK");
  _dbg("isInstalled: " + MiniKit.isInstalled?.());
  _dbg("commandsAsync.pay: " + typeof MiniKit.commandsAsync?.pay);
} catch(e) {
  window.__mkReady = true;
  _dbg("⚠ MiniKit install error: " + e.message);
}
