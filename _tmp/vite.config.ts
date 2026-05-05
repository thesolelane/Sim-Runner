import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isBeta = process.env.SUPABASE_ENV === 'beta'

const supabaseUrl = isBeta
  ? (process.env.BETA_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '')
  : (process.env.VITE_SUPABASE_URL ?? '')

const supabaseAnonKey = isBeta
  ? (process.env.BETA_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '')
  : (process.env.VITE_SUPABASE_ANON_KEY ?? '')

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer', '@solana/web3.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react'],
          'vendor-solana': ['@solana/web3.js', 'buffer'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
