import MiniKit from "https://cdn.jsdelivr.net/npm/@worldcoin/minikit-js/+esm";

window.MiniKit = MiniKit; // 👈 importante

async function initMiniKit() {
  try {
    await MiniKit.install();

    console.log("✅ MiniKit OK");

    // Puedes mostrar algo en UI en vez de alert
    document.getElementById("error-msg").innerText = "MiniKit conectado";

  } catch (e) {
    console.error("❌ MiniKit error:", e);

    document.getElementById("error-msg").innerText =
      "Abre la app dentro de World App";
  }
}

initMiniKit();
window.verificar = async function () {
  try {
    const result = await MiniKit.commands.verify();

    console.log("Resultado verify:", result);

    if (result.status === "success") {
      document.getElementById("screen-verify").style.display = "none";
      document.getElementById("screen-main").style.display = "flex";
    } else {
      document.getElementById("error-msg").innerText = "Verificación fallida";
    }

  } catch (e) {
    console.error(e);
    document.getElementById("error-msg").innerText =
      "Error verificando World ID";
  }
};
