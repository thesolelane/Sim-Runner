import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SignupContractor from './pages/SignupContractor'
import SignupTradeSelect from './pages/SignupTradeSelect'
import SignupOwner from './pages/SignupOwner'
import OAuthCallback from './pages/OAuthCallback'
import Onboarding from './pages/Onboarding'
import Feed from './pages/Feed'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import PostJob from './pages/PostJob'
import Explore from './pages/Explore'
import Bids from './pages/Bids'
import BidDetail from './pages/BidDetail'
import BidSubmit from './pages/BidSubmit'
import PostRFQ from './pages/PostRFQ'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import Messages from './pages/Messages'
import MessageThread from './pages/MessageThread'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import ResetPassword from './pages/ResetPassword'
import JoinDelegate from './pages/JoinDelegate'
import StaffInvite from './pages/StaffInvite'
import WalletSetup from './pages/WalletSetup'

function SubdomainRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const hostname = window.location.hostname
    const isAdminSubdomain = hostname.startsWith('admin.') || hostname === 'admin.localhost'
    if (isAdminSubdomain && !location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true })
    }
  }, [navigate, location.pathname])

  return null
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SubdomainRedirect />
        <Routes>
          {/* Public routes (redirect to /feed if logged in) */}
          <Route
            path="/"
            element={
              <ProtectedRoute publicOnly>
                <Landing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <ProtectedRoute publicOnly>
                <Login />
              </ProtectedRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <ProtectedRoute publicOnly>
                <Signup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/signup/trade-select"
            element={
              <ProtectedRoute publicOnly>
                <SignupTradeSelect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/signup/contractor"
            element={
              <ProtectedRoute publicOnly>
                <SignupContractor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/signup/owner"
            element={
              <ProtectedRoute publicOnly>
                <SignupOwner />
              </ProtectedRoute>
            }
          />

          {/* OAuth callback — handles redirect from social login providers */}
          <Route path="/auth/callback" element={<OAuthCallback />} />

          {/* Onboarding — for new OAuth users who don't have a profile yet */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Password reset — public, linked from Supabase reset email */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Feed />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Jobs />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* IMPORTANT: /jobs/post before /jobs/:id */}
          <Route
            path="/jobs/post"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PostJob />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <JobDetail />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Explore (replaces Network) */}
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Explore />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* Keep /network as redirect for any existing links */}
          <Route path="/network" element={<Navigate to="/explore" replace />} />

          {/* Bids — IMPORTANT: specific paths before dynamic :id */}
          <Route
            path="/bids"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Bids />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/post"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PostRFQ />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/new"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PostRFQ />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <BidDetail />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bids/:id/submit"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <BidSubmit />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Profile />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* /profile/edit MUST be before /profile/:handle to avoid conflict */}
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <EditProfile />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:handle"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Profile />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Messages — IMPORTANT: /messages/:threadId before /messages */}
          <Route
            path="/messages/:threadId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MessageThread />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Messages />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Notifications */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Notifications />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* /credits and /settings/credits redirect to Billing tab in Settings */}
          <Route path="/credits" element={<Navigate to="/settings?tab=billing" replace />} />
          <Route
            path="/settings/credits"
            element={<Navigate to="/settings?tab=billing" replace />}
          />

          {/* Wallet setup — contractor only, after account creation */}
          <Route
            path="/wallet-setup"
            element={
              <ProtectedRoute>
                <WalletSetup />
              </ProtectedRoute>
            }
          />

          {/* Delegate join — public, linked from invite email */}
          <Route path="/join/:token" element={<JoinDelegate />} />
          <Route path="/staff-invite/:token" element={<StaffInvite />} />

          {/* Admin dashboard — admin and admin_2 only */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
