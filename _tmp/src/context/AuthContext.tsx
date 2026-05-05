import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User, Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AccountType, DelegationRole } from '../lib/database.types'

interface UserProfile {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: AccountType
  credit_balance: number
  is_delegate?: boolean
  delegate_principal_id?: string | null
}

interface DelegateSession {
  delegationId: string
  actualUserId: string
  principalUserId: string
  role: DelegationRole
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  needsOnboarding: boolean
  delegateSession: DelegateSession | null
  effectiveUserId: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; userId?: string; needsEmailConfirmation?: boolean }>
  signInWithOAuth: (provider: Provider) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  logDelegateAction: (actionType: string, actionDetail?: Record<string, unknown>) => Promise<void>
  canDelegate: (action: 'message' | 'bid' | 'job_post' | 'post' | 'manage_team') => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [delegateSession, setDelegateSession] = useState<DelegateSession | null>(null)

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('users')
      .select(
        'id, display_name, handle, avatar_url, account_type, credit_balance, is_delegate, delegate_principal_id'
      )
      .eq('id', userId)
      .single()
    return data as UserProfile | null
  }

  async function fetchPrincipalProfile(principalId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('users')
      .select('id, display_name, handle, avatar_url, account_type, credit_balance')
      .eq('id', principalId)
      .single()
    return data as UserProfile | null
  }

  async function loadDelegateSession(
    actualUser: User,
    ownProfile: UserProfile
  ): Promise<{ principalProfile: UserProfile | null; ds: DelegateSession | null }> {
    if (!ownProfile.is_delegate || !ownProfile.delegate_principal_id) {
      return { principalProfile: null, ds: null }
    }
    const { data: delegation } = await supabase
      .from('account_delegations')
      .select('id, role, principal_id')
      .eq('delegate_id', actualUser.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!delegation) {
      return { principalProfile: null, ds: null }
    }

    const principalProfile = await fetchPrincipalProfile(delegation.principal_id)
    const ds: DelegateSession = {
      delegationId: delegation.id,
      actualUserId: actualUser.id,
      principalUserId: delegation.principal_id,
      role: delegation.role as DelegationRole,
    }
    return { principalProfile, ds }
  }

  async function refreshProfile() {
    if (!user) return
    const ownProfile = await fetchProfile(user.id)
    if (ownProfile) {
      if (ownProfile.is_delegate && ownProfile.delegate_principal_id) {
        const { principalProfile, ds } = await loadDelegateSession(user, ownProfile)
        if (principalProfile && ds) {
          setProfile({
            ...principalProfile,
            is_delegate: true,
            delegate_principal_id: ownProfile.delegate_principal_id,
          })
          setDelegateSession(ds)
        } else {
          setProfile(ownProfile)
          setDelegateSession(null)
        }
      } else {
        setProfile(ownProfile)
        setDelegateSession(null)
      }
      setNeedsOnboarding(false)
    }
  }

  async function initSession(sessionUser: User | null) {
    if (!sessionUser) {
      setProfile(null)
      setNeedsOnboarding(false)
      setDelegateSession(null)
      return
    }

    const ownProfile = await fetchProfile(sessionUser.id)
    if (!ownProfile) {
      setProfile(null)
      setNeedsOnboarding(true)
      setDelegateSession(null)
      return
    }

    if (ownProfile.is_delegate && ownProfile.delegate_principal_id) {
      const { principalProfile, ds } = await loadDelegateSession(sessionUser, ownProfile)
      if (principalProfile && ds) {
        setProfile({
          ...principalProfile,
          is_delegate: true,
          delegate_principal_id: ownProfile.delegate_principal_id,
        })
        setDelegateSession(ds)
        setNeedsOnboarding(false)
        return
      }
    }

    setProfile(ownProfile)
    setDelegateSession(null)
    setNeedsOnboarding(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      await initSession(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      await initSession(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    const needsEmailConfirmation = !data.session && !!data.user
    return { error: null, userId: data.user?.id, needsEmailConfirmation }
  }

  async function signInWithOAuth(provider: Provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setNeedsOnboarding(false)
    setDelegateSession(null)
  }

  async function logDelegateAction(actionType: string, actionDetail?: Record<string, unknown>) {
    if (!delegateSession) return
    await supabase.from('delegate_audit_log').insert({
      delegation_id: delegateSession.delegationId,
      actual_user_id: delegateSession.actualUserId,
      acting_as_user_id: delegateSession.principalUserId,
      action_type: actionType,
      action_detail: actionDetail ?? null,
    })
  }

  function canDelegate(action: 'message' | 'bid' | 'job_post' | 'post' | 'manage_team'): boolean {
    if (!delegateSession) return true
    const role = delegateSession.role
    if (role === 'admin') {
      return action !== 'manage_team'
    }
    if (role === 'contributor') {
      return action === 'post'
    }
    return false
  }

  const effectiveUserId = delegateSession ? delegateSession.principalUserId : (user?.id ?? null)

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        needsOnboarding,
        delegateSession,
        effectiveUserId,
        signIn,
        signUp,
        signInWithOAuth,
        signOut,
        refreshProfile,
        logDelegateAction,
        canDelegate,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
