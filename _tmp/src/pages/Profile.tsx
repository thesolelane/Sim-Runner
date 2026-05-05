import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin,
  Star,
  CheckCircle,
  Edit2,
  UserPlus,
  MessageSquare,
  Bookmark,
  Briefcase,
  Award,
  Calendar,
  Shield,
  Clock,
  ChevronRight,
  Loader,
  AlertCircle,
  ExternalLink,
  ThumbsUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PostCard from '../components/PostCard'
import { AuthorAvatar } from '../components/PostCard'
import { FeedPost } from '../types/feed'
import {
  ProfileUser,
  ContractorProfile,
  Credential,
  PortfolioProject,
  ProfileReview,
  ConnectionStatus,
  ProfileTab,
  SocialLinks,
} from '../types/profile'
import VerifiedBadge from '../components/VerifiedBadge'
import { safeExternalUrl } from '../lib/urlUtils'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={13} color="#D97706" fill={rating >= i ? '#D97706' : 'none'} />
      ))}
    </span>
  )
}

function AvailabilityBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    available: { label: 'Available', color: '#059669' },
    busy: { label: 'Busy', color: '#D97706' },
    not_available: { label: 'Not Available', color: '#DC2626' },
  }
  const s = map[status] ?? { label: status, color: 'var(--color-text-muted)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color: s.color,
        background: s.color + '18',
        borderRadius: 12,
        padding: '2px 8px',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

function CredentialStatusBadge({
  status,
  verified_at,
}: {
  status: string
  verified_at: string | null
}) {
  if (verified_at) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 10,
          fontWeight: 700,
          color: '#059669',
          background: '#05966918',
          borderRadius: 10,
          padding: '2px 7px',
        }}
      >
        <CheckCircle size={10} /> Verified
      </span>
    )
  }
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: '#2563EB' },
    pending: { label: 'Pending Review', color: '#D97706' },
    expired: { label: 'Expired', color: '#DC2626' },
  }
  const s = map[status] ?? { label: status, color: 'var(--color-text-muted)' }
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: s.color,
        background: s.color + '18',
        borderRadius: 10,
        padding: '2px 7px',
      }}
    >
      {s.label}
    </span>
  )
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div
        style={{
          fontFamily: 'var(--font-condensed)',
          fontWeight: 800,
          fontSize: 22,
          color: 'var(--color-text)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{label}</div>
    </div>
  )
}

function SkeletonProfile() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="feed-skeleton" style={{ height: 100, borderRadius: 0 }} />
        <div style={{ padding: '0 28px 28px', marginTop: -36 }}>
          <div className="feed-skeleton" style={{ width: 80, height: 80, borderRadius: 8 }} />
          <div style={{ marginTop: 12 }}>
            <div className="feed-skeleton" style={{ height: 20, width: '30%', marginBottom: 8 }} />
            <div className="feed-skeleton" style={{ height: 13, width: '20%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { handle: urlHandle } = useParams<{ handle: string }>()
  const { profile: authProfile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [user, setUser] = useState<ProfileUser | null>(null)
  const [cp, setCp] = useState<ContractorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isOwn, setIsOwn] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [hasVerifiedCredential, setHasVerifiedCredential] = useState(false)
  const [vouchLoading, setVouchLoading] = useState(false)
  const [alreadyVouched, setAlreadyVouched] = useState(false)
  const [authIsPro, setAuthIsPro] = useState(false)
  const [messageToast, setMessageToast] = useState<string | null>(null)

  const [networkCount, setNetworkCount] = useState<number>(0)
  const [activeBidsCount, setActiveBidsCount] = useState<number>(0)
  const [referralsCount, setReferralsCount] = useState<number>(0)
  const [coverPhotos, setCoverPhotos] = useState<string[]>([])

  const [activeTab, setActiveTab] = useState<ProfileTab>('feed')
  const loadedTabs = useRef<Set<ProfileTab>>(new Set())

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())

  const [projects, setProjects] = useState<PortfolioProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  const [jobListings, setJobListings] = useState<Record<string, unknown>[]>([])
  const [bids, setBids] = useState<Record<string, unknown>[]>([])
  const [bidsJobsLoading, setBidsJobsLoading] = useState(false)
  const [canViewBidsJobs, setCanViewBidsJobs] = useState(false)

  const [reviews, setReviews] = useState<ProfileReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [credentialsLoading, setCredentialsLoading] = useState(false)

  useEffect(() => {
    const handle = urlHandle ?? authProfile?.handle
    if (!handle) return
    void loadProfile(handle)
  }, [urlHandle, authProfile])

  useEffect(() => {
    if (!user) return
    void loadTab(activeTab)
  }, [activeTab, user])

  async function loadProfile(handle: string) {
    setLoading(true)
    setNotFound(false)
    // Reset all tab-level state so a new handle never inherits stale data
    loadedTabs.current = new Set()
    setActiveTab('feed')
    setCp(null)
    setUser(null)
    setConnectionStatus('none')
    setConnectionId(null)
    setIsBookmarked(false)
    setHasVerifiedCredential(false)
    setAlreadyVouched(false)
    setAuthIsPro(false)
    setNetworkCount(0)
    setActiveBidsCount(0)
    setReferralsCount(0)
    setCoverPhotos([])
    setFeedPosts([])
    setProjects([])
    setJobListings([])
    setBids([])
    setReviews([])
    setCredentials([])

    const { data: userData, error } = await supabase
      .from('users')
      .select(
        'id, display_name, handle, avatar_url, account_type, location_city, location_state, location_zip, credit_balance, social_links, created_at, is_delegate'
      )
      .eq('handle', handle)
      .is('deleted_at', null)
      .single()

    if (error || !userData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    if ((userData as { is_delegate?: boolean }).is_delegate) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const u = userData as ProfileUser
    setUser(u)
    setIsOwn(u.id === authProfile?.id)

    await Promise.all([loadContractorProfile(u), loadConnectionStatus(u.id), loadStats(u.id)])

    setLoading(false)
    void loadTab('feed')
  }

  async function loadContractorProfile(u: ProfileUser) {
    if (u.account_type !== 'contractor') return
    const { data } = await supabase
      .from('contractor_profiles')
      .select(
        'id, user_id, business_name, primary_trade, secondary_trades, years_experience, bio, service_radius_miles, availability_status, available_from, visible_to_owners, rating_avg, rating_count, projects_completed, total_work_value, badge_tier'
      )
      .eq('user_id', u.id)
      .single()
    if (data) {
      setCp(data as ContractorProfile)
      void loadCoverPhotos((data as ContractorProfile).id)
      void checkVerifiedCredential((data as ContractorProfile).id)
      void checkAlreadyVouched((data as ContractorProfile).id)
    }
  }

  async function checkAlreadyVouched(targetCpId: string) {
    if (!authProfile || authProfile.account_type !== 'contractor') return
    const { data: authCp } = await supabase
      .from('contractor_profiles')
      .select('id, badge_tier')
      .eq('user_id', authProfile.id)
      .single()
    if (!authCp || authCp.badge_tier !== 'pro_verified') return
    setAuthIsPro(true)
    const { count } = await supabase
      .from('vouches')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_id', authCp.id)
      .eq('vouchee_id', targetCpId)
    setAlreadyVouched((count ?? 0) > 0)
  }

  async function handleVouch() {
    if (!authProfile || !cp) return
    setVouchLoading(true)
    try {
      const { data: authCp } = await supabase
        .from('contractor_profiles')
        .select('id')
        .eq('user_id', authProfile.id)
        .single()
      if (!authCp) throw new Error('Could not load your profile.')
      const { error } = await supabase.from('vouches').insert({
        voucher_id: authCp.id,
        vouchee_id: cp.id,
      })
      if (error) throw new Error(error.message)
      setAlreadyVouched(true)
      setMessageToast('Vouch submitted!')
      setTimeout(() => setMessageToast(null), 3000)
    } catch (err) {
      setMessageToast(err instanceof Error ? err.message : 'Failed to vouch.')
      setTimeout(() => setMessageToast(null), 3000)
    } finally {
      setVouchLoading(false)
    }
  }

  async function loadConnectionStatus(targetId: string) {
    if (!authProfile || targetId === authProfile.id) return
    const { data } = await supabase
      .from('connections')
      .select('id, requester_id, recipient_id, status')
      .or(
        `and(requester_id.eq.${authProfile.id},recipient_id.eq.${targetId}),and(requester_id.eq.${targetId},recipient_id.eq.${authProfile.id})`
      )
      .maybeSingle()

    if (!data) {
      setConnectionStatus('none')
      return
    }
    const row = data as { id: string; requester_id: string; status: string }
    setConnectionId(row.id)
    if (row.status === 'accepted') setConnectionStatus('connected')
    else if (row.status === 'pending') {
      setConnectionStatus(row.requester_id === authProfile.id ? 'pending_sent' : 'pending_received')
    }
  }

  async function loadStats(userId: string) {
    const [{ count: nc }, { count: bc }, { count: rc }] = await Promise.all([
      supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .eq('status', 'accepted'),
      supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('bidder_id', userId)
        .in('status', ['pending', 'under_review']),
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
        .eq('post_type', 'referral'),
    ])
    setNetworkCount(nc ?? 0)
    setActiveBidsCount(bc ?? 0)
    setReferralsCount(rc ?? 0)
  }

  async function loadCoverPhotos(cpId: string) {
    const { data } = await supabase
      .from('projects')
      .select('photo_urls')
      .eq('contractor_id', cpId)
      .eq('is_featured', true)
      .limit(3)
    if (data) {
      const urls = (data as { photo_urls: string[] }[]).flatMap(p => p.photo_urls).slice(0, 3)
      setCoverPhotos(urls)
    }
  }

  async function checkVerifiedCredential(cpId: string) {
    const { count } = await supabase
      .from('credentials')
      .select('*', { count: 'exact', head: true })
      .eq('contractor_id', cpId)
      .eq('status', 'active')
      .not('verified_at', 'is', null)
    setHasVerifiedCredential((count ?? 0) > 0)
  }

  async function loadTab(tab: ProfileTab) {
    if (!user) return
    if (loadedTabs.current.has(tab)) return
    loadedTabs.current.add(tab)

    if (tab === 'feed') {
      setFeedLoading(true)
      const { data } = await supabase
        .from('posts')
        .select(
          `id, post_type, body, media_urls, hashtags, like_count, comment_count, share_count,
          is_urgent, is_boosted, created_at, author_id,
          users!author_id (display_name, handle, avatar_url, account_type)`
        )
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) {
        setFeedPosts(
          data.map((row: Record<string, unknown>) => {
            const u = row.users as unknown as {
              display_name: string
              handle: string
              avatar_url: string | null
              account_type: string
            } | null
            return {
              id: row.id as string,
              post_type: row.post_type as FeedPost['post_type'],
              body: row.body as string,
              media_urls: (row.media_urls as string[]) ?? [],
              hashtags: (row.hashtags as string[]) ?? [],
              like_count: row.like_count as number,
              comment_count: row.comment_count as number,
              share_count: row.share_count as number,
              is_urgent: row.is_urgent as boolean,
              is_boosted: row.is_boosted as boolean,
              created_at: row.created_at as string,
              author_id: row.author_id as string,
              tagged_user_id: null,
              linked_job_id: null,
              linked_rfq_id: null,
              author_name: u?.display_name ?? user.display_name,
              author_handle: u?.handle ?? user.handle,
              author_avatar: u?.avatar_url ?? user.avatar_url,
              author_account_type: u?.account_type ?? user.account_type,
              author_trade: cp?.primary_trade ?? null,
              author_verified: hasVerifiedCredential,
            }
          })
        )
      }
      setFeedLoading(false)
    }

    if (tab === 'portfolio' && cp) {
      setProjectsLoading(true)
      const { data } = await supabase
        .from('projects')
        .select(
          'id, contractor_id, title, description, trade_tags, photo_urls, completed_date, is_featured, created_at'
        )
        .eq('contractor_id', cp.id)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
      if (data) setProjects(data as PortfolioProject[])
      setProjectsLoading(false)
    }

    if (tab === 'bids') {
      const canView =
        isOwn || (authProfile?.account_type === 'contractor' && connectionStatus === 'connected')
      setCanViewBidsJobs(canView)
      if (!canView) {
        loadedTabs.current.delete(tab)
        return
      }
      setBidsJobsLoading(true)
      const [{ data: jobs }, { data: bidsData }] = await Promise.all([
        supabase
          .from('job_listings')
          .select(
            'id, title, trade_required, job_type, location_city, location_state, pay_min, pay_max, pay_unit, is_urgent, status, created_at'
          )
          .eq('poster_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        cp
          ? supabase
              .from('bids')
              .select('id, rfq_id, amount, status, submitted_at, rfqs!rfq_id (title)')
              .eq('bidder_id', user.id)
              .order('submitted_at', { ascending: false })
              .limit(10)
          : { data: [] },
      ])
      setJobListings((jobs ?? []) as Record<string, unknown>[])
      setBids((bidsData ?? []) as Record<string, unknown>[])
      setBidsJobsLoading(false)
    }

    if (tab === 'reviews') {
      setReviewsLoading(true)
      const { data } = await supabase
        .from('reviews')
        .select(
          `id, reviewer_id, reviewee_id, rating, body, verified_job, created_at,
          users!reviewer_id (display_name, handle, avatar_url)`
        )
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false })
      if (data) {
        setReviews(
          data.map((r: Record<string, unknown>) => {
            const rv = r.users as unknown as {
              display_name: string
              handle: string
              avatar_url: string | null
            } | null
            return {
              id: r.id as string,
              reviewer_id: r.reviewer_id as string,
              reviewee_id: r.reviewee_id as string,
              rating: r.rating as number,
              body: r.body as string,
              verified_job: r.verified_job as boolean,
              created_at: r.created_at as string,
              reviewer_name: rv?.display_name ?? 'Anonymous',
              reviewer_handle: rv?.handle ?? '',
              reviewer_avatar: rv?.avatar_url ?? null,
            }
          })
        )
      }
      setReviewsLoading(false)
    }

    if (tab === 'about' && cp) {
      setCredentialsLoading(true)
      const { data } = await supabase
        .from('credentials')
        .select(
          'id, contractor_id, credential_type, masked_display, issuing_state, expiry_date, verified_at, status, created_at'
        )
        .eq('contractor_id', cp.id)
        .order('created_at', { ascending: false })
      if (data) setCredentials(data as Credential[])
      setCredentialsLoading(false)
    }
  }

  async function handleConnect() {
    if (!authProfile || !user) return
    setConnectLoading(true)
    if (connectionStatus === 'none') {
      const { data } = await supabase
        .from('connections')
        .insert({ requester_id: authProfile.id, recipient_id: user.id, status: 'pending' })
        .select('id')
        .single()
      if (data) {
        setConnectionId((data as { id: string }).id)
        setConnectionStatus('pending_sent')
      }
    } else if (connectionStatus === 'pending_received' && connectionId) {
      await supabase.from('connections').update({ status: 'accepted' }).eq('id', connectionId)
      setConnectionStatus('connected')
    }
    setConnectLoading(false)
  }

  async function handleMessageClick() {
    if (!authProfile || !user) return
    const threadId = [authProfile.id, user.id].sort().join('_')
    const isColdMessage =
      connectionStatus !== 'connected' && authProfile.account_type !== 'contractor'
    const COLD_MESSAGE_COST = 3

    if (isColdMessage) {
      if ((authProfile.credit_balance ?? 0) < COLD_MESSAGE_COST) {
        setMessageToast(
          `Insufficient credits — you need ${COLD_MESSAGE_COST} to send a cold message (you have ${authProfile.credit_balance ?? 0}).`
        )
        setTimeout(() => setMessageToast(null), 5000)
        return
      }
      const { error: creditErr } = await supabase
        .from('users')
        .update({ credit_balance: (authProfile.credit_balance ?? 0) - COLD_MESSAGE_COST })
        .eq('id', authProfile.id)
      if (creditErr) {
        setMessageToast('Credit deduction failed — please try again.')
        setTimeout(() => setMessageToast(null), 3000)
        return
      }
      if (refreshProfile) await refreshProfile()
    }

    navigate(`/messages/${threadId}`)
  }

  function handleLikeToggle(postId: string, wasLiked: boolean) {
    setLikedPosts(prev => {
      const next = new Set(prev)
      if (wasLiked) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  if (loading) return <SkeletonProfile />
  if (notFound || !user) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <AlertCircle size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontFamily: 'var(--font-condensed)', fontSize: 22, fontWeight: 800 }}>
          Profile Not Found
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 8, fontSize: 14 }}>
          No user found with that handle.
        </p>
        <button
          onClick={() => navigate('/feed')}
          className="btn btn-primary"
          style={{ marginTop: 20 }}
        >
          Back to Feed
        </button>
      </div>
    )
  }

  const isContractor = user.account_type === 'contractor'
  const displayLocation = [user.location_city, user.location_state].filter(Boolean).join(', ')
  const avgRating = cp?.rating_avg ?? 0
  const ratingCount = cp?.rating_count ?? 0

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'feed', label: 'Posts' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'bids', label: 'Bids & Jobs' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'about', label: 'About' },
  ]

  const connectLabel = connectLoading
    ? '...'
    : connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'pending_sent'
        ? 'Request Sent'
        : connectionStatus === 'pending_received'
          ? 'Accept Request'
          : 'Connect'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      {/* Toast notification */}
      {messageToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: '3px solid var(--color-brand)',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            zIndex: 2000,
            whiteSpace: 'nowrap',
            maxWidth: '90vw',
          }}
        >
          {messageToast}
        </div>
      )}

      {/* PROFILE HEADER CARD */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        {/* Cover strip */}
        <div
          style={{
            height: 96,
            position: 'relative',
            overflow: 'hidden',
            background:
              coverPhotos.length > 0
                ? `url(${coverPhotos[0]}) center/cover no-repeat`
                : 'linear-gradient(135deg, var(--color-brand) 0%, #C44D00 60%, #2E3033 100%)',
          }}
        >
          {coverPhotos.length > 1 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 2 }}>
              {coverPhotos.map((url, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: `url(${url}) center/cover no-repeat`,
                    opacity: i === 0 ? 0 : 1,
                  }}
                />
              ))}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4))',
            }}
          />
        </div>

        <div style={{ padding: '0 28px 24px' }}>
          {/* Avatar row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: -36,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    objectFit: 'cover',
                    border: '3px solid var(--color-surface)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    background: 'var(--color-brand)',
                    border: '3px solid var(--color-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 26,
                    fontWeight: 800,
                    color: '#fff',
                  }}
                >
                  {user.display_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              {isContractor && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    background: 'var(--color-brand)',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--color-surface)',
                  }}
                >
                  <Briefcase size={10} color="#fff" />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {isOwn ? (
                <Link
                  to="/profile/edit"
                  className="btn btn-secondary"
                  style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Edit2 size={13} /> Edit Profile
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => void handleConnect()}
                    disabled={
                      connectLoading ||
                      connectionStatus === 'pending_sent' ||
                      connectionStatus === 'connected'
                    }
                    className={
                      connectionStatus === 'connected' ? 'btn btn-secondary' : 'btn btn-primary'
                    }
                    style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {connectLoading ? (
                      <Loader size={13} className="spin" />
                    ) : (
                      <UserPlus size={13} />
                    )}
                    {connectLabel}
                  </button>
                  <button
                    onClick={() => void handleMessageClick()}
                    className="btn btn-secondary"
                    style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                    title={
                      connectionStatus !== 'connected' && authProfile?.account_type !== 'contractor'
                        ? 'Costs 3 credits'
                        : 'Send a message'
                    }
                  >
                    <MessageSquare size={13} /> Message
                    {connectionStatus !== 'connected' &&
                      authProfile?.account_type !== 'contractor' && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            background: 'var(--color-brand)',
                            color: '#fff',
                            borderRadius: 10,
                            padding: '1px 5px',
                          }}
                        >
                          3cr
                        </span>
                      )}
                  </button>
                  {authIsPro && isContractor && !isOwn && cp?.badge_tier !== 'pro_verified' && (
                    <button
                      onClick={() => void handleVouch()}
                      disabled={vouchLoading || alreadyVouched}
                      className="btn btn-ghost"
                      style={{
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: alreadyVouched ? '#059669' : 'var(--color-text-muted)',
                      }}
                      title={
                        alreadyVouched
                          ? 'You already vouched for this contractor'
                          : 'Vouch for this contractor'
                      }
                    >
                      <ThumbsUp size={13} fill={alreadyVouched ? '#059669' : 'none'} />
                      {alreadyVouched ? 'Vouched' : 'Vouch'}
                    </button>
                  )}
                  <button
                    onClick={() => setIsBookmarked(b => !b)}
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 13 }}
                    title={isBookmarked ? 'Saved' : 'Save profile'}
                  >
                    <Bookmark
                      size={14}
                      fill={isBookmarked ? 'var(--color-brand)' : 'none'}
                      color={isBookmarked ? 'var(--color-brand)' : 'currentColor'}
                    />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name + badges row */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontWeight: 800,
                  fontSize: 24,
                  letterSpacing: '-0.3px',
                }}
              >
                {user.display_name}
              </h1>
              {isContractor && cp && cp.badge_tier && (
                <VerifiedBadge tier={cp.badge_tier} size="md" />
              )}
              {isContractor && cp && (
                <span className="badge badge-brand" style={{ fontSize: 12 }}>
                  {cp.primary_trade}
                </span>
              )}
              {isContractor &&
                cp &&
                cp.secondary_trades.slice(0, 2).map(t => (
                  <span key={t} className="tag" style={{ fontSize: 11, padding: '2px 8px' }}>
                    {t}
                  </span>
                ))}
            </div>

            {cp?.business_name && (
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {cp.business_name}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                gap: 16,
                marginTop: 6,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {displayLocation && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <MapPin size={11} /> {displayLocation}
                </span>
              )}
              {ratingCount > 0 && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: '#D97706',
                    fontWeight: 600,
                  }}
                >
                  <StarRating rating={avgRating} />
                  {avgRating.toFixed(1)} ({ratingCount} reviews)
                </span>
              )}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                }}
              >
                <Calendar size={11} /> Member since {memberSince(user.created_at)}
              </span>
              {isContractor && cp && <AvailabilityBadge status={cp.availability_status} />}
            </div>
          </div>

          {/* Social links */}
          {user.social_links &&
            Object.values(user.social_links).some(Boolean) &&
            (() => {
              const links = user.social_links as SocialLinks
              const SOCIAL_DEFS: { key: keyof SocialLinks; label: string; emoji: string }[] = [
                { key: 'website', label: 'Website', emoji: '🌐' },
                { key: 'instagram', label: 'Instagram', emoji: '📸' },
                { key: 'linkedin', label: 'LinkedIn', emoji: '💼' },
                { key: 'tiktok', label: 'TikTok', emoji: '🎵' },
                { key: 'facebook', label: 'Facebook', emoji: '👥' },
                { key: 'youtube', label: 'YouTube', emoji: '▶️' },
              ]
              const visibleLinks = SOCIAL_DEFS.map(({ key, label, emoji }) => ({
                key,
                label,
                emoji,
                href: safeExternalUrl(links[key]),
              })).filter(({ href }) => href !== null)
              if (visibleLinks.length === 0) return null
              return (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {visibleLinks.map(({ key, label, emoji, href }) => (
                    <a
                      key={key}
                      href={href as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 20,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-muted)',
                        textDecoration: 'none',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                    >
                      <span>{emoji}</span> {label}
                    </a>
                  ))}
                </div>
              )
            })()}

          {/* Stats bar */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {isContractor && cp && <StatBox value={cp.projects_completed} label="Projects Done" />}
            <StatBox value={networkCount} label="Connections" />
            {isContractor && <StatBox value={activeBidsCount} label="Active Bids" />}
            <StatBox value={referralsCount} label="Referrals Given" />
            {isContractor && cp && (
              <StatBox value={`${cp.years_experience}yr`} label="Experience" />
            )}
          </div>
        </div>
      </div>

      {/* TAB NAV */}
      <div className="card" style={{ padding: '0 20px', marginBottom: 16, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(tab => {
            if (!isContractor && tab.key === 'portfolio') return null
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '14px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-condensed)',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  color: activeTab === tab.key ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  borderBottom:
                    activeTab === tab.key
                      ? '2px solid var(--color-brand)'
                      : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* TAB CONTENT */}

      {activeTab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {feedLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : feedPosts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No posts yet.</p>
            </div>
          ) : (
            feedPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                likedPosts={likedPosts}
                onLikeToggle={handleLikeToggle}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'portfolio' && isContractor && (
        <div>
          {projectsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : projects.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                No portfolio projects yet.
              </p>
              {isOwn && (
                <Link
                  to="/profile/edit"
                  className="btn btn-primary"
                  style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ExternalLink size={13} /> Add Portfolio Projects
                </Link>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 14,
              }}
            >
              {projects.map(proj => (
                <div key={proj.id}>
                  <div
                    className="card"
                    style={{
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border:
                        expandedProject === proj.id
                          ? '2px solid var(--color-brand)'
                          : '1.5px solid var(--color-border)',
                    }}
                    onClick={() => setExpandedProject(expandedProject === proj.id ? null : proj.id)}
                  >
                    <div
                      style={{
                        height: 160,
                        background: proj.photo_urls[0]
                          ? `url(${proj.photo_urls[0]}) center/cover no-repeat`
                          : 'linear-gradient(135deg, var(--color-brand) 0%, #C44D00 100%)',
                        position: 'relative',
                      }}
                    >
                      {proj.is_featured && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'var(--color-brand)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 10,
                            padding: '2px 8px',
                          }}
                        >
                          Featured
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <p style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{proj.title}</p>
                        <ChevronRight
                          size={14}
                          color="var(--color-text-muted)"
                          style={{
                            transform: expandedProject === proj.id ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.2s',
                            flexShrink: 0,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {proj.trade_tags.slice(0, 3).map(t => (
                          <span
                            key={t}
                            className="tag"
                            style={{ fontSize: 10, padding: '1px 6px' }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {proj.completed_date && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Completed{' '}
                          {new Date(proj.completed_date).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  {expandedProject === proj.id && (
                    <div
                      className="card"
                      style={{
                        padding: 16,
                        marginTop: 4,
                        borderTop: '2px solid var(--color-brand)',
                      }}
                    >
                      {proj.description && (
                        <p
                          style={{
                            fontSize: 13,
                            lineHeight: 1.65,
                            color: 'var(--color-text-muted)',
                            marginBottom: 12,
                          }}
                        >
                          {proj.description}
                        </p>
                      )}
                      {proj.photo_urls.length > 1 && (
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                          {proj.photo_urls.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`${proj.title} ${i + 1}`}
                              style={{
                                height: 80,
                                width: 120,
                                objectFit: 'cover',
                                borderRadius: 4,
                                flexShrink: 0,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bids' && (
        <div>
          {!canViewBidsJobs ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Shield size={32} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Private</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                Bids & Jobs are only visible to the profile owner and connected contractors.
              </p>
            </div>
          ) : bidsJobsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {jobListings.length > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontWeight: 800,
                      fontSize: 15,
                      marginBottom: 12,
                    }}
                  >
                    Posted Jobs
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {jobListings.map(job => (
                      <div
                        key={job.id as string}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{job.title as string}</p>
                          <p
                            style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}
                          >
                            {[job.trade_required as string, job.job_type as string].join(' · ')} ·{' '}
                            {[job.location_city as string, job.location_state as string]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: job.status === 'open' ? '#059669' : 'var(--color-text-muted)',
                            background: job.status === 'open' ? '#05966918' : 'var(--color-bg)',
                            borderRadius: 10,
                            padding: '2px 8px',
                          }}
                        >
                          {job.status as string}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bids.length > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontWeight: 800,
                      fontSize: 15,
                      marginBottom: 12,
                    }}
                  >
                    Submitted Bids
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {bids.map(bid => {
                      const rfq = bid.rfqs as unknown as { title: string } | null
                      const statusColor: Record<string, string> = {
                        pending: '#D97706',
                        under_review: '#2563EB',
                        awarded: '#059669',
                        not_awarded: '#DC2626',
                      }
                      return (
                        <div
                          key={bid.id as string}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 13 }}>{rfq?.title ?? 'RFQ'}</p>
                            <p
                              style={{
                                fontSize: 11,
                                color: 'var(--color-text-muted)',
                                marginTop: 2,
                              }}
                            >
                              ${(bid.amount as number).toLocaleString()} ·{' '}
                              {timeAgo(bid.submitted_at as string)}
                            </p>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              color: statusColor[bid.status as string] ?? 'var(--color-text-muted)',
                              background: (statusColor[bid.status as string] ?? '#888') + '18',
                              borderRadius: 10,
                              padding: '2px 8px',
                            }}
                          >
                            {(bid.status as string).replace('_', ' ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {jobListings.length === 0 && bids.length === 0 && (
                <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    No bids or jobs yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviewsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <Loader
                size={20}
                className="spin"
                style={{ margin: '0 auto', color: 'var(--color-text-muted)' }}
              />
            </div>
          ) : reviews.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No reviews yet.</p>
            </div>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <AuthorAvatar
                    name={review.reviewer_name}
                    avatar={review.reviewer_avatar}
                    size={40}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <div>
                        <Link
                          to={`/profile/${review.reviewer_handle}`}
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: 'none',
                            color: 'var(--color-text)',
                          }}
                        >
                          {review.reviewer_name}
                        </Link>
                        {review.reviewer_handle && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-muted)',
                              marginLeft: 4,
                            }}
                          >
                            @{review.reviewer_handle}
                          </span>
                        )}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}
                        >
                          <StarRating rating={review.rating} />
                          {review.verified_job && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#059669',
                                background: '#05966918',
                                borderRadius: 10,
                                padding: '1px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <CheckCircle size={9} /> Verified Job
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {timeAgo(review.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: 'var(--color-text)',
                        marginTop: 8,
                      }}
                    >
                      {review.body}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div
          className="profile-about-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cp?.bio && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-condensed)',
                    fontWeight: 800,
                    fontSize: 15,
                    marginBottom: 10,
                  }}
                >
                  About
                </h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
                  {cp.bio}
                </p>
              </div>
            )}

            {isContractor && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <h3
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
                  <Award size={14} color="var(--color-brand)" /> Credentials & Licenses
                </h3>
                {credentialsLoading ? (
                  <Loader size={16} className="spin" style={{ color: 'var(--color-text-muted)' }} />
                ) : credentials.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    No credentials on file.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {isOwn && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          background: 'var(--color-bg)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}
                      >
                        <Shield
                          size={12}
                          style={{ marginTop: 1, flexShrink: 0, color: 'var(--color-brand)' }}
                        />
                        Only the masked reference is stored publicly. Full credentials are held
                        offline and verified by the TraydBook team. Non-owners never see beyond the
                        masked version.
                      </div>
                    )}
                    {credentials.map(cred => (
                      <div
                        key={cred.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          padding: '12px 0',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontWeight: 700, fontSize: 13 }}>{cred.credential_type}</p>
                            <CredentialStatusBadge
                              status={cred.status}
                              verified_at={cred.verified_at}
                            />
                          </div>
                          <p
                            style={{
                              fontSize: 12,
                              color: 'var(--color-brand)',
                              fontFamily: 'monospace',
                              marginTop: 3,
                              letterSpacing: '0.5px',
                            }}
                          >
                            {cred.masked_display}
                          </p>
                          <p
                            style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}
                          >
                            {[
                              cred.issuing_state,
                              cred.expiry_date
                                ? `Expires ${new Date(cred.expiry_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {isOwn && !cred.verified_at && (
                            <p style={{ fontSize: 11, color: '#D97706', marginTop: 3 }}>
                              Awaiting admin verification
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isOwn && (
                  <Link
                    to="/profile/edit"
                    className="btn btn-secondary"
                    style={{
                      marginTop: 14,
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Award size={12} /> Manage Credentials
                  </Link>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isContractor && cp && (
              <>
                <div className="card" style={{ padding: '14px 16px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontWeight: 800,
                      fontSize: 13,
                      marginBottom: 12,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Availability
                  </h3>
                  <AvailabilityBadge status={cp.availability_status} />
                  {cp.available_from && (
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Clock size={11} /> Available from{' '}
                      {new Date(cp.available_from).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                  {cp.service_radius_miles > 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        marginTop: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <MapPin size={11} /> {cp.service_radius_miles} mile service radius
                    </p>
                  )}
                </div>

                <div className="card" style={{ padding: '14px 16px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-condensed)',
                      fontWeight: 800,
                      fontSize: 13,
                      marginBottom: 12,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Trades
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className="badge badge-brand" style={{ fontSize: 11 }}>
                      {cp.primary_trade}
                    </span>
                    {cp.secondary_trades.map(t => (
                      <span key={t} className="tag" style={{ fontSize: 11, padding: '2px 8px' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <style>{`
            @media (max-width: 700px) {
              .profile-about-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
