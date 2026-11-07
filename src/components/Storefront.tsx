import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Heart,
  Menu,
  Moon,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { getDemoCatalog } from '../lib/starterCatalog'
import {
  gsap,
  KineticMarquee,
  prefersReducedMotion,
  ScrollTrigger,
  SmoothScrollProvider,
  useMagnetic,
  useSmoothScroll,
  useTilt3D,
} from '../lib/motion'
import {
  getApprovedReviews,
  getCategories,
  getEffectiveStock,
  getProduct,
  getProducts,
  submitReview,
  trackOutboundClick,
  trackView,
} from '../services/store'
import type { Category, Product, Review, StoreSettings } from '../types/database'
import Crosshair from './Crosshair'
import { CatalogSkeletonGrid, InlineSpinner, ProductDetailSkeleton } from './Loaders'

export const cash = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n || 0))

const sid = () => {
  let id = localStorage.getItem('shoplink-session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('shoplink-session', id)
  }
  return id
}

const readIds = (key: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as string[]
  } catch {
    return []
  }
}

const remember = (key: string, id: string) => {
  const next = [id, ...readIds(key).filter((value) => value !== id)].slice(0, 12)
  localStorage.setItem(key, JSON.stringify(next))
}

function toggleWishlistId(productId: string) {
  const ids = readIds('nook-wishlist')
  const exists = ids.includes(productId)
  const next = exists ? ids.filter((id) => id !== productId) : [productId, ...ids]
  localStorage.setItem('nook-wishlist', JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('nook-wishlist-changed'))
}

function useWishlistIds() {
  const [ids, setIds] = useState<string[]>(() => readIds('nook-wishlist'))
  useEffect(() => {
    const sync = () => setIds(readIds('nook-wishlist'))
    window.addEventListener('nook-wishlist-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('nook-wishlist-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return ids
}

export function useDarkMode() {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === 'dark' || localStorage.getItem('theme') === 'dark',
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.dataset.theme === 'dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => {
    const update = () => setDark((current) => !current)
    const transitions = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> }
    }
    if (transitions.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transitions.startViewTransition(update)
    } else {
      update()
    }
  }

  return (
    <button className="icon-button theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export function Photo({ product, className = '' }: { product: Product; className?: string }) {
  const image = product.product_images?.[0]?.image_url
  return image ? (
    <img className={className} src={image} alt={product.name} loading="lazy" />
  ) : (
    <div className={`placeholder ${className}`}>
      <Package size={22} strokeWidth={1.6} />
      <small>No image</small>
    </div>
  )
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const state = stock <= 0 ? 'out' : stock <= threshold ? 'low' : 'in'
  return (
    <span className={`stock ${state === 'in' ? '' : state}`}>
      <i className="stock-dot" aria-hidden="true" />
      {stock <= 0 ? 'Out of stock' : stock <= threshold ? `Low stock (${stock})` : 'In stock'}
    </span>
  )
}

function FavoriteButton({ productId }: { productId: string }) {
  const ids = useWishlistIds()
  const saved = ids.includes(productId)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={btnRef}
      type="button"
      className={`favorite ${saved ? 'saved' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleWishlistId(productId)
        if (btnRef.current && !prefersReducedMotion()) {
          gsap.fromTo(
            btnRef.current,
            { scale: 0.8 },
            { scale: 1, duration: 0.45, ease: 'elastic.out(1.2, 0.4)' },
          )
        }
      }}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      title={saved ? 'Remove from saved' : 'Save item'}
    >
      <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}

function RoomSceneSvg({ night }: { night: boolean }) {
  return (
    <svg
      className="room-svg"
      viewBox="0 0 600 400"
      role="img"
      aria-label="Curated room desk setup with lamp, ambient LED strip, monitor, keyboard, and speaker"
    >
      <defs>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={night ? '0.09' : '0.16'} />
          <stop offset="100%" stopColor="var(--muted)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lampCone" cx="50%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.58" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="stripGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.54" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Wall & Floor */}
      <rect width="600" height="292" fill="var(--muted)" />
      <rect width="600" height="292" fill="url(#wallGrad)" />
      <rect y="292" width="600" height="108" fill="var(--card)" />
      <line x1="0" y1="292" x2="600" y2="292" stroke="var(--border)" strokeWidth="1.5" />
      <ellipse cx="300" cy="364" rx="220" ry="18" fill="var(--text)" opacity="0.05" />

      {/* Window */}
      <g data-svg-layer="window">
        <rect x="62" y="48" width="124" height="148" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <line x1="124" y1="48" x2="124" y2="196" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="62" y1="122" x2="186" y2="122" stroke="var(--border)" strokeWidth="1.5" />
        <circle cx="156" cy="80" r="10" fill="#f59e0b" opacity={night ? '0.22' : '0.7'} />
      </g>

      {/* Bias LED Strip */}
      <g data-svg-layer="strip">
        <ellipse cx="378" cy="106" rx="165" ry="26" fill="url(#stripGlow)" opacity={night ? '1' : '0.62'} />
        <rect x="232" y="94" width="292" height="7" rx="3.5" fill="#f59e0b" />
      </g>

      {/* Desk Surface & Legs */}
      <g data-svg-layer="desk">
        <rect x="46" y="268" width="508" height="13" rx="4" fill="var(--text)" opacity="0.92" />
        <rect x="78" y="281" width="9" height="96" rx="2" fill="var(--text)" opacity="0.72" />
        <rect x="513" y="281" width="9" height="96" rx="2" fill="var(--text)" opacity="0.72" />
      </g>

      {/* Monitor Stand & Desk Peripherals */}
      <g data-svg-layer="stand">
        <rect x="299" y="224" width="10" height="44" fill="var(--text)" />
        <rect x="266" y="261" width="76" height="7" rx="3" fill="var(--text)" opacity="0.85" />
        <rect x="374" y="260" width="66" height="8" rx="3" fill="var(--sub)" opacity="0.55" />
      </g>

      {/* Floating VESA Display */}
      <g data-svg-layer="monitor">
        <rect x="236" y="146" width="136" height="86" rx="8" fill="var(--text)" />
        <rect x="242" y="152" width="124" height="74" rx="4" fill="var(--card)" />
        <path
          d="M256 204 L278 180 L296 192 L320 166 L348 198"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Desk Lamp */}
      <g data-svg-layer="lamp">
        <rect x="96" y="260" width="30" height="8" rx="3" fill="var(--text)" />
        <path
          d="M111 260 V192 L142 164"
          fill="none"
          stroke="var(--text)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M132 154 L168 168 L158 188 Z" fill="#f59e0b" />
      </g>

      {/* Studio Speaker */}
      <g data-svg-layer="speaker">
        <rect x="468" y="206" width="52" height="62" rx="9" fill="var(--text)" />
        <circle cx="494" cy="246" r="14" fill="none" stroke="var(--card)" strokeWidth="2.5" opacity="0.85" />
        <circle cx="494" cy="222" r="4.5" fill="#f59e0b" />
      </g>

      {/* Potted Plant */}
      <g data-svg-layer="plant">
        <rect x="534" y="250" width="24" height="18" rx="3" fill="var(--sub)" />
        <path
          d="M546 250 C540 226 524 222 522 204 M546 250 C552 228 568 224 572 208"
          fill="none"
          stroke="#16a34a"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </g>

      {/* Night Ambient Overlay & Lamp Glow Cone */}
      <rect
        width="600"
        height="400"
        fill="#09090b"
        opacity={night ? '0.54' : '0'}
        style={{ transition: 'opacity 0.45s ease', pointerEvents: 'none' }}
      />
      <ellipse
        cx="162"
        cy="236"
        rx="145"
        ry="110"
        fill="url(#lampCone)"
        opacity={night ? '1' : '0'}
        style={{ transition: 'opacity 0.45s ease', pointerEvents: 'none' }}
      />
    </svg>
  )
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const stock = getEffectiveStock(product)
  const enabledVariants = (product.product_variants ?? []).filter((v) => v.enabled)
  const cardRef = useRef<HTMLElement>(null)

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    cardRef.current.style.setProperty('--spot-mx', `${e.clientX - rect.left}px`)
    cardRef.current.style.setProperty('--spot-my', `${e.clientY - rect.top}px`)
  }

  return (
    <article ref={cardRef} className="product-card" onPointerMove={handlePointerMove}>
      <div className="product-photo">
        <Link to={`/product/${product.slug}`} className="photo-link" aria-label={product.name}>
          <Photo product={product} className="thumb" />
          <div className="photo-scrim" aria-hidden="true" />
        </Link>
        {product.is_featured ? (
          <span className="featured-pill">
            <Sparkles size={11} /> Featured
          </span>
        ) : (
          <span className="index-pill">{String(index + 1).padStart(2, '0')}</span>
        )}
        <FavoriteButton productId={product.id} />
      </div>

      <div className="product-card-body">
        <div className="card-meta-row">
          <span className="card-category">
            {String(index + 1).padStart(2, '0')} // {product.category?.name ?? 'Collection'}
          </span>
          <StockBadge stock={stock} threshold={product.low_stock_threshold} />
        </div>

        <h2 className="card-title">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h2>

        {product.description && <p className="card-blurb">{product.description}</p>}

        <div className="card-footer-row">
          <div className="card-price-group">
            <strong className="card-price">{cash(product.price)}</strong>
            {enabledVariants.length > 0 && (
              <span className="card-variants-hint">
                {enabledVariants.length} {enabledVariants.length === 1 ? 'option' : 'options'}
              </span>
            )}
          </div>

          <Link className="card-cta" to={`/product/${product.slug}`}>
            <span>Explore</span>
            <ArrowUpRight size={14} className="cta-arrow" />
          </Link>
        </div>
      </div>
    </article>
  )
}

function RecentItemCard({ product }: { product: Product }) {
  const stock = getEffectiveStock(product)
  return (
    <article className="recent-card">
      <Link to={`/product/${product.slug}`} className="recent-card-media" aria-label={product.name}>
        <Photo product={product} className="recent-thumb" />
      </Link>

      <div className="recent-card-info">
        <div className="recent-card-top">
          <span className="card-category">{product.category?.name ?? 'Collection'}</span>
          <StockBadge stock={stock} threshold={product.low_stock_threshold} />
        </div>

        <h3>
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>

        <div className="recent-card-bottom">
          <strong className="recent-price">{cash(product.price)}</strong>
          <div className="recent-actions">
            <FavoriteButton productId={product.id} />
            <Link to={`/product/${product.slug}`} className="recent-open-btn" aria-label={`View ${product.name}`}>
              <span>View</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function WishlistDrawer({
  open,
  onClose,
  allProducts,
}: {
  open: boolean
  onClose: () => void
  allProducts: Product[]
}) {
  const wishlistIds = useWishlistIds()
  const { setPaused } = useSmoothScroll()
  const savedProducts = useMemo(
    () => wishlistIds.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean) as Product[],
    [wishlistIds, allProducts],
  )

  useEffect(() => {
    setPaused(open)
    return () => setPaused(false)
  }, [open, setPaused])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`wishlist-sheet ${open ? 'open' : ''}`} aria-label="Saved items" aria-hidden={!open}>
        <header className="sheet-header">
          <div>
            <h2>Saved items</h2>
            <small>{savedProducts.length} saved in your browser</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close saved items">
            <X size={16} />
          </button>
        </header>
        <div className="sheet-body" data-lenis-prevent>
          {savedProducts.length === 0 ? (
            <div className="state">
              <Heart size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p>No saved gadgets yet.</p>
              <small>Tap the heart icon on any product to save it for later.</small>
            </div>
          ) : (
            <ul className="saved-list">
              {savedProducts.map((p) => (
                <li key={p.id} className="saved-item">
                  <Link to={`/product/${p.slug}`} onClick={onClose} className="saved-thumb">
                    <Photo product={p} />
                  </Link>
                  <div className="saved-meta">
                    <Link to={`/product/${p.slug}`} onClick={onClose}>
                      <b>{p.name}</b>
                    </Link>
                    <span>{cash(p.price)}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => toggleWishlistId(p.id)}
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}

export function PublicLayout({ settings }: { settings: StoreSettings }) {
  return (
    <SmoothScrollProvider>
      <PublicLayoutInner settings={settings} />
    </SmoothScrollProvider>
  )
}

function PublicLayoutInner({ settings }: { settings: StoreSettings }) {
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [catalogSnapshot, setCatalogSnapshot] = useState<Product[]>([])
  const [demoMode, setDemoMode] = useState(() => !isSupabaseConfigured)
  const wishlistIds = useWishlistIds()
  const navigate = useNavigate()
  const location = useLocation()
  const { scrollTo, progressBarRef } = useSmoothScroll()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const goSection = (sectionId: string) => {
    setMobileMenuOpen(false)
    if (location.pathname !== '/') {
      navigate('/')
      window.setTimeout(() => scrollTo(`#${sectionId}`), 110)
    } else {
      scrollTo(`#${sectionId}`)
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span>
              <ShoppingBag size={15} />
            </span>
            {settings.store_name}
          </Link>

          <nav className="topbar-nav-center" aria-label="Main navigation">
            <button type="button" className="nav-btn" onClick={() => goSection('shop')}>
              Collection
            </button>
            <button type="button" className="nav-btn" onClick={() => goSection('promises')}>
              Promises
            </button>
            <Link to="/admin">Admin</Link>
          </nav>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button wishlist-trigger"
              onClick={() => setWishlistOpen(true)}
              aria-label="Open saved items"
              title="Saved items"
            >
              <Heart size={16} />
              {wishlistIds.length > 0 && <span className="badge-dot">{wishlistIds.length}</span>}
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="icon-button mobile-nav-toggle"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        <div className="scroll-progress" aria-hidden="true">
          <div className="scroll-progress-bar" ref={progressBarRef} />
        </div>

        {mobileMenuOpen && (
          <nav className="mobile-nav-panel" aria-label="Mobile navigation">
            <button type="button" onClick={() => goSection('shop')}>
              <span>Browse collection</span>
              <ArrowRight size={14} />
            </button>
            <button type="button" onClick={() => goSection('promises')}>
              <span>Store promises</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setWishlistOpen(true)
              }}
            >
              <span>Saved items ({wishlistIds.length})</span>
              <Heart size={14} />
            </button>
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
              <span>Admin dashboard</span>
              <ArrowUpRight size={14} />
            </Link>
          </nav>
        )}
      </header>

      <div className="site-main">
        <Routes>
          <Route
            index
            element={
              <Home
                settings={settings}
                demoMode={demoMode}
                setDemoMode={setDemoMode}
                onProductsLoaded={setCatalogSnapshot}
              />
            }
          />
          <Route path="product/:slug" element={<Details settings={settings} demoMode={demoMode} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <b>{settings.store_name}</b>
            <span>{settings.tagline}</span>
          </div>
          <div className="footer-links">
            {settings.tiktok_profile_url && (
              <a href={settings.tiktok_profile_url} target="_blank" rel="noopener noreferrer">
                TikTok Shop ↗
              </a>
            )}
            {settings.support_email && <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a>}
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      <WishlistDrawer
        open={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        allProducts={catalogSnapshot.length ? catalogSnapshot : getDemoCatalog().products}
      />
    </div>
  )
}

function Home({
  settings,
  demoMode,
  setDemoMode,
  onProductsLoaded,
}: {
  settings: StoreSettings
  demoMode: boolean
  setDemoMode: (v: boolean) => void
  onProductsLoaded: (items: Product[]) => void
}) {
  const [items, setItems] = useState<Product[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [recentIds, setRecentIds] = useState<string[]>(() => readIds('nook-recent'))
  const [nightScene, setNightScene] = useState(false)
  const [activeSpot, setActiveSpot] = useState<number | null>(null)

  const pageRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const heroPrimaryRef = useMagnetic<HTMLAnchorElement>(0.24)
  const heroTiltRef = useTilt3D<HTMLDivElement>(4.2)
  const { scrollTo } = useSmoothScroll()
  const dark = useDarkMode()

  useEffect(() => {
    let active = true
    if (demoMode || !isSupabaseConfigured) {
      const demo = getDemoCatalog()
      setItems(demo.products)
      setCats(demo.categories)
      onProductsLoaded(demo.products)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    Promise.all([getProducts(), getCategories()])
      .then(([products, categories]) => {
        if (!active) return
        setItems(products)
        setCats(categories)
        onProductsLoaded(products)
      })
      .catch((e: Error) => {
        if (!active) return
        setError(e.message || 'Could not load catalog from Supabase.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [demoMode, onProductsLoaded])

  const products = useMemo(() => {
    return items
      .filter((p) => {
        const matchesQuery =
          !query ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
        const matchesCat = !category || p.category_id === category
        const matchesStock = !inStockOnly || getEffectiveStock(p) > 0
        return matchesQuery && matchesCat && matchesStock
      })
      .sort((a, b) => {
        if (sort === 'featured')
          return Number(b.is_featured) - Number(a.is_featured) || +new Date(b.created_at) - +new Date(a.created_at)
        if (sort === 'low') return a.price - b.price
        if (sort === 'high') return b.price - a.price
        return +new Date(b.created_at) - +new Date(a.created_at)
      })
  }, [items, query, category, sort, inStockOnly])

  const recent = useMemo(
    () => recentIds.map((id) => items.find((product) => product.id === id)).filter(Boolean) as Product[],
    [recentIds, items],
  )

  const hotspots = useMemo(() => {
    if (!items.length) return []
    const pick = (keywords: string[], fallbackIdx: number) =>
      items.find((p) => keywords.some((k) => p.name.toLowerCase().includes(k) || p.slug.includes(k))) ??
      items[fallbackIdx % items.length]

    return [
      { x: 24, y: 44, label: 'Lighting', product: pick(['lamp', 'light'], 0) },
      { x: 60, y: 24, label: 'Ambient', product: pick(['strip', 'led', 'lumen'], 1) },
      { x: 51, y: 48, label: 'Workspace', product: pick(['keyboard', 'hub', 'charger', 'hanger'], 2) },
      { x: 82, y: 58, label: 'Audio', product: pick(['speaker', 'headphone', 'audio'], 3) },
    ].filter((s) => Boolean(s.product))
  }, [items])

  /* Master GSAP Hero + ScrollTrigger Choreography */
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !pageRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })

      tl.fromTo(
        '.nook-badge',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, clearProps: 'transform,opacity' },
      )
        .fromTo(
          '.hero-title-inner',
          { yPercent: 105, skewY: 2.5, opacity: 0 },
          { yPercent: 0, skewY: 0, opacity: 1, duration: 0.9, clearProps: 'transform,opacity' },
          '-=0.45',
        )
        .fromTo(
          '.hero-subtitle',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, clearProps: 'transform,opacity' },
          '-=0.55',
        )
        .fromTo(
          '.hero-actions > *',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, clearProps: 'transform,opacity' },
          '-=0.48',
        )
        .fromTo(
          '.hero-stat',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, clearProps: 'transform,opacity' },
          '-=0.42',
        )
        .fromTo(
          '.hero-visual',
          { scale: 0.94, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.95, ease: 'expo.out', clearProps: 'opacity' },
          '-=0.85',
        )
        .fromTo(
          '[data-svg-layer]',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.055, ease: 'power3.out', clearProps: 'opacity' },
          '-=0.6',
        )

      gsap.to('[data-svg-layer="monitor"]', {
        y: -5,
        duration: 2.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })

      gsap.fromTo(
        '.catalog-head-reveal',
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: '.catalog',
            start: 'top 86%',
            once: true,
          },
        },
      )

      gsap.fromTo(
        '.promise-card',
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: '.nook-promises',
            start: 'top 88%',
            once: true,
          },
        },
      )
    }, pageRef)

    return () => ctx.revert()
  }, [])

  /* Animate hotspots when items arrive */
  useEffect(() => {
    if (!hotspots.length || prefersReducedMotion() || !heroRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.room-hotspot',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: 'back.out(2)',
          clearProps: 'transform,opacity',
        },
      )
    }, heroRef)
    return () => ctx.revert()
  }, [hotspots.length])

  /* Animate hotspot popover when opened */
  useEffect(() => {
    if (activeSpot === null || !popoverRef.current || prefersReducedMotion()) return
    gsap.fromTo(
      popoverRef.current,
      { y: 10, scale: 0.94, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.6)', clearProps: 'opacity' },
    )
  }, [activeSpot])

  /* Stagger product cards when catalog loads or filters update */
  useEffect(() => {
    if (loading || !products.length || prefersReducedMotion() || !gridRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.product-card',
        { y: 28, opacity: 0, scale: 0.98 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.58,
          stagger: { amount: Math.min(products.length * 0.05, 0.35) },
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      )
    }, gridRef)
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [loading, category, sort, inStockOnly, query, products.length])

  return (
    <div ref={pageRef as React.RefObject<HTMLDivElement>}>
      <main className="store">
        <section className="store-hero" ref={heroRef}>
          <div className="hero-copy">
            <span className="nook-badge">
              <i className="badge-pulse" aria-hidden="true" />
              {settings.hero_badge}
            </span>
            <h1 className="hero-display-title">
              <span className="hero-title-mask">
                <span className="hero-title-inner">{settings.hero_title}</span>
              </span>
            </h1>
            <p className="hero-subtitle">{settings.hero_subtitle}</p>
            <div className="hero-actions">
              <a
                ref={heroPrimaryRef}
                className="button hero-primary-btn"
                href="#shop"
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo('#shop')
                }}
              >
                <span>Explore collection</span>
                <ArrowRight size={15} />
              </a>
              <a
                className="button secondary hero-secondary-btn"
                href="#promises"
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo('#promises')
                }}
              >
                Why {settings.store_name}
              </a>
            </div>

            <div className="hero-stats" aria-label="Store highlights">
              <div className="hero-stat">
                <strong>{String(items.length || 8).padStart(2, '0')}+</strong>
                <span>Curated objects</span>
              </div>
              <div className="hero-stat">
                <strong>24H</strong>
                <span>Tracked dispatch</span>
              </div>
              <div className="hero-stat">
                <strong>100%</strong>
                <span>Official TikTok Shop</span>
              </div>
            </div>
          </div>

          <div
            ref={heroTiltRef}
            className={`hero-visual ${nightScene ? 'night' : ''}`}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('.room-hotspot, .hotspot-popover')) {
                setActiveSpot(null)
              }
            }}
          >
            <RoomSceneSvg night={nightScene} />

            {hotspots.map((spot, idx) => (
              <button
                key={idx}
                type="button"
                className={`room-hotspot ${activeSpot === idx ? 'active' : ''}`}
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                onClick={() => setActiveSpot(activeSpot === idx ? null : idx)}
                aria-label={`Inspect ${spot.product.name}`}
                aria-expanded={activeSpot === idx}
              >
                <Plus size={14} />
              </button>
            ))}

            {activeSpot !== null && hotspots[activeSpot] && (
              <div
                ref={popoverRef}
                className="hotspot-popover"
                style={
                  {
                    '--spot-x': `${Math.min(Math.max(hotspots[activeSpot].x, 26), 74)}%`,
                    '--spot-top': hotspots[activeSpot].y > 50 ? 'auto' : `calc(${hotspots[activeSpot].y}% + 20px)`,
                    '--spot-bottom':
                      hotspots[activeSpot].y > 50 ? `calc(${100 - hotspots[activeSpot].y}% + 20px)` : 'auto',
                  } as CSSProperties
                }
              >
                <div className="hotspot-popover-head">
                  <p className="tag">{hotspots[activeSpot].product.category?.name ?? hotspots[activeSpot].label}</p>
                  <button
                    type="button"
                    className="hotspot-close"
                    onClick={() => setActiveSpot(null)}
                    aria-label="Close preview"
                  >
                    <X size={12} />
                  </button>
                </div>
                <b>{hotspots[activeSpot].product.name}</b>
                <div className="hotspot-row">
                  <span>{cash(hotspots[activeSpot].product.price)}</span>
                  <Link className="card-cta sm-cta" to={`/product/${hotspots[activeSpot].product.slug}`}>
                    <span>Open</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            )}

            <button
              type="button"
              className="scene-light-toggle"
              onClick={() => setNightScene((v) => !v)}
              aria-pressed={nightScene}
            >
              {nightScene ? <Sun size={13} /> : <Moon size={13} />}
              <span>{nightScene ? 'Day studio' : 'Night studio'}</span>
            </button>
            <span className="scene-caption">TAP + TO INSPECT</span>
          </div>

          <Crosshair
            containerRef={heroRef}
            color={dark ? '#fafafa' : '#09090b'}
            targetEffect="lock"
            thickness={1}
            opacity={0.18}
            smoothing={0.35}
            showCoordinates
            lineStyle="solid"
            blendMode="normal"
            gap={4}
            fade={0}
            clickPulse
            hideCursor={false}
          />
        </section>
      </main>

      <KineticMarquee
        items={[
          'ARCHITECTURAL WORKSPACE OBJECTS',
          'WARM AMBIENT LIGHTING',
          'OFFICIAL TIKTOK SHOP CHECKOUT',
          'VERIFIED STOCK & VARIANTS',
          settings.store_name.toUpperCase(),
        ]}
      />

      <main className="store">
        {!isSupabaseConfigured && (
          <div className="notice notice-flex">
            <div>
              <b>Demo mode active:</b> Connect Supabase in <code>.env</code> and run <code>supabase/schema.sql</code>{' '}
              to use live catalog data.
            </div>
          </div>
        )}

        {isSupabaseConfigured && demoMode && (
          <div className="notice notice-flex">
            <div>
              <Sparkles size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              <b>Previewing starter catalog.</b> Switch back to your live Supabase database anytime.
            </div>
            <button type="button" className="button secondary sm-btn" onClick={() => setDemoMode(false)}>
              Use live database
            </button>
          </div>
        )}

        {error && !demoMode && (
          <div className="notice notice-flex">
            <div>
              <b>Database connection issue:</b> {error}
            </div>
            <button type="button" className="button secondary sm-btn" onClick={() => setDemoMode(true)}>
              Preview demo catalog
            </button>
          </div>
        )}

        <section className="catalog" id="shop">
          <div className="catalog-head-reveal">
            <div className="section-heading">
              <div>
                <p className="eyebrow">01 // CURATED CATALOG</p>
                <h2>Bold objects built to elevate everyday rooms.</h2>
              </div>
              <span className="count-pill">
                {products.length} {products.length === 1 ? 'OBJECT' : 'OBJECTS'}
              </span>
            </div>

            <div className="catalog-toolbar">
              {cats.length > 0 && (
                <div className="category-pills-scroll">
                  <div className="category-pills" role="tablist" aria-label="Filter by category">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={category === ''}
                      className={category === '' ? 'active' : ''}
                      onClick={() => setCategory('')}
                    >
                      All objects
                    </button>
                    {cats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="tab"
                        aria-selected={category === c.id}
                        className={category === c.id ? 'active' : ''}
                        onClick={() => setCategory(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="filters">
                <label className="search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search gadgets, lighting, desk essentials…"
                  />
                  {query && (
                    <button type="button" className="plain" onClick={() => setQuery('')} aria-label="Clear search">
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className="filter-controls">
                  <div className="select-wrap">
                    <SlidersHorizontal size={13} />
                    <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
                      <option value="newest">Newest drops</option>
                      <option value="featured">Featured first</option>
                      <option value="low">Price: low to high</option>
                      <option value="high">Price: high to low</option>
                    </select>
                  </div>
                  <label className={`stock-filter ${inStockOnly ? 'checked' : ''}`}>
                    <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
                    <span>In stock only</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <CatalogSkeletonGrid />
          ) : products.length > 0 ? (
            <div className="product-grid" ref={gridRef}>
              {products.map((product, idx) => (
                <ProductCard product={product} index={idx} key={product.id} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="state">
              <p style={{ marginBottom: 12 }}>No products published in your catalog yet.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link className="button" to="/admin/products">
                  Open Admin to add or seed products
                </Link>
                {!demoMode && (
                  <button type="button" className="button secondary" onClick={() => setDemoMode(true)}>
                    Preview starter catalog
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="state">
              <p>No gadgets match your current filters.</p>
              <button
                type="button"
                className="button secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setQuery('')
                  setCategory('')
                  setInStockOnly(false)
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section className="recent-showcase" aria-labelledby="recent-heading">
            <div className="recent-header">
              <div className="recent-heading-group">
                <span className="recent-icon-badge" aria-hidden="true">
                  <Clock size={15} />
                </span>
                <div>
                  <p className="eyebrow">02 // YOUR HISTORY</p>
                  <h2 id="recent-heading">Recently viewed</h2>
                </div>
              </div>
              <button
                type="button"
                className="clear-history-btn"
                onClick={() => {
                  localStorage.removeItem('nook-recent')
                  setRecentIds([])
                }}
              >
                <RotateCcw size={13} />
                <span>Clear history</span>
              </button>
            </div>

            <div className="recent-grid">
              {recent.map((product) => (
                <RecentItemCard product={product} key={product.id} />
              ))}
            </div>
          </section>
        )}

        <section className="nook-promises" id="promises">
          <div className="promise-card">
            <span className="promise-icon">
              <Truck size={18} />
            </span>
            <div>
              <b>{settings.free_shipping_text}</b>
              <span>Fast tracked fulfillment in 3 to 5 business days.</span>
            </div>
          </div>
          <div className="promise-card">
            <span className="promise-icon">
              <RotateCcw size={18} />
            </span>
            <div>
              <b>{settings.returns_text}</b>
              <span>Test it in your space with hassle-free returns.</span>
            </div>
          </div>
          <div className="promise-card">
            <span className="promise-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <b>{settings.warranty_text}</b>
              <span>Quality protection on every curated item.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Details({ settings, demoMode }: { settings: StoreSettings; demoMode: boolean }) {
  const { slug = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [selected, setSelected] = useState(0)
  const [variantId, setVariantId] = useState('')
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState<Review[]>([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewAuthor, setReviewAuthor] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewSent, setReviewSent] = useState(false)
  const [reviewErr, setReviewErr] = useState('')

  const detailRootRef = useRef<HTMLDivElement>(null)
  const mainPhotoRef = useRef<HTMLDivElement>(null)
  const buyBtnRef = useMagnetic<HTMLButtonElement>(0.18)

  useEffect(() => {
    let active = true
    setProduct(null)
    setError('')
    setSelected(0)
    setVariantId('')
    setReviewSent(false)

    const applyProduct = (p: Product) => {
      if (!active) return
      setProduct(p)
      const enabledVars = (p.product_variants ?? []).filter((v) => v.enabled)
      const firstAvailable = enabledVars.find((v) => v.stock_quantity > 0) ?? enabledVars[0]
      if (firstAvailable) setVariantId(firstAvailable.id)

      remember('nook-recent', p.id)
      void trackView(p.id, sid())
      document.title = p.seo_title || `${p.name} — ${settings.store_name}`
      const description =
        document.querySelector('meta[name="description"]') ||
        document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'description' }))
      description.setAttribute('content', p.seo_description || p.description.slice(0, 160))
    }

    if (demoMode || !isSupabaseConfigured) {
      const found = getDemoCatalog().products.find((p) => p.slug === slug)
      if (found) applyProduct(found)
      else setError('Product not found in demo catalog.')
      return () => {
        active = false
      }
    }

    getProduct(slug)
      .then((p) => {
        applyProduct(p)
        return getApprovedReviews(p.id)
      })
      .then((revs) => {
        if (active && revs) setReviews(revs)
      })
      .catch((e: Error) => {
        const demoFallback = getDemoCatalog().products.find((p) => p.slug === slug)
        if (demoFallback) {
          applyProduct(demoFallback)
        } else if (active) {
          setError(e.message)
        }
      })

    return () => {
      active = false
    }
  }, [slug, demoMode, settings.store_name])

  /* GSAP Product Detail Entrance Choreography */
  useLayoutEffect(() => {
    if (!product || prefersReducedMotion() || !detailRootRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gallery',
        { y: 24, scale: 0.97, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' },
      )
      gsap.fromTo(
        '.detail-panel > *',
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.62,
          stagger: 0.055,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      )
    }, detailRootRef)
    return () => ctx.revert()
  }, [product?.id])

  /* Cross-fade main photo when switching thumbnail or variant */
  useEffect(() => {
    if (!product || prefersReducedMotion() || !mainPhotoRef.current) return
    gsap.fromTo(
      mainPhotoRef.current,
      { opacity: 0.6, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.38, ease: 'power2.out', clearProps: 'transform,opacity' },
    )
  }, [selected, variantId, product])

  if (error) {
    return (
      <main className="store" style={{ padding: '56px 0' }}>
        <div className="state">
          <p style={{ marginBottom: 14 }}>{error}</p>
          <Link className="button secondary" to="/">
            ← Back to storefront
          </Link>
        </div>
      </main>
    )
  }

  if (!product) {
    return <ProductDetailSkeleton />
  }

  const images = product.product_images ?? []
  const variants = (product.product_variants ?? []).filter((v) => v.enabled)
  const variant = variants.find((item) => item.id === variantId)
  const stock = variant ? variant.stock_quantity : getEffectiveStock(product)
  const canBuy = product.availability && stock > 0

  const buy = async () => {
    if (!canBuy) return
    try {
      await trackOutboundClick(product.id, sid())
    } finally {
      window.open(variant?.tiktok_url || product.tiktok_url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setReviewErr('')
    if (reviewBody.trim().length < 3) {
      setReviewErr('Please write at least a short comment (3+ characters).')
      return
    }
    setReviewBusy(true)
    try {
      await submitReview({
        product_id: product.id,
        author_name: reviewAuthor,
        rating: reviewRating,
        body: reviewBody,
      })
      setReviewSent(true)
      setReviewBody('')
      setShowReviewForm(false)
    } catch (err) {
      setReviewErr(err instanceof Error ? err.message : 'Could not submit review.')
    } finally {
      setReviewBusy(false)
    }
  }

  const avgRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null

  return (
    <div className="store" ref={detailRootRef}>
      <div className="detail-breadcrumb">
        <Link to="/">← Back to collection</Link>
      </div>

      <main className="detail">
        <div className="gallery">
          <div className="main-photo" ref={mainPhotoRef}>
            {variant?.image_url ? (
              <img src={variant.image_url} alt={`${product.name} — ${variant.name}`} />
            ) : images[selected] ? (
              <img src={images[selected].image_url} alt={product.name} />
            ) : (
              <Photo product={product} />
            )}
          </div>
          {images.length > 1 && (
            <div className="thumbnails">
              {images.map((img, i) => (
                <button
                  type="button"
                  className={selected === i ? 'active' : ''}
                  onClick={() => setSelected(i)}
                  key={img.id}
                >
                  <img src={img.image_url} alt={`${product.name} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="detail-panel">
          <div className="detail-top">
            <span className="card-category">OBJECT // {product.category?.name ?? 'Collection'}</span>
            <FavoriteButton productId={product.id} />
          </div>

          <h1>{product.name}</h1>

          <div className="detail-price-bar">
            <strong className="detail-price">{cash(variant?.price ?? product.price)}</strong>
            <StockBadge stock={stock} threshold={product.low_stock_threshold} />
            {avgRating && (
              <div className="rating-summary">
                <Star size={14} fill="#f59e0b" color="#f59e0b" />
                <b>{avgRating}</b>
                <span>({reviews.length})</span>
              </div>
            )}
          </div>

          <p className="detail-description">{product.description}</p>

          {variants.length > 0 && (
            <div className="variant-picker">
              <label>CHOOSE CONFIGURATION</label>
              <div>
                {variants.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={variantId === item.id ? 'selected' : ''}
                    onClick={() => setVariantId(item.id)}
                    disabled={item.stock_quantity <= 0}
                  >
                    {item.name}
                    {item.price != null && item.price !== product.price ? ` · ${cash(item.price)}` : ''}
                    {item.stock_quantity <= 0 ? ' · Sold out' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <dl className="detail-specs">
            <div>
              <dt>CATEGORY</dt>
              <dd>{product.category?.name ?? 'General Collection'}</dd>
            </div>
            <div>
              <dt>AVAILABILITY</dt>
              <dd>{stock <= 0 ? 'Out of stock' : `${stock} units ready`}</dd>
            </div>
            {variant?.sku && (
              <div>
                <dt>SKU</dt>
                <dd>{variant.sku}</dd>
              </div>
            )}
            <div>
              <dt>CHECKOUT</dt>
              <dd>Official TikTok Shop</dd>
            </div>
          </dl>

          <button ref={buyBtnRef} type="button" className="button buy" onClick={buy} disabled={!canBuy}>
            <span>{canBuy ? 'Buy now on TikTok Shop' : 'Currently unavailable'}</span>
            {canBuy && <ExternalLink size={16} />}
          </button>

          {variant && !variant.tiktok_url && (
            <small className="variant-note">
              Your configuration is highlighted here for reference. Confirm the same option on TikTok Shop at checkout.
            </small>
          )}

          <div className="detail-reassurance">
            <span>
              <ShieldCheck size={14} /> Verified listing
            </span>
            <span>
              <Truck size={14} /> {settings.free_shipping_text}
            </span>
          </div>
        </section>
      </main>

      {!product.id.startsWith('demo-') && isSupabaseConfigured && (
        <section className="reviews-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">COMMUNITY FEEDBACK</p>
              <h2>Customer reviews {reviews.length > 0 ? `(${reviews.length})` : ''}</h2>
            </div>
            {!showReviewForm && !reviewSent && (
              <button type="button" className="button secondary" onClick={() => setShowReviewForm(true)}>
                Write a review
              </button>
            )}
          </div>

          {reviewSent && (
            <div className="notice success-notice">
              <CheckCircle2 size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              Thank you! Your review has been submitted and will appear once approved by our team.
            </div>
          )}

          {showReviewForm && (
            <form className="panel review-form" onSubmit={handleReviewSubmit}>
              <h3>Share your experience with {product.name}</h3>
              {reviewErr && <div className="notice">{reviewErr}</div>}
              <div className="form-grid" style={{ marginTop: 12 }}>
                <label>
                  Your name
                  <input
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    placeholder="Alex M."
                    maxLength={60}
                  />
                </label>
                <label>
                  Rating
                  <div className="star-picker">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        aria-label={`${n} stars`}
                        className={n <= reviewRating ? 'lit' : ''}
                      >
                        <Star size={18} fill={n <= reviewRating ? '#f59e0b' : 'none'} color="#f59e0b" />
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <label style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 500 }}>
                Review
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="How does it fit into your space?"
                />
              </label>
              <div className="form-actions">
                <button type="button" className="button secondary" onClick={() => setShowReviewForm(false)}>
                  Cancel
                </button>
                <button className="button" disabled={reviewBusy}>
                  {reviewBusy && <InlineSpinner size={14} />}
                  {reviewBusy ? 'Submitting…' : 'Submit review'}
                </button>
              </div>
            </form>
          )}

          {reviews.length > 0 ? (
            <div className="review-grid">
              {reviews.map((rev) => (
                <article key={rev.id} className="panel review-card">
                  <div className="review-card-top">
                    <div className="stars-row">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          fill={i < rev.rating ? '#f59e0b' : 'none'}
                          color={i < rev.rating ? '#f59e0b' : '#a1a1aa'}
                        />
                      ))}
                    </div>
                    {rev.verified_purchase && <span className="verified-pill">Verified purchase</span>}
                  </div>
                  <p>{rev.body}</p>
                  <small>
                    {rev.author_name || 'Customer'} · {new Date(rev.created_at).toLocaleDateString()}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            !showReviewForm && <div className="state">No reviews yet. Be the first to review this gadget.</div>
          )}
        </section>
      )}
    </div>
  )
}
