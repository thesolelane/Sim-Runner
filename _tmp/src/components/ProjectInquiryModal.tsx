import { useState } from 'react'
import { X, FileText, AlertCircle, Coins } from 'lucide-react'

const TRADE_OPTIONS = [
  'Carpentry',
  'Concrete',
  'Design Professional',
  'Drywall',
  'Electrical',
  'Engineering',
  'General Contractor',
  'Glazier',
  'HVAC',
  'Insulation',
  'Landscaping',
  'Masonry',
  'Painting',
  'Plumbing',
  'Roofing',
  'Steel / Ironwork',
  'Tile',
  'Other',
]

const PROPERTY_TYPES = ['Residential', 'Commercial', 'Multi-family', 'Industrial', 'Mixed-use']

const TIMELINES = ['ASAP', '1–2 weeks', '1 month', '2–3 months', 'Planning ahead (3 months+)']

const BUDGETS = [
  'Under $2,000',
  '$2,000–$5,000',
  '$5,000–$10,000',
  '$10,000–$25,000',
  '$25,000–$50,000',
  '$50,000–$100,000',
  '$100,000+',
  'TBD / Open to quotes',
]

interface Props {
  contractorName: string
  creditCost: number
  creditBalance: number
  onSubmit: (body: string) => Promise<void>
  onCancel: () => void
}

interface FormState {
  tradeType: string
  propertyType: string
  location: string
  timeline: string
  budget: string
  description: string
}

const EMPTY: FormState = {
  tradeType: '',
  propertyType: '',
  location: '',
  timeline: '',
  budget: '',
  description: '',
}

function buildMessage(f: FormState, senderName: string): string {
  return [
    '📋 PROJECT INQUIRY',
    '─────────────────────────',
    `Trade needed : ${f.tradeType}`,
    `Property type: ${f.propertyType}`,
    `Location     : ${f.location}`,
    `Timeline     : ${f.timeline}`,
    `Budget range : ${f.budget}`,
    '',
    'Project details:',
    f.description.trim(),
    '',
    `— ${senderName} via TraydBook`,
  ].join('\n')
}

export default function ProjectInquiryModal({
  contractorName,
  creditCost,
  creditBalance,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [step, setStep] = useState<'form' | 'preview'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof FormState, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const filled =
    form.tradeType &&
    form.propertyType &&
    form.location &&
    form.timeline &&
    form.budget &&
    form.description.trim().length >= 80

  async function handleSend() {
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(buildMessage(form, 'me'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const notEnough = creditBalance < creditCost

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} color="var(--color-brand)" />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: '0.3px',
                  color: 'var(--color-text)',
                }}
              >
                Project Inquiry
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Sending to {contractorName}
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Credit notice */}
        <div
          style={{
            margin: '16px 24px 0',
            background: notEnough ? 'rgba(220,38,38,0.08)' : 'var(--color-brand-light)',
            border: `1px solid ${notEnough ? 'rgba(220,38,38,0.25)' : 'rgba(232,93,4,0.25)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: notEnough ? '#DC2626' : 'var(--color-brand)',
          }}
        >
          <Coins size={14} style={{ flexShrink: 0 }} />
          {notEnough
            ? `You need ${creditCost} credits to send — you have ${creditBalance}. Buy credits first.`
            : `Sending this inquiry costs ${creditCost} credits. You have ${creditBalance}.`}
        </div>

        {step === 'form' ? (
          <div style={{ padding: '20px 24px 24px' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Trade type */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>Trade / Work needed *</span>
                <select
                  value={form.tradeType}
                  onChange={e => set('tradeType', e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select trade…</option>
                  {TRADE_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              {/* Property type + Location side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>Property type *</span>
                  <select
                    value={form.propertyType}
                    onChange={e => set('propertyType', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select…</option>
                    {PROPERTY_TYPES.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>Project location *</span>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => set('location', e.target.value)}
                    placeholder="City, State"
                    style={inputStyle}
                  />
                </label>
              </div>

              {/* Timeline + Budget side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>Start timeline *</span>
                  <select
                    value={form.timeline}
                    onChange={e => set('timeline', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select…</option>
                    {TIMELINES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>Budget range *</span>
                  <select
                    value={form.budget}
                    onChange={e => set('budget', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select…</option>
                    {BUDGETS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Description */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>
                  Project details *{' '}
                  <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                    (min 20 chars)
                  </span>
                </span>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Describe the scope of work, any special requirements, site access, materials preferences, etc."
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: form.description.length >= 80 ? 'var(--color-text-muted)' : '#DC2626',
                    textAlign: 'right',
                  }}
                >
                  {form.description.length} / 80 min
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={onCancel} style={btnGhost}>
                Cancel
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!filled || notEnough}
                className="btn btn-primary"
                style={{ opacity: !filled || notEnough ? 0.5 : 1 }}
              >
                Preview message →
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 24px 24px' }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              This is exactly what {contractorName} will receive:
            </p>
            <pre
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                lineHeight: 1.7,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              {buildMessage(form, 'you')}
            </pre>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.25)',
                  borderRadius: 8,
                  padding: '9px 13px',
                  fontSize: 13,
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('form')} style={btnGhost}>
                ← Edit
              </button>
              <button
                onClick={handleSend}
                disabled={submitting || notEnough}
                className="btn btn-primary"
                style={{ opacity: submitting || notEnough ? 0.5 : 1 }}
              >
                {submitting ? 'Sending…' : `Send · ${creditCost} credits`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-condensed)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 12px',
  fontSize: 14,
  color: 'var(--color-text)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 18px',
  fontSize: 13,
  fontFamily: 'var(--font-condensed)',
  fontWeight: 600,
  cursor: 'pointer',
  color: 'var(--color-text)',
}
