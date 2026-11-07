import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PackagePlus,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { gsap, prefersReducedMotion } from '../lib/motion'
import {
  adjustInventory,
  checkSystemHealth,
  claimInitialAdmin,
  deleteCategory,
  deleteOrder,
  deleteProduct,
  deleteReview,
  getActivityLogs,
  getAdminReviews,
  getCategories,
  getDailyActivity,
  getDashboardSummary,
  getEffectiveStock,
  getInventoryMovements,
  getNotifications,
  getOrders,
  getProductPerformance,
  getProducts,
  getRecentOrders,
  markAllNotificationsRead,
  saveCategory,
  saveOrder,
  saveProduct,
  saveStoreSettings,
  seedStarterCatalog,
  slugify,
  syncProductImages,
  syncProductVariants,
  updateOrderStatus,
  updateReviewStatus,
  type EditableVariant,
} from '../services/store'
import type {
  ActivityLog,
  AdminNotification,
  AnalyticsSummary,
  Category,
  DailyActivity,
  InventoryMovement,
  InventoryReason,
  Order,
  OrderStatus,
  Product,
  ProductPerformance,
  Review,
  ReviewStatus,
  StoreSettings,
  SystemHealth,
} from '../types/database'
import { cash, Photo, StockBadge, ThemeToggle, useDarkMode } from './Storefront'
import { AdminSectionSkeleton, InlineSpinner, StudioRouteLoader } from './Loaders'

const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled']

function Notice({ children, variant = 'warn' }: { children: React.ReactNode; variant?: 'warn' | 'ok' }) {
  return <div className={`notice ${variant === 'ok' ? 'success-notice' : ''}`}>{children}</div>
}

export function AdminGate({
  settings,
  onSettingsChange,
}: {
  settings: StoreSettings
  onSettingsChange: (s: StoreSettings) => void
}) {
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [accessError, setAccessError] = useState('')

  const checkAccess = useCallback(async () => {
    const client = supabase
    if (!client) {
      setReady(true)
      return
    }
    try {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) {
        setOk(false)
        setUserEmail('')
        setAccessError('')
        setReady(true)
        return
      }
      setUserEmail(user.email ?? '')
      const { data: profile, error } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const isAdmin = profile?.role === 'admin'
      setOk(isAdmin)
      setAccessError(
        error || !isAdmin ? 'This account is signed in, but it does not have administrator access yet.' : '',
      )
    } catch (err) {
      setOk(false)
      setAccessError(err instanceof Error ? err.message : 'Unable to verify administrator access.')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) {
      setReady(true)
      return
    }
    void checkAccess()
    const { data: subscription } = client.auth.onAuthStateChange(() => {
      void checkAccess()
    })
    return () => subscription.subscription.unsubscribe()
  }, [checkAccess])

  if (!ready)
    return (
      <StudioRouteLoader
        title="Verifying administrator session"
        subtitle="AUTHENTICATING CREDENTIALS & PERMISSIONS"
      />
    )
  return ok ? (
    <Admin settings={settings} userEmail={userEmail} onSettingsChange={onSettingsChange} />
  ) : (
    <Login
      settings={settings}
      userEmail={userEmail}
      accessError={accessError}
      onRecheck={() => {
        setReady(false)
        void checkAccess()
      }}
    />
  )
}

function Login({
  settings,
  userEmail,
  accessError = '',
  onRecheck,
}: {
  settings: StoreSettings
  userEmail: string
  accessError?: string
  onRecheck: () => void
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const nav = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env before signing in.')
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() || 'Store Admin' } },
        })
        if (signUpErr) throw signUpErr
        if (data.session) {
          onRecheck()
          nav('/admin')
        } else {
          setInfo('Account created! Check your email to confirm your address, then sign in.')
          setMode('signin')
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        onRecheck()
        nav('/admin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleClaimAdmin = async () => {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const granted = await claimInitialAdmin()
      if (granted) {
        onRecheck()
      } else {
        setError('An administrator already exists on this store. Promote this account via Supabase SQL Editor below.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — Make sure you have run the updated supabase/schema.sql in Supabase SQL Editor.`
          : 'Could not claim initial admin access.',
      )
    } finally {
      setBusy(false)
    }
  }

  const sqlSnippet = `insert into public.profiles (id, email, role)\nselect id, email, 'admin' from auth.users where email = '${userEmail || 'you@example.com'}'\non conflict (id) do update set role = 'admin';`
  const loginRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !loginRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.login-visual > *',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' },
      )
      gsap.fromTo(
        '.login-panel > *',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' },
      )
    }, loginRef)
    return () => ctx.revert()
  }, [])

  return (
    <main className="login-split" ref={loginRef}>
      <div className="login-visual">
        <Link className="brand" to="/">
          <span>
            <ShoppingBag size={16} />
          </span>
          {settings.store_name}
        </Link>
        <div className="login-scene">
          <div />
          <div />
          <div />
        </div>
        <div>
          <p className="eyebrow">Store management</p>
          <h2>Your store, beautifully organized.</h2>
          <p>Manage your catalog, stock, variants, verified orders, and TikTok Shop links from one place.</p>
        </div>
      </div>

      <div className="login-panel">
        <Link className="brand mobile-login-brand" to="/">
          <span>
            <ShoppingBag size={16} />
          </span>
          {settings.store_name}
        </Link>

        {userEmail && accessError ? (
          <div className="admin-recovery">
            <p className="eyebrow">Signed in as {userEmail}</p>
            <h1>Administrator access required</h1>
            <Notice>{accessError}</Notice>
            {error && <Notice>{error}</Notice>}
            {info && <Notice variant="ok">{info}</Notice>}
            <p style={{ fontSize: 13, color: 'var(--sub)', margin: '12px 0' }}>
              If you are setting up this store for the first time, claim initial admin rights below, or run the SQL snippet in your Supabase SQL Editor:
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button type="button" className="button" onClick={handleClaimAdmin} disabled={busy}>
                <Sparkles size={15} />
                {busy ? 'Checking…' : 'Claim initial admin access'}
              </button>
              <button type="button" className="button secondary" onClick={onRecheck} disabled={busy}>
                <RefreshCw size={14} />
                Re-check access
              </button>
            </div>
            <div className="sql-box">
              <pre>{sqlSnippet}</pre>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  void navigator.clipboard.writeText(sqlSnippet)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1800)
                }}
                title="Copy SQL"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
              <button
                type="button"
                className="plain"
                onClick={() => supabase?.auth.signOut().then(() => onRecheck())}
              >
                Sign out of {userEmail}
              </button>
              <Link className="back-store" style={{ margin: 0 }} to="/">
                ← Back to storefront
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Initial setup'}</p>
            <h1>{mode === 'signin' ? 'Sign in to your dashboard' : 'Create administrator account'}</h1>
            <p>
              {mode === 'signin'
                ? 'Use your administrator account to manage your store.'
                : 'The first registered account is automatically granted administrator privileges.'}
            </p>
            {!isSupabaseConfigured && (
              <Notice>
                Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>.
              </Notice>
            )}
            {error && <Notice>{error}</Notice>}
            {info && <Notice variant="ok">{info}</Notice>}

            {mode === 'signup' && (
              <label>
                Full name
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Store Owner"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>
            <button className="button" disabled={busy || !isSupabaseConfigured}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <div className="login-switch">
              <button
                type="button"
                className="plain"
                onClick={() => {
                  setError('')
                  setInfo('')
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                }}
              >
                {mode === 'signin' ? 'Need an admin account? Create one' : 'Already have an account? Sign in'}
              </button>
              <Link className="back-store" to="/">
                ← Back to storefront
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}

function Admin({
  settings,
  userEmail,
  onSettingsChange,
}: {
  settings: StoreSettings
  userEmail: string
  onSettingsChange: (s: StoreSettings) => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const loadNotifications = useCallback(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications, location.pathname])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const sectionLabel = useMemo(() => {
    const p = location.pathname
    if (p.includes('/products')) return 'Products'
    if (p.includes('/inventory')) return 'Inventory'
    if (p.includes('/categories')) return 'Categories'
    if (p.includes('/orders')) return 'Orders'
    if (p.includes('/reviews')) return 'Reviews'
    if (p.includes('/analytics')) return 'Performance'
    if (p.includes('/settings')) return 'Store settings'
    return 'Overview'
  }, [location.pathname])

  const initial = (userEmail?.[0] || 'A').toUpperCase()

  return (
    <div className="admin">
      <div
        className={`drawer-overlay admin-mobile-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={mobileOpen ? 'mobile-open' : ''}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link className="admin-brand" to="/admin">
            <span>
              <ShoppingBag size={15} />
            </span>
            <b>{settings.store_name}</b>
          </Link>
          <button
            type="button"
            className="icon-button mobile-only-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={15} />
          </button>
        </div>

        <p className="nav-label">Store management</p>
        <nav>
          <NavLink end to="/admin">
            <LayoutDashboard size={17} />
            Overview
          </NavLink>
          <NavLink to="/admin/products">
            <Boxes size={17} />
            Products
          </NavLink>
          <NavLink to="/admin/inventory">
            <ArrowUpDown size={17} />
            Inventory
          </NavLink>
          <NavLink to="/admin/categories">
            <Tag size={17} />
            Categories
          </NavLink>
          <NavLink to="/admin/orders">
            <ShoppingBag size={17} />
            Orders
          </NavLink>
          <NavLink to="/admin/reviews">
            <MessageSquare size={17} />
            Reviews
          </NavLink>
        </nav>

        <p className="nav-label">Analytics</p>
        <nav>
          <NavLink to="/admin/analytics">
            <BarChart3 size={17} />
            Performance
          </NavLink>
        </nav>

        <p className="nav-label">System</p>
        <nav>
          <NavLink to="/admin/settings">
            <Settings size={17} />
            Store settings
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <span className="avatar">{initial}</span>
          <div style={{ minWidth: 0 }}>
            <b>Administrator</b>
            <small style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail || 'Store manager'}</small>
          </div>
          <button
            type="button"
            className="plain"
            onClick={() => supabase?.auth.signOut().then(() => window.location.assign('/admin'))}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div>
            <button
              type="button"
              className="icon-button mobile-only-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <span className="crumb">Store management</span>
            <b>{sectionLabel}</b>
          </div>

          <div style={{ position: 'relative' }}>
            <Link className="button secondary sm-btn storefront-jump-btn" to="/" title="View storefront">
              <span className="hide-xs">Storefront</span>
              <ExternalLink size={13} />
            </Link>

            <button
              type="button"
              className="icon-button wishlist-trigger"
              onClick={() => {
                const next = !notifOpen
                setNotifOpen(next)
                if (next && unreadCount > 0) {
                  void markAllNotificationsRead().then(loadNotifications)
                }
              }}
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && <span className="badge-dot">{unreadCount}</span>}
            </button>

            {notifOpen && (
              <div className="notif-popover">
                <div className="notif-head">
                  <b>Notifications</b>
                  <button type="button" className="plain" onClick={() => setNotifOpen(false)}>
                    <X size={14} />
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="notif-empty">All caught up — no alerts right now.</p>
                ) : (
                  <ul>
                    {notifications.slice(0, 8).map((n) => (
                      <li key={n.id}>
                        <b>{n.title}</b>
                        {n.body && <span>{n.body}</span>}
                        <small>{new Date(n.created_at).toLocaleString()}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <ThemeToggle />
            <span className="avatar">{initial}</span>
          </div>
        </header>

        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="categories" element={<Categories />} />
          <Route path="orders" element={<Orders />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route
            path="settings"
            element={<StoreSettingsPage settings={settings} onSettingsChange={onSettingsChange} />}
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function Page({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const pageRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !pageRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ':scope > .page-title-row, :scope > .admin-copy, :scope > .metrics > .metric, :scope > .panel, :scope > .settings-layout > *',
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.045,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      )
    }, pageRef)
    return () => ctx.revert()
  }, [title])

  return (
    <main className="admin-page" ref={pageRef}>
      <div className="page-title-row">
        <h1>{title}</h1>
        {action && <div className="page-actions">{action}</div>}
      </div>
      {children}
    </main>
  )
}

function ActivityChart({ activity }: { activity: DailyActivity[] }) {
  const dark = useDarkMode()
  return (
    <div className="panel chart">
      <h2>Storefront activity · last 14 days</h2>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={activity}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? '#27272a' : '#e4e4e7'} />
          <XAxis dataKey="day" stroke={dark ? '#a1a1aa' : '#71717a'} fontSize={12} />
          <YAxis allowDecimals={false} stroke={dark ? '#a1a1aa' : '#71717a'} fontSize={12} />
          <Tooltip
            contentStyle={{
              background: dark ? '#18181b' : '#ffffff',
              borderColor: dark ? '#27272a' : '#e4e4e7',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name="Product views" dataKey="views" fill={dark ? '#e4e4e7' : '#18181b'} radius={[4, 4, 0, 0]} />
          <Bar name="Buy Now clicks" dataKey="clicks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Dashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [activity, setActivity] = useState<DailyActivity[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [seeding, setSeeding] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    Promise.all([getDashboardSummary(), getDailyActivity(), getRecentOrders()])
      .then(([a, b, c]) => {
        setSummary(a)
        setActivity(b)
        setOrders(c)
      })
      .catch(() =>
        setSummary({ products: 0, orders: 0, views: 0, clicks: 0, revenue: 0, lowStock: 0, pendingReviews: 0 }),
      )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSeed = async () => {
    setSeeding(true)
    setMessage('')
    try {
      const count = await seedStarterCatalog()
      setMessage(`Added ${count} starter Nook products to your catalog.`)
      load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to seed catalog.')
    } finally {
      setSeeding(false)
    }
  }

  if (!summary)
    return (
      <Page title="Overview">
        <AdminSectionSkeleton showMetrics rows={5} label="LOADING ANALYTICS & TELEMETRY…" />
      </Page>
    )

  return (
    <Page
      title="Overview"
      action={
        summary.products === 0 ? (
          <button type="button" className="button" onClick={handleSeed} disabled={seeding}>
            <Sparkles size={15} />
            {seeding ? 'Loading catalog…' : 'Load starter Nook catalog'}
          </button>
        ) : undefined
      }
    >
      <p className="admin-copy">Verified records only — outbound TikTok Shop clicks are tracked separately from orders.</p>
      {message && <Notice variant="ok">{message}</Notice>}

      <div className="metrics">
        <div className="metric">
          <span>Total products</span>
          <b>{summary.products}</b>
          {summary.lowStock > 0 && <small className="warn-text">{summary.lowStock} low or out of stock</small>}
        </div>
        <div className="metric">
          <span>Verified orders</span>
          <b>{summary.orders}</b>
          <small>{cash(summary.revenue)} recorded total</small>
        </div>
        <div className="metric">
          <span>Product views</span>
          <b>{summary.views}</b>
          <small>Storefront detail impressions</small>
        </div>
        <div className="metric">
          <span>Buy Now clicks</span>
          <b>{summary.clicks}</b>
          <small>
            {summary.views > 0 ? `${((summary.clicks / summary.views) * 100).toFixed(1)}% click-through` : 'Outbound to TikTok Shop'}
          </small>
        </div>
      </div>

      {(summary.lowStock > 0 || summary.pendingReviews > 0) && (
        <div className="quick-alerts">
          {summary.lowStock > 0 && (
            <Link to="/admin/inventory" className="alert-chip">
              <AlertTriangle size={15} />
              <span>
                <b>{summary.lowStock}</b> product{summary.lowStock > 1 ? 's' : ''} low or out of stock — review inventory →
              </span>
            </Link>
          )}
          {summary.pendingReviews > 0 && (
            <Link to="/admin/reviews" className="alert-chip">
              <MessageSquare size={15} />
              <span>
                <b>{summary.pendingReviews}</b> customer review{summary.pendingReviews > 1 ? 's' : ''} awaiting moderation →
              </span>
            </Link>
          )}
        </div>
      )}

      <ActivityChart activity={activity} />

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Recent verified orders</h2>
          <Link className="plain" to="/admin/orders">
            Manage orders →
          </Link>
        </div>
        {orders.length ? (
          <div className="table-wrap">
            <OrderTable orders={orders} />
          </div>
        ) : (
          <div className="state">No recorded orders yet. Record verified purchases in Orders.</div>
        )}
      </div>
    </Page>
  )
}

function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [edit, setEdit] = useState<Partial<Product> | null>(null)
  const [stockTarget, setStockTarget] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([getProducts({ includeHidden: true }), getCategories()])
      .then(([p, c]) => {
        setProducts(p)
        setCats(c)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: string) => {
    if (!confirm('Delete this product permanently?')) return
    try {
      await deleteProduct(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete product.')
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    setError('')
    try {
      await seedStarterCatalog()
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not seed starter catalog.')
    } finally {
      setSeeding(false)
    }
  }

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  )

  return (
    <Page
      title="Products"
      action={
        <>
          {products.length === 0 && !loading && (
            <button type="button" className="button secondary" onClick={handleSeed} disabled={seeding}>
              <Sparkles size={15} />
              {seeding ? 'Seeding…' : 'Load starter catalog'}
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={() =>
              setEdit({
                availability: true,
                is_featured: false,
                stock_quantity: 10,
                low_stock_threshold: 5,
              })
            }
          >
            <Plus size={17} />
            Add product
          </button>
        </>
      }
    >
      <p className="admin-copy">Manage your catalog items, variants, images, stock levels, and TikTok Shop URLs.</p>
      {error && <Notice>{error}</Notice>}

      {products.length > 0 && (
        <div className="filters" style={{ maxWidth: 420 }}>
          <label className="search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter products…" />
          </label>
        </div>
      )}

      {edit && (
        <ProductForm
          item={edit}
          cats={cats}
          done={() => {
            setEdit(null)
            load()
          }}
          close={() => setEdit(null)}
        />
      )}

      {stockTarget && (
        <StockAdjustModal
          product={stockTarget}
          onClose={() => setStockTarget(null)}
          onDone={() => {
            setStockTarget(null)
            load()
          }}
        />
      )}

      {loading ? (
        <AdminSectionSkeleton rows={5} label="SYNCING CATALOG PRODUCTS…" />
      ) : filtered.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Visibility</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = getEffectiveStock(p)
                const varCount = (p.product_variants ?? []).length
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-prod-cell">
                        <Photo product={p} className="admin-row-thumb" />
                        <div>
                          <b>{p.name}</b>
                          <small>
                            /{p.slug}
                            {p.is_featured ? ' · Featured' : ''}
                            {varCount > 0 ? ` · ${varCount} variant${varCount > 1 ? 's' : ''}` : ''}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{p.category?.name ?? '—'}</td>
                    <td>{cash(p.price)}</td>
                    <td>
                      <StockBadge stock={stock} threshold={p.low_stock_threshold} />
                      <small style={{ marginTop: 2 }}>{stock} units</small>
                    </td>
                    <td>{p.availability ? 'Published' : 'Hidden'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="table-button" onClick={() => setStockTarget(p)}>
                        Stock
                      </button>
                      <button type="button" className="table-button" onClick={() => setEdit(p)}>
                        Edit
                      </button>
                      <button type="button" className="table-button danger" onClick={() => void remove(p.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="state">
          <p style={{ marginBottom: 12 }}>No products in your catalog yet.</p>
          <button type="button" className="button secondary" onClick={handleSeed} disabled={seeding}>
            <Sparkles size={15} />
            {seeding ? 'Seeding starter catalog…' : 'Populate with 8 starter Nook gadgets'}
          </button>
        </div>
      )}
    </Page>
  )
}

function ProductForm({
  item,
  cats,
  done,
  close,
}: {
  item: Partial<Product>
  cats: Category[]
  done: () => void
  close: () => void
}) {
  const [form, setForm] = useState<Partial<Product>>({
    availability: true,
    is_featured: false,
    stock_quantity: 10,
    low_stock_threshold: 5,
    ...item,
  })
  const [keptUrls, setKeptUrls] = useState<string[]>(() => (item.product_images ?? []).map((img) => img.image_url))
  const [newImageUrl, setNewImageUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [variants, setVariants] = useState<EditableVariant[]>(() =>
    (item.product_variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku ?? '',
      price: v.price != null ? String(v.price) : '',
      stock_quantity: v.stock_quantity,
      image_url: v.image_url ?? '',
      tiktok_url: v.tiktok_url ?? '',
      enabled: v.enabled,
    })),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key: keyof Product, value: string | number | boolean | null) =>
    setForm((current) => ({ ...current, [key]: value }))

  const addDirectUrl = () => {
    const trimmed = newImageUrl.trim()
    if (!trimmed) return
    setKeptUrls((prev) => [...prev, trimmed])
    setNewImageUrl('')
  }

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      { name: '', sku: '', price: '', stock_quantity: 5, image_url: '', tiktok_url: '', enabled: true },
    ])
  }

  const updateVariant = (idx: number, patch: Partial<EditableVariant>) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const pendingUrl = newImageUrl.trim()
      const urlsToSave = pendingUrl ? [...keptUrls, pendingUrl] : keptUrls

      const saved = await saveProduct({
        ...form,
        price: Number(form.price ?? 0),
        stock_quantity: Number(form.stock_quantity ?? 0),
        low_stock_threshold: Number(form.low_stock_threshold ?? 5),
        slug: form.slug?.trim() || slugify(form.name ?? ''),
      })

      await syncProductImages(saved.id, urlsToSave, files)
      await syncProductVariants(saved.id, variants)

      done()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save product.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal product-editor" onSubmit={submit}>
        <div className="modal-title">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>{item.id ? 'Edit product' : 'Add product'}</h2>
          </div>
          <button type="button" className="plain close-editor" onClick={close} aria-label="Close editor">
            <X />
          </button>
        </div>

        <p className="editor-intro">Configure details, stock, optional variants, images, and SEO metadata.</p>
        {error && (
          <div style={{ margin: '12px 24px 0' }}>
            <Notice>{error}</Notice>
          </div>
        )}

        <div className="editor-section">
          <b>Product information</b>
          <div className="editor-grid">
            <label className="wide">
              Name
              <input required value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label>
              Price (USD)
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price ?? ''}
                onChange={(e) => set('price', Number(e.target.value))}
              />
            </label>
            <label>
              Category
              <select value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">Uncategorized</option>
                {cats.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Slug
              <input
                value={form.slug ?? ''}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="Generated automatically from name if left blank"
              />
            </label>
            <label className="wide">
              Description
              <textarea
                required
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="editor-section">
          <b>Inventory &amp; variants</b>
          <div className="editor-grid">
            <label>
              Stock quantity
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity ?? 10}
                onChange={(e) => set('stock_quantity', Math.max(0, Number(e.target.value)))}
                disabled={variants.some((v) => v.name.trim() && v.enabled)}
              />
            </label>
            <label>
              Low stock alert threshold
              <input
                type="number"
                min="0"
                step="1"
                value={form.low_stock_threshold ?? 5}
                onChange={(e) => set('low_stock_threshold', Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
          {variants.some((v) => v.name.trim() && v.enabled) && (
            <small style={{ display: 'block', color: 'var(--sub)', marginBottom: 10 }}>
              Total stock is automatically calculated from enabled variants below.
            </small>
          )}

          <div className="variants-editor">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Product options / variants ({variants.length})</span>
              <button type="button" className="button secondary sm-btn" onClick={addVariantRow}>
                <Plus size={13} /> Add option
              </button>
            </div>

            {variants.map((v, idx) => (
              <div key={v.id ?? `new-${idx}`} className="variant-edit-row">
                <input
                  placeholder="Option name (e.g. Matte Black)"
                  value={v.name}
                  onChange={(e) => updateVariant(idx, { name: e.target.value })}
                />
                <input
                  placeholder="SKU"
                  value={v.sku}
                  onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price override"
                  value={v.price}
                  onChange={(e) => updateVariant(idx, { price: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Stock"
                  value={v.stock_quantity}
                  onChange={(e) => updateVariant(idx, { stock_quantity: Math.max(0, Number(e.target.value)) })}
                />
                <label className="inline-check" title="Enabled">
                  <input
                    type="checkbox"
                    checked={v.enabled}
                    onChange={(e) => updateVariant(idx, { enabled: e.target.checked })}
                  />
                  Active
                </label>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove variant"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="editor-section">
          <b>Storefront link &amp; media</b>
          <label>
            TikTok Shop URL
            <input
              required
              type="url"
              placeholder="https://www.tiktok.com/shop/..."
              value={form.tiktok_url ?? ''}
              onChange={(e) => set('tiktok_url', e.target.value)}
            />
          </label>

          <div style={{ marginTop: 12 }}>
            <label style={{ marginBottom: 4 }}>Add image via URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                placeholder="https://example.com/product.jpg"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
              />
              <button type="button" className="button secondary" onClick={addDirectUrl}>
                Add URL
              </button>
            </div>
          </div>

          <label className="image-drop" style={{ marginTop: 12 }}>
            Or upload image files
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <span>
              {files.length
                ? `${files.length} new file${files.length > 1 ? 's' : ''} queued for upload.`
                : 'Select one or more image files to upload to Supabase Storage.'}
            </span>
          </label>

          {keptUrls.length > 0 && (
            <div className="image-preview">
              {keptUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className="preview-chip">
                  <img src={url} alt={`Product ${idx + 1}`} />
                  <button
                    type="button"
                    onClick={() => setKeptUrls((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="editor-section">
          <b>Search engine appearance (optional)</b>
          <div className="editor-grid">
            <label className="wide">
              SEO title
              <input
                value={form.seo_title ?? ''}
                onChange={(e) => set('seo_title', e.target.value)}
                placeholder={`${form.name || 'Product'} — Nook`}
              />
            </label>
            <label className="wide">
              SEO description
              <input
                value={form.seo_description ?? ''}
                onChange={(e) => set('seo_description', e.target.value)}
                placeholder="Short summary for search results and social previews"
              />
            </label>
          </div>
        </div>

        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={form.availability ?? true}
              onChange={(e) => set('availability', e.target.checked)}
            />
            Published on storefront
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.is_featured ?? false}
              onChange={(e) => set('is_featured', e.target.checked)}
            />
            Featured product
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Saving changes…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function StockAdjustModal({
  product,
  onClose,
  onDone,
}: {
  product: Product
  onClose: () => void
  onDone: () => void
}) {
  const variants = product.product_variants ?? []
  const [variantId, setVariantId] = useState<string>(variants[0]?.id ?? '')
  const [delta, setDelta] = useState<number>(5)
  const [reason, setReason] = useState<InventoryReason>('restock')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const currentStock = variantId
    ? (variants.find((v) => v.id === variantId)?.stock_quantity ?? 0)
    : product.stock_quantity

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!delta) return setError('Enter a non-zero quantity change (e.g. +10 or -2).')
    setBusy(true)
    setError('')
    try {
      await adjustInventory(product.id, variantId || null, delta, reason, notes)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not adjust inventory.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal small-modal" onSubmit={submit}>
        <div className="modal-title">
          <h2>Adjust stock · {product.name}</h2>
          <button type="button" className="plain" onClick={onClose}>
            <X />
          </button>
        </div>
        {error && <Notice>{error}</Notice>}

        {variants.length > 0 && (
          <label>
            Target option
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (current: {v.stock_quantity})
                </option>
              ))}
            </select>
          </label>
        )}

        <p style={{ fontSize: 12, color: 'var(--sub)', margin: '8px 0' }}>
          Current stock: <b>{currentStock}</b> → New stock: <b>{Math.max(0, currentStock + Number(delta || 0))}</b>
        </p>

        <div className="form-grid">
          <label>
            Quantity change (+/-)
            <input
              required
              type="number"
              step="1"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />
          </label>
          <label>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value as InventoryReason)}>
              <option value="restock">Restock</option>
              <option value="manual_adjustment">Manual adjustment</option>
              <option value="correction">Count correction</option>
              <option value="verified_order">Verified order</option>
            </select>
          </label>
        </div>

        <label>
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Supplier shipment, audit count, etc."
          />
        </label>

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Updating…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </div>
  )
}

function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [lowOnly, setLowOnly] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getProducts({ includeHidden: true }), getInventoryMovements(25)])
      .then(([p, m]) => {
        setProducts(p)
        setMovements(m)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(
    () => products.filter((p) => !lowOnly || getEffectiveStock(p) <= p.low_stock_threshold),
    [products, lowOnly],
  )

  return (
    <Page
      title="Inventory"
      action={
        <label className="stock-filter">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low / out of stock only
        </label>
      }
    >
      <p className="admin-copy">
        Explicit stock control and movement history. Outbound TikTok clicks never deduct inventory automatically.
      </p>

      {adjustTarget && (
        <StockAdjustModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={() => {
            setAdjustTarget(null)
            load()
          }}
        />
      )}

      {loading ? (
        <div className="state">Loading inventory…</div>
      ) : shown.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Effective stock</th>
                <th>Low alert threshold</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const stock = getEffectiveStock(p)
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      {(p.product_variants ?? []).length > 0 && (
                        <small>
                          {(p.product_variants ?? []).map((v) => `${v.name}: ${v.stock_quantity}`).join(' · ')}
                        </small>
                      )}
                    </td>
                    <td>
                      <b>{stock}</b>
                    </td>
                    <td>{p.low_stock_threshold}</td>
                    <td>
                      <StockBadge stock={stock} threshold={p.low_stock_threshold} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="button secondary sm-btn" onClick={() => setAdjustTarget(p)}>
                        <PackagePlus size={14} /> Adjust stock
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="state">No items match this inventory view.</div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <h2>Recent inventory movements</h2>
        {movements.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Change</th>
                  <th>Reason</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString()}</td>
                    <td>
                      <b>{m.product?.name ?? 'Product'}</b>
                      {m.variant?.name && <small>{m.variant.name}</small>}
                    </td>
                    <td>
                      <b style={{ color: m.quantity_change >= 0 ? '#16a34a' : 'var(--danger)' }}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </b>
                    </td>
                    <td>{m.reason.replace(/_/g, ' ')}</td>
                    <td>{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state">No stock movements recorded yet.</div>
        )}
      </div>
    </Page>
  )
}

function Categories() {
  const [items, setItems] = useState<Category[]>([])
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    getCategories()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: string) => {
    if (!confirm('Delete this category? Assigned products will become uncategorized.')) return
    try {
      await deleteCategory(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete category.')
    }
  }

  return (
    <Page
      title="Categories"
      action={
        <button type="button" className="button" onClick={() => setEditing({})}>
          <Plus size={17} />
          Add category
        </button>
      }
    >
      <p className="admin-copy">Organize products into clear groups for shoppers.</p>
      {error && <Notice>{error}</Notice>}

      {editing && (
        <CategoryForm
          item={editing}
          close={() => setEditing(null)}
          done={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {items.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.name}</b>
                  </td>
                  <td>{item.slug}</td>
                  <td>{item.description || '—'}</td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="table-button" onClick={() => setEditing(item)}>
                      Edit
                    </button>
                    <button type="button" className="table-button danger" onClick={() => void remove(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="state">No categories yet. Add a category to group your gadgets.</div>
      )}
    </Page>
  )
}

function CategoryForm({
  item,
  close,
  done,
}: {
  item: Partial<Category>
  close: () => void
  done: () => void
}) {
  const [form, setForm] = useState(item)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveCategory({ ...form, slug: form.slug || slugify(form.name ?? '') })
      done()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal small-modal" onSubmit={submit}>
        <div className="modal-title">
          <h2>{item.id ? 'Edit category' : 'Add category'}</h2>
          <button type="button" className="plain" onClick={close}>
            <X />
          </button>
        </div>
        {error && <Notice>{error}</Notice>}
        <label>
          Name
          <input required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Slug
          <input
            value={form.slug ?? ''}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="Generated from name if blank"
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save category'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getOrders(100), getProducts({ includeHidden: true })])
      .then(([o, p]) => {
        setOrders(o)
        setProducts(p)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusChange = async (id: string, nextStatus: OrderStatus) => {
    try {
      await updateOrderStatus(id, nextStatus)
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, order_status: nextStatus } : o)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recorded order?')) return
    try {
      await deleteOrder(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete order.')
    }
  }

  const filtered = useMemo(
    () => orders.filter((o) => !statusFilter || o.order_status === statusFilter),
    [orders, statusFilter],
  )

  return (
    <Page
      title="Recorded orders"
      action={
        <button type="button" className="button" onClick={() => setCreating(true)}>
          <Plus size={17} />
          Record verified order
        </button>
      }
    >
      <p className="admin-copy">
        Log verified purchases from TikTok Shop Seller Center or direct sales. Outbound clicks are never auto-recorded here.
      </p>
      {error && <Notice>{error}</Notice>}

      {orders.length > 0 && (
        <div className="category-pills" style={{ marginBottom: 14 }}>
          <button type="button" className={!statusFilter ? 'active' : ''} onClick={() => setStatusFilter('')}>
            All ({orders.length})
          </button>
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              className={statusFilter === st ? 'active' : ''}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      {creating && (
        <OrderFormModal
          products={products}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            load()
          }}
        />
      )}

      {loading ? (
        <AdminSectionSkeleton rows={5} label="LOADING VERIFIED ORDERS…" />
      ) : filtered.length ? (
        <div className="panel table-wrap">
          <OrderTable orders={filtered} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        </div>
      ) : (
        <div className="state">No verified orders recorded yet.</div>
      )}
    </Page>
  )
}

function OrderTable({
  orders,
  onStatusChange,
  onDelete,
}: {
  orders: Order[]
  onStatusChange?: (id: string, status: OrderStatus) => void
  onDelete?: (id: string) => void
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Reference</th>
          <th>Customer</th>
          <th>Items / Source</th>
          <th>Status</th>
          <th>Date</th>
          <th>Total</th>
          {onDelete && <th />}
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td>
              <b>{o.order_reference}</b>
              {o.notes && <small>{o.notes}</small>}
            </td>
            <td>{o.customer_name || '—'}</td>
            <td>
              {o.order_items?.length ? (
                <span>
                  {o.order_items.map((it) => `${it.quantity}× ${it.product?.name ?? 'Item'}`).join(', ')}
                </span>
              ) : (
                <span>{o.source}</span>
              )}
            </td>
            <td>
              {onStatusChange ? (
                <select
                  className="status-select"
                  value={o.order_status}
                  onChange={(e) => onStatusChange(o.id, e.target.value as OrderStatus)}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="status">{o.order_status}</span>
              )}
            </td>
            <td>{new Date(o.order_date).toLocaleDateString()}</td>
            <td>
              <b>{cash(o.total_amount)}</b>
            </td>
            {onDelete && (
              <td style={{ textAlign: 'right' }}>
                <button type="button" className="table-button danger" onClick={() => onDelete(o.id)}>
                  Delete
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function OrderFormModal({
  products,
  onClose,
  onDone,
}: {
  products: Product[]
  onClose: () => void
  onDone: () => void
}) {
  const [reference, setReference] = useState(() => `TT-${Date.now().toString().slice(-6)}`)
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState<OrderStatus>('Confirmed')
  const [source, setSource] = useState('tiktok_shop')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [manualTotal, setManualTotal] = useState('0')
  const [deductStock, setDeductStock] = useState(true)
  const [lines, setLines] = useState<{ product_id: string; quantity: number; unit_price: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const addLine = () => {
    const first = products[0]
    setLines((prev) => [
      ...prev,
      { product_id: first?.id ?? '', quantity: 1, unit_price: first?.price ?? 0 },
    ])
  }

  const computedTotal = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0),
    [lines],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveOrder({
        order_reference: reference,
        customer_name: customer,
        order_status: status,
        source,
        order_date: orderDate,
        notes,
        total_amount: lines.length > 0 ? computedTotal : Number(manualTotal || 0),
        items: lines,
        deductStock,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record order.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-title">
          <h2>Record verified order</h2>
          <button type="button" className="plain" onClick={onClose}>
            <X />
          </button>
        </div>
        {error && <Notice>{error}</Notice>}

        <div className="form-grid">
          <label>
            Order reference
            <input required value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label>
            Customer name
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Optional" />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order date
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </label>
          <label>
            Channel / Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="tiktok_shop">TikTok Shop</option>
              <option value="manual">Direct / Manual</option>
            </select>
          </label>
          {lines.length === 0 && (
            <label>
              Total amount (USD)
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={manualTotal}
                onChange={(e) => setManualTotal(e.target.value)}
              />
            </label>
          )}
        </div>

        {products.length > 0 && (
          <div style={{ margin: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 12 }}>Order items {lines.length > 0 ? `(Subtotal: ${cash(computedTotal)})` : ''}</b>
              <button type="button" className="button secondary sm-btn" onClick={addLine}>
                <Plus size={13} /> Add product line
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="order-line-edit">
                <select
                  value={line.product_id}
                  onChange={(e) => {
                    const p = products.find((item) => item.id === e.target.value)
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, product_id: e.target.value, unit_price: p?.price ?? l.unit_price } : l,
                      ),
                    )
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({cash(p.price)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, Number(e.target.value)) } : l)),
                    )
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unit_price}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, unit_price: Math.max(0, Number(e.target.value)) } : l)),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {lines.length > 0 && (
              <label className="inline-check" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} />
                Deduct item quantities from product inventory
              </label>
            )}
          </div>
        )}

        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="TikTok settlement ID or shipping note" />
        </label>

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy && <InlineSpinner size={14} />}
            {busy ? 'Saving…' : 'Save order'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getAdminReviews()
      .then(setReviews)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const moderate = async (id: string, status: ReviewStatus, verified?: boolean) => {
    try {
      await updateReviewStatus(id, status, verified)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Moderation update failed.')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this review?')) return
    await deleteReview(id)
    load()
  }

  const shown = reviews.filter((r) => !filter || r.status === filter)

  return (
    <Page title="Customer reviews">
      <p className="admin-copy">Approve genuine customer feedback before it appears publicly on product pages.</p>
      {error && <Notice>{error}</Notice>}

      <div className="category-pills" style={{ marginBottom: 14 }}>
        {(['', 'pending', 'approved', 'rejected'] as const).map((st) => (
          <button key={st || 'all'} type="button" className={filter === st ? 'active' : ''} onClick={() => setFilter(st)}>
            {st ? st[0].toUpperCase() + st.slice(1) : `All (${reviews.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminSectionSkeleton rows={4} label="FETCHING CUSTOMER REVIEWS…" />
      ) : shown.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Reviewer &amp; Rating</th>
                <th>Comment</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.product?.name ?? 'Product'}</b>
                    <small>{new Date(r.created_at).toLocaleDateString()}</small>
                  </td>
                  <td>
                    <b>{r.author_name || 'Customer'}</b>
                    <div className="stars-row" style={{ marginTop: 2 }}>
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} size={12} fill="#f59e0b" color="#f59e0b" />
                      ))}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>{r.body}</td>
                  <td>
                    <span className="status">{r.status}</span>
                    {r.verified_purchase && <small style={{ color: '#16a34a' }}>Verified purchase</small>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.status !== 'approved' && (
                      <button type="button" className="table-button" onClick={() => void moderate(r.id, 'approved')}>
                        Approve
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button type="button" className="table-button" onClick={() => void moderate(r.id, 'rejected')}>
                        Reject
                      </button>
                    )}
                    <button
                      type="button"
                      className="table-button"
                      onClick={() => void moderate(r.id, r.status, !r.verified_purchase)}
                    >
                      {r.verified_purchase ? 'Unverify' : 'Verify buy'}
                    </button>
                    <button type="button" className="table-button danger" onClick={() => void remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="state">No customer reviews in this queue yet.</div>
      )}
    </Page>
  )
}

function Analytics() {
  const [activity, setActivity] = useState<DailyActivity[]>([])
  const [perf, setPerf] = useState<ProductPerformance[]>([])

  useEffect(() => {
    getDailyActivity()
      .then(setActivity)
      .catch(() => setActivity([]))
    getProductPerformance()
      .then(setPerf)
      .catch(() => setPerf([]))
  }, [])

  return (
    <Page title="Performance">
      <p className="admin-copy">Real storefront impressions and outbound TikTok Shop clicks per product.</p>
      <ActivityChart activity={activity} />

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Product engagement breakdown</h2>
        {perf.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Detail views</th>
                  <th>Buy Now clicks</th>
                  <th>Click-through rate</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/product/${p.slug}`}>
                        <b>{p.name}</b>
                      </Link>
                    </td>
                    <td>{p.views}</td>
                    <td>{p.clicks}</td>
                    <td>{p.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state">No product engagement data recorded yet.</div>
        )}
      </div>
    </Page>
  )
}

function StoreSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: StoreSettings
  onSettingsChange: (s: StoreSettings) => void
}) {
  const [form, setForm] = useState<StoreSettings>(settings)
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const loadDiagnostics = useCallback(() => {
    void checkSystemHealth().then(setHealth)
    void getActivityLogs(12).then(setLogs)
  }, [])

  useEffect(() => {
    loadDiagnostics()
  }, [loadDiagnostics])

  const set = (key: keyof StoreSettings, value: string) =>
    setForm((curr) => ({ ...curr, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSavedMsg('')
    setError('')
    try {
      const res = await saveStoreSettings(form)
      onSettingsChange(form)
      setSavedMsg(
        res.persistedToDb
          ? 'Store settings saved and synced to Supabase.'
          : 'Settings saved locally in this browser. Run 20261106_store_enhancements.sql in Supabase to sync across all visitors.',
      )
      loadDiagnostics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save store settings.')
    } finally {
      setBusy(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    setSavedMsg('')
    setError('')
    try {
      const added = await seedStarterCatalog()
      setSavedMsg(
        added > 0
          ? `Added ${added} starter Nook products and categories.`
          : 'All starter products are already present in your catalog.',
      )
      loadDiagnostics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not seed starter catalog.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Page
      title="Store settings"
      action={
        <button type="button" className="button secondary" onClick={loadDiagnostics}>
          <RefreshCw size={14} /> Recheck system
        </button>
      }
    >
      <p className="admin-copy">Configure your public storefront identity, hero messaging, and inspect system database readiness.</p>

      {savedMsg && (
        <Notice variant="ok">
          <CheckCircle2 size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
          {savedMsg}
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}

      <div className="settings-layout">
        <form className="panel settings-form" onSubmit={submit}>
          <h2>Store identity &amp; storefront copy</h2>
          <div className="form-grid">
            <label>
              Store name
              <input required value={form.store_name} onChange={(e) => set('store_name', e.target.value)} />
            </label>
            <label>
              Footer tagline
              <input required value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </label>
            <label>
              Hero announcement badge
              <input value={form.hero_badge} onChange={(e) => set('hero_badge', e.target.value)} />
            </label>
            <label>
              Support email
              <input
                type="email"
                value={form.support_email ?? ''}
                onChange={(e) => set('support_email', e.target.value)}
                placeholder="hello@nook.store"
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 500 }}>
            Hero headline
            <input required value={form.hero_title} onChange={(e) => set('hero_title', e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 500 }}>
            Hero subtitle
            <textarea value={form.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 500 }}>
            TikTok Shop profile URL
            <input
              type="url"
              value={form.tiktok_profile_url ?? ''}
              onChange={(e) => set('tiktok_profile_url', e.target.value)}
              placeholder="https://www.tiktok.com/@yourshop"
            />
          </label>

          <h2 style={{ marginTop: 22 }}>Storefront promise cards</h2>
          <div className="form-grid">
            <label>
              Promise 1
              <input value={form.free_shipping_text} onChange={(e) => set('free_shipping_text', e.target.value)} />
            </label>
            <label>
              Promise 2
              <input value={form.returns_text} onChange={(e) => set('returns_text', e.target.value)} />
            </label>
            <label>
              Promise 3
              <input value={form.warranty_text} onChange={(e) => set('warranty_text', e.target.value)} />
            </label>
          </div>

          <div className="form-actions">
            <button className="button" disabled={busy}>
              {busy ? 'Saving…' : 'Save store settings'}
            </button>
          </div>
        </form>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className="panel">
            <h2>System &amp; database health</h2>
            {health ? (
              <ul className="health-list">
                {health.details.map((d) => (
                  <li key={d.name}>
                    <span className={`health-dot ${d.ok ? 'ok' : 'warn'}`} />
                    <div>
                      <b>{d.name}</b>
                      <small>{d.hint}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--sub)' }}>Checking Supabase tables…</p>
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <b style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Catalog quick-start</b>
              <p style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 10 }}>
                Populate missing starter categories and Nook sample gadgets without overwriting existing products.
              </p>
              <button type="button" className="button secondary sm-btn" onClick={handleSeed} disabled={seeding}>
                <Sparkles size={14} />
                {seeding ? 'Loading starter items…' : 'Seed starter catalog'}
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Recent admin activity</h2>
            {logs.length ? (
              <ul className="audit-list">
                {logs.map((log) => (
                  <li key={log.id}>
                    <b>{log.description}</b>
                    <small>
                      {log.action} · {new Date(log.created_at).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--sub)' }}>Admin changes will appear here once recorded.</p>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
