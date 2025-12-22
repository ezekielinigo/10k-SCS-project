import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["inopportunely-nonevaporable-duane.ngrok-free.dev"],
    hmr: {
      host: "192.168.1.58", // replace with your LAN IP
      protocol: "ws",
      port: 5173
    }
  }
})
