/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

interface AdminAuthContextType {
  session: Session | null
}

const AdminAuthContext = createContext<AdminAuthContextType>({ session: null })

export function AdminAuthProvider({
  session,
  children,
}: {
  session: Session | null
  children: ReactNode
}) {
  return <AdminAuthContext.Provider value={{ session }}>{children}</AdminAuthContext.Provider>
}

export function useAuth() {
  return useContext(AdminAuthContext)
}
