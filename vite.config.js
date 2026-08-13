import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/bcsflows/', // <- mantenha a barra inicial e final
  plugins: [react()],
})
