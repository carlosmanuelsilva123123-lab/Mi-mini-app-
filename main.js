import MiniKit from "https://esm.sh/@worldcoin/minikit-js";

(async () => {
  // 🔍 DEBUG CLAVE
  alert("URL: " + window.location.href);
  alert("¿Dentro iframe?: " + (window.self !== window.top));

  try {
    await MiniKit.install();

    alert("✅ MiniKit FUNCIONANDO");
    console.log("MiniKit:", MiniKit);

  } catch (e) {
    alert("❌ ERROR: No estás dentro de World App REAL");
    console.error(e);
  }
})();
