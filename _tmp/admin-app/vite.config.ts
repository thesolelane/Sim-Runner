import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '..')

const isBeta = process.env.SUPABASE_ENV === 'beta'

const supabaseUrl = isBeta
  ? (process.env.BETA_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '')
  : (process.env.VITE_SUPABASE_URL ?? '')

const supabaseAnonKey = isBeta
  ? (process.env.BETA_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '')
  : (process.env.VITE_SUPABASE_ANON_KEY ?? '')

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  define: {
    global: 'globalThis',
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    'import.meta.env.VITE_SUPABASE_ENV': JSON.stringify(isBeta ? 'beta' : 'production'),
  },
  resolve: {
    alias: [
      { find: 'buffer', replacement: 'buffer/' },
      {
        find: '@main',
        replacement: path.resolve(workspaceRoot, 'src'),
      },
      {
        find: path.resolve(workspaceRoot, 'src/context/AuthContext'),
        replacement: path.resolve(__dirname, 'src/context/AuthContext'),
      },
    ],
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    outDir: path.resolve(workspaceRoot, 'admin-dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4001,
    allowedHosts: true,
    fs: {
      allow: [workspaceRoot],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
