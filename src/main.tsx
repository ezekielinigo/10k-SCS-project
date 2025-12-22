import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { GameProvider } from "./game/GameContext"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>,
)

// Register service worker for PWA/offline (production only)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => {
      console.warn("SW registration failed", err)
    })
  })
}
