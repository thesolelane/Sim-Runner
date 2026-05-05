import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Camera,
  Loader,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ContractorProfile, SocialLinks } from '../types/profile'
import { sanitizeSocialLinks } from '../lib/urlUtils'
import { TRADE_OPTIONS } from '../data/trades'

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'not_available', label: 'Not Available' },
]

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [locationZip, setLocationZip] = useState('')

  const [businessName, setBusinessName] = useState('')
  const [bio, setBio] = useState('')
  const [primaryTrade, setPrimaryTrade] = useState('')
  const [secondaryTrades, setSecondaryTrades] = useState<string[]>([])
  const [yearsExp, setYearsExp] = useState(0)
  const [serviceRadius, setServiceRadius] = useState(50)
  const [availabilityStatus, setAvailabilityStatus] = useState('available')
  const [availableFrom, setAvailableFrom] = useState('')
  const [visibleToOwners, setVisibleToOwners] = useState(true)

  const [cp, setCp] = useState<ContractorProfile | null>(null)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const [socialLinks, setSocialLinks] = useState<SocialLinks>({})

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isContractor = profile?.account_type === 'contractor'

  useEffect(() => {
    if (!profile) return
    void loadData()
  }, [profile])

  async function loadData() {
    if (!profile) return
    const { data: userData } = await supabase
      .from('users')
      .select('display_name, location_city, location_state, location_zip, avatar_url, social_links')
      .eq('id', profile.id)
      .single()
    if (userData) {
      const u = userData as {
        display_name: string
        location_city: string | null
        location_state: string | null
        location_zip: string | null
        avatar_url: string | null
        social_links: SocialLinks | null
      }
      setDisplayName(u.display_name)
      setLocationCity(u.location_city ?? '')
      setLocationState(u.location_state ?? '')
      setLocationZip(u.location_zip ?? '')
      setAvatarPreview(u.avatar_url)
      setSocialLinks(u.social_links ?? {})
    }

    if (isContractor) {
      const { data: cpData } = await supabase
        .from('contractor_profiles')
        .select(
          'id, user_id, business_name, primary_trade, secondary_trades, years_experience, bio, service_radius_miles, availability_status, available_from, visible_to_owners, rating_avg, rating_count, projects_completed, total_work_value'
        )
        .eq('user_id', profile.id)
        .single()
      if (cpData) {
        const c = cpData as ContractorProfile
        setCp(c)
        setBusinessName(c.business_name ?? '')
        setBio(c.bio ?? '')
        setPrimaryTrade(c.primary_trade)
        setSecondaryTrades(c.secondary_trades)
        setYearsExp(c.years_experience)
        setServiceRadius(c.service_radius_miles)
        setAvailabilityStatus(c.availability_status)
        setAvailableFrom(c.available_from ?? '')
        setVisibleToOwners(c.visible_to_owners)
      }
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    if (!file.type.startsWith('image/')) {
      setAvatarError('Invalid file type — please upload an image (JPG, PNG, GIF, etc).')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('File too large — max 5 MB.')
      e.target.value = ''
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!avatarFile || !profile) return null
    setAvatarUploading(true)
    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `${profile.id}.${ext}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
    setAvatarUploading(false)
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    let avatarUrl: string | null = null
    if (avatarFile) {
      avatarUrl = await uploadAvatar()
      if (!avatarUrl) {
        setSaveError('Avatar upload failed. Your other changes will still be saved.')
      }
    }

    const sanitizedLinks = sanitizeSocialLinks(socialLinks as Record<string, string | undefined>)

    const userUpdate: Record<string, unknown> = {
      display_name: displayName.trim(),
      social_links: sanitizedLinks,
    }
    if (locationCity.trim()) userUpdate.location_city = locationCity.trim()
    if (locationState.trim()) userUpdate.location_state = locationState.trim()
    if (locationZip.trim()) userUpdate.location_zip = locationZip.trim()
    if (avatarUrl) userUpdate.avatar_url = avatarUrl

    const { error: userErr } = await supabase.from('users').update(userUpdate).eq('id', profile.id)
    if (userErr) {
      setSaveError('Failed to save profile. Please try again.')
      setSaving(false)
      return
    }

    if (isContractor && cp) {
      const cpUpdate: Record<string, unknown> = {
        business_name: businessName.trim() || null,
        bio: bio.trim() || null,
        primary_trade: primaryTrade,
        secondary_trades: secondaryTrades,
        years_experience: yearsExp,
        service_radius_miles: serviceRadius,
        availability_status: availabilityStatus,
        available_from: availableFrom || null,
        visible_to_owners: visibleToOwners,
      }
      const { error: cpErr } = await supabase
        .from('contractor_profiles')
        .update(cpUpdate)
        .eq('id', cp.id)
      if (cpErr) {
        setSaveError('User info saved but contractor profile update failed.')
        setSaving(false)
        return
      }
    }

    if (refreshProfile) await refreshProfile()
    setSaveSuccess(true)
    setSaving(false)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  function toggleSecondaryTrade(trade: string) {
    setSecondaryTrades(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    )
  }

  if (!profile) return null

  const initials =
    profile.display_name
      ?.split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link
          to={`/profile/${profile.handle}`}
          className="btn btn-ghost"
          style={{
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
          }}
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 22, flex: 1 }}>
          Edit Profile
        </h1>
        <button
          onClick={() => void handleSave()}
          disabled={saving || avatarUploading}
          className="btn btn-primary"
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {saveError && (
        <div
          style={{
            background: '#DC262618',
            border: '1px solid #DC2626',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: '#DC2626',
          }}
        >
          <AlertCircle size={14} /> {saveError}
        </div>
      )}
      {saveSuccess && (
        <div
          style={{
            background: '#05966918',
            border: '1px solid #059669',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: '#059669',
          }}
        >
          <CheckCircle size={14} /> Profile saved successfully!
        </div>
      )}

      {/* Avatar section */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 15,
            marginBottom: 16,
          }}
        >
          Profile Photo
        </h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  objectFit: 'cover',
                  border: '2px solid var(--color-border)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  background: 'var(--color-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                background: 'var(--color-brand)',
                border: '2px solid var(--color-surface)',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Camera size={11} color="#fff" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Upload a new photo</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              JPG, PNG or GIF. Max 5MB.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ marginTop: 8, fontSize: 12, padding: '5px 12px' }}
            >
              Choose File
            </button>
            {avatarError && (
              <p
                style={{
                  fontSize: 12,
                  color: '#DC2626',
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <AlertCircle size={12} /> {avatarError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 15,
            marginBottom: 16,
          }}
        >
          Basic Information
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                display: 'block',
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}
            >
              Display Name *
            </label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: 13,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                }}
              >
                City
              </label>
              <input
                value={locationCity}
                onChange={e => setLocationCity(e.target.value)}
                placeholder="Austin"
                style={{
                  width: '100%',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: 13,
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                }}
              >
                State
              </label>
              <input
                value={locationState}
                onChange={e => setLocationState(e.target.value)}
                placeholder="TX"
                maxLength={2}
                style={{
                  width: '100%',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: 13,
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                }}
              >
                ZIP
              </label>
              <input
                value={locationZip}
                onChange={e => setLocationZip(e.target.value)}
                placeholder="78701"
                style={{
                  width: '100%',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: 13,
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contractor info */}
      {isContractor && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h2
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              Contractor Profile
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Business Name
                </label>
                <input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="Your LLC / DBA"
                  style={{
                    width: '100%',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell other tradespeople and clients about your work..."
                  style={{
                    width: '100%',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    fontSize: 13,
                    resize: 'vertical',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Primary Trade *
                  </label>
                  <select
                    value={primaryTrade}
                    onChange={e => setPrimaryTrade(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {TRADE_OPTIONS.filter(t => t !== 'All Trades').map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Years Experience
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={yearsExp}
                    onChange={e => setYearsExp(Number(e.target.value))}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Secondary Trades
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TRADE_OPTIONS.filter(t => t !== 'All Trades' && t !== primaryTrade).map(t => (
                    <button
                      key={t}
                      onClick={() => toggleSecondaryTrade(t)}
                      type="button"
                      style={{
                        fontSize: 12,
                        padding: '3px 10px',
                        borderRadius: 20,
                        cursor: 'pointer',
                        border: '1.5px solid',
                        borderColor: secondaryTrades.includes(t)
                          ? 'var(--color-brand)'
                          : 'var(--color-border)',
                        background: secondaryTrades.includes(t)
                          ? 'var(--color-brand)'
                          : 'transparent',
                        color: secondaryTrades.includes(t) ? '#fff' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Service Radius (miles)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={serviceRadius}
                    onChange={e => setServiceRadius(Number(e.target.value))}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Availability
                  </label>
                  <select
                    value={availabilityStatus}
                    onChange={e => setAvailabilityStatus(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {AVAILABILITY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Available From
                  </label>
                  <input
                    type="date"
                    value={availableFrom}
                    onChange={e => setAvailableFrom(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      paddingBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Visible to Project Owners
                    </span>
                    <div
                      onClick={() => setVisibleToOwners(v => !v)}
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        cursor: 'pointer',
                        position: 'relative',
                        flexShrink: 0,
                        background: visibleToOwners ? 'var(--color-brand)' : 'var(--color-border)',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 3,
                          left: visibleToOwners ? 19 : 3,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Verification notice */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h2
              style={{
                fontFamily: 'var(--font-condensed)',
                fontWeight: 800,
                fontSize: 15,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldCheck size={14} color="var(--color-brand)" /> Licenses & Credentials
            </h2>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                marginBottom: 12,
                lineHeight: 1.6,
              }}
            >
              Manage your licenses, insurance certificates, and verification badges in Account
              Settings.
            </p>
            <Link
              to="/settings?tab=verification"
              className="btn btn-secondary"
              style={{
                fontSize: 12,
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldCheck size={12} /> Go to Verification Settings
            </Link>
          </div>
        </>
      )}

      {/* Social & Web Links */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 15,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Globe size={14} color="var(--color-brand)" /> Social &amp; Web Links
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(
            [
              {
                key: 'website',
                label: 'Website',
                placeholder: 'https://yoursite.com',
                Icon: Globe,
              },
              {
                key: 'instagram',
                label: 'Instagram',
                placeholder: 'https://instagram.com/yourhandle',
                Icon: Instagram,
              },
              {
                key: 'linkedin',
                label: 'LinkedIn',
                placeholder: 'https://linkedin.com/in/yourprofile',
                Icon: Linkedin,
              },
              {
                key: 'tiktok',
                label: 'TikTok',
                placeholder: 'https://tiktok.com/@yourhandle',
                Icon: null,
              },
              {
                key: 'facebook',
                label: 'Facebook',
                placeholder: 'https://facebook.com/yourpage',
                Icon: Facebook,
              },
              {
                key: 'youtube',
                label: 'YouTube',
                placeholder: 'https://youtube.com/@yourchannel',
                Icon: Youtube,
              },
            ] as {
              key: keyof SocialLinks
              label: string
              placeholder: string
              Icon: React.ElementType | null
            }[]
          ).map(({ key, label, placeholder, Icon }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                {Icon ? (
                  <Icon size={16} color="var(--color-text-muted)" />
                ) : (
                  <span style={{ fontSize: 14 }}>🎵</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {label}
                </label>
                <input
                  type="url"
                  value={socialLinks[key] ?? ''}
                  onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '7px 12px',
                    fontSize: 13,
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save button bottom */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Link to={`/profile/${profile.handle}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
          Cancel
        </Link>
        <button
          onClick={() => void handleSave()}
          disabled={saving || avatarUploading}
          className="btn btn-primary"
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
