import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TabHeading, inputStyle, ErrorBanner } from './shared'

export default function DangerTab() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  async function handleDeleteAccount() {
    if (!profile) return
    if (deleteConfirmText !== 'CONFIRM') {
      setDeleteErr('Type CONFIRM to proceed.')
      return
    }
    setDeletingAccount(true)
    setDeleteErr('')
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', profile.id)
    if (error) {
      setDeleteErr(error.message)
      setDeletingAccount(false)
      return
    }
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div>
      <TabHeading>Danger Zone</TabHeading>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Destructive account actions. These cannot be undone.
      </div>
      <div
        style={{
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 14,
            fontWeight: 700,
            color: '#DC2626',
            marginBottom: 6,
          }}
        >
          Delete Account
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          This will deactivate your account. Your data will be soft-deleted and you will be signed
          out. Type <strong style={{ color: 'var(--color-text)' }}>CONFIRM</strong> below to
          proceed.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Type CONFIRM"
            style={{ ...inputStyle, maxWidth: 180, flex: '0 0 auto' }}
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount || deleteConfirmText !== 'CONFIRM'}
            style={{
              padding: '9px 18px',
              background: deleteConfirmText === 'CONFIRM' ? '#DC2626' : 'var(--color-bg)',
              border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-condensed)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: deleteConfirmText === 'CONFIRM' ? '#fff' : '#DC2626',
              cursor:
                deletingAccount || deleteConfirmText !== 'CONFIRM' ? 'not-allowed' : 'pointer',
              opacity: deletingAccount ? 0.6 : 1,
            }}
          >
            {deletingAccount ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
        {deleteErr && <ErrorBanner msg={deleteErr} />}
      </div>
    </div>
  )
}
