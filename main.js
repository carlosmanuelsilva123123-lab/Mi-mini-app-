import MiniKit from "https://cdn.jsdelivr.net/npm/@worldcoin/minikit-js/+esm";

// 👇 Hacer MiniKit global (para usarlo desde HTML)
window.MiniKit = MiniKit;

// 👇 Inicializar MiniKit
async function initMiniKit() {
  try {
    await MiniKit.install();console.log("MiniKit:", MiniKit);
console.log("commands:", MiniKit?.commands);
    console.log("✅ MiniKit listo");
  } catch (e) {
    console.error("❌ Error MiniKit:", e);
    document.getElementById("error-msg").innerText =
      "Abre la app dentro de World App";
  }
}

initMiniKit();

// 👇 ESTA ES LA FUNCIÓN DEL BOTÓN (IMPORTANTE)
window.verificar = async function () {
  try {
    const result = await MiniKit.commands.verify({
      action: "verify-user", // 👈 debe existir en tu dashboard
    });

    console.log(result);

    if (result.status === "success") {
      document.getElementById("screen-verify").style.display = "none";
      document.getElementById("screen-main").style.display = "flex";
    } else {
      document.getElementById("error-msg").innerText =
        "Verificación fallida";
    }

  } catch (e) {
    console.error(e);
    document.getElementById("error-msg").innerText =
      "Error verificando World ID";
  }
};
