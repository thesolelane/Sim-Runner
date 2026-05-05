import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import StaffPanel from '../../components/StaffPanel'
import { SectionCard } from './shared'

export default function ControlsSection() {
  const [announcement, setAnnouncement] = useState('')
  const [announcementMsg, setAnnouncementMsg] = useState('')

  function handleAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announcement.trim()) return
    setAnnouncementMsg('Announcement queued (integrate with notification system to dispatch).')
    setAnnouncement('')
    setTimeout(() => setAnnouncementMsg(''), 4000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard title="Staff & Role Invites">
        <StaffPanel />
      </SectionCard>

      <SectionCard
        title="Feature Flags"
        action={
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Backend integration pending
          </span>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              key: 'maintenance_mode',
              label: 'Maintenance Mode',
              desc: 'Show maintenance page to non-admin visitors',
            },
            {
              key: 'new_feed_algo',
              label: 'New Feed Algorithm',
              desc: 'Enable experimental feed ranking',
            },
            {
              key: 'crypto_payments',
              label: 'Crypto Payments',
              desc: 'Allow Solana-based credit purchases',
            },
          ].map(flag => (
            <div
              key={flag.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--color-bg)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{flag.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{flag.desc}</div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 20,
                  background: 'var(--color-border)',
                  position: 'relative',
                  cursor: 'not-allowed',
                  opacity: 0.6,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 2,
                    left: 2,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Platform Announcement">
        <form
          onSubmit={handleAnnouncement}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <textarea
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            placeholder="Write a platform-wide announcement…"
            rows={4}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              resize: 'vertical',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Megaphone size={13} /> Send Announcement
            </button>
            {announcementMsg && (
              <span style={{ fontSize: 12, color: '#059669' }}>{announcementMsg}</span>
            )}
          </div>
        </form>
      </SectionCard>
    </div>
  )
}
