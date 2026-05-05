import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, Coins } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  TabHeading,
  Section,
  SectionHeading,
  SavedBanner,
  ErrorBanner,
  inputStyle,
  btnPrimary,
  btnGhost,
} from './shared'

export default function AccountTab() {
  const { profile, user, refreshProfile, delegateSession } = useAuth()
  const isContractor = profile?.account_type === 'contractor'
  const [, setSearchParams] = useSearchParams()

  function goToBilling() {
    setSearchParams({ tab: 'billing' }, { replace: true })
  }

  // ── Email ──
  const [emailMsg, setEmailMsg] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [sendingVerif, setSendingVerif] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  useEffect(() => {
    setCurrentEmail(user?.email ?? '')
  }, [user])

  async function handleResendVerification() {
    setSendingVerif(true)
    setEmailMsg('')
    setEmailErr('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: currentEmail })
    setSendingVerif(false)
    if (error) setEmailErr(error.message)
    else setEmailMsg('Verification email sent — check your inbox.')
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailMsg('')
    setEmailErr('')
    if (!newEmail || newEmail === currentEmail) {
      setEmailErr('Please enter a different email address.')
      return
    }
    setChangingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setChangingEmail(false)
    if (error) {
      setEmailErr(error.message)
    } else {
      setEmailMsg(
        `Confirmation sent to ${newEmail}. Check your inbox and click the link to confirm the change.`
      )
      await refreshProfile()
      setNewEmail('')
    }
  }

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg('')
    setPwdErr('')
    if (newPassword !== confirmPassword) {
      setPwdErr('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPwdErr('Password must be at least 8 characters.')
      return
    }
    setSavingPwd(true)
    const signInRes = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    })
    if (signInRes.error) {
      setPwdErr('Current password is incorrect.')
      setSavingPwd(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPwd(false)
    if (error) setPwdErr(error.message)
    else {
      setPwdMsg('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div>
      <TabHeading>Account</TabHeading>

      {/* Delegate session notice */}
      {delegateSession && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(232,93,4,0.06)',
            border: '1px solid rgba(232,93,4,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--color-text-muted)',
          }}
        >
          <Users size={14} color="var(--color-brand)" style={{ flexShrink: 0 }} />
          <span>
            You are operating as a{' '}
            <strong style={{ color: 'var(--color-text)' }}>
              {delegateSession.role === 'admin' ? 'Team Admin' : 'Contributor'}
            </strong>
            . Billing, email, and password settings are restricted to the account owner.
          </span>
        </div>
      )}

      {/* Profile summary */}
      <Section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Display name
            </div>
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--color-text)',
              }}
            >
              {profile?.display_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Account type
            </div>
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                background: 'var(--color-brand-light)',
                color: 'var(--color-brand)',
                padding: '3px 10px',
                borderRadius: 4,
                display: 'inline-block',
              }}
            >
              {profile?.account_type?.replace('_', ' ')}
            </div>
          </div>
          {!isContractor && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Credit balance
              </div>
              <button
                onClick={goToBilling}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-brand-light)',
                  border: '1px solid rgba(232,93,4,0.2)',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-brand)',
                }}
              >
                <Coins size={14} /> {profile?.credit_balance ?? 0} credits
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Change email — hidden for delegates */}
      {!delegateSession && (
        <>
          <SectionHeading>Email</SectionHeading>
          <Section>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Current email
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                }}
              >
                {currentEmail || '—'}
              </div>
            </div>
            <form
              onSubmit={handleChangeEmail}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  New email address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="Enter new email"
                  style={inputStyle}
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={changingEmail || !newEmail}
                  style={{ ...btnGhost, opacity: changingEmail || !newEmail ? 0.6 : 1 }}
                >
                  {changingEmail ? 'Sending…' : 'Change Email'}
                </button>
              </div>
            </form>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
              <button
                onClick={handleResendVerification}
                disabled={sendingVerif || !currentEmail}
                style={{ ...btnGhost, opacity: sendingVerif ? 0.6 : 1, fontSize: 12 }}
              >
                {sendingVerif ? 'Sending…' : 'Resend Verification Email'}
              </button>
            </div>
            {emailMsg && <SavedBanner msg={emailMsg} />}
            {emailErr && <ErrorBanner msg={emailErr} />}
          </Section>
        </>
      )}

      {/* Change password — hidden for delegates */}
      {!delegateSession && (
        <>
          <SectionHeading>Password</SectionHeading>
          <Section>
            <form
              onSubmit={handleChangePassword}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="Repeat new password"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={savingPwd}
                  style={{ ...btnPrimary, opacity: savingPwd ? 0.6 : 1 }}
                >
                  {savingPwd ? 'Saving…' : 'Update Password'}
                </button>
              </div>
              {pwdMsg && <SavedBanner msg={pwdMsg} />}
              {pwdErr && <ErrorBanner msg={pwdErr} />}
            </form>
          </Section>
        </>
      )}
    </div>
  )
}
