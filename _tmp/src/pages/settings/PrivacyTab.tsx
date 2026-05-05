import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TabHeading, Section, SavedBanner } from './shared'

export default function PrivacyTab() {
  const { profile } = useAuth()
  const isContractor = profile?.account_type === 'contractor'

  const [visibleToOwners, setVisibleToOwners] = useState(true)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [privacyMsg, setPrivacyMsg] = useState('')

  useEffect(() => {
    if (!profile || !isContractor) return
    supabase
      .from('contractor_profiles')
      .select('visible_to_owners')
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) setVisibleToOwners(data.visible_to_owners)
      })
  }, [profile, isContractor])

  async function handleVisibilityToggle() {
    if (!profile) return
    setSavingPrivacy(true)
    setPrivacyMsg('')
    const newVal = !visibleToOwners
    const { error } = await supabase
      .from('contractor_profiles')
      .update({ visible_to_owners: newVal })
      .eq('user_id', profile.id)
    setSavingPrivacy(false)
    if (!error) {
      setVisibleToOwners(newVal)
      setPrivacyMsg(
        newVal
          ? 'Your profile is now visible to owners.'
          : 'Your profile is now hidden from owners.'
      )
    }
  }

  return (
    <div>
      <TabHeading>Privacy</TabHeading>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        Control who can find you and contact you on the platform.
      </div>
      <Section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-condensed)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              Show profile in Explore
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Allow project owners and agents to find your profile
            </div>
          </div>
          <button
            onClick={handleVisibilityToggle}
            disabled={savingPrivacy}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              background: visibleToOwners ? 'var(--color-brand)' : 'var(--color-border)',
              border: 'none',
              cursor: savingPrivacy ? 'not-allowed' : 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
              opacity: savingPrivacy ? 0.6 : 1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: visibleToOwners ? 20 : 3,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
        {privacyMsg && <SavedBanner msg={privacyMsg} />}
      </Section>
    </div>
  )
}
