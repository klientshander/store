import { ShoppingBag } from 'lucide-react'

/**
 * Crisp inline orbital arc spinner for buttons & live status pills.
 */
export function InlineSpinner({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="inline-orbital-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.6" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Full-page / route loader with counter-rotating dual orbital rings
 * for lazy-loaded Admin portal & session verification.
 */
export function StudioRouteLoader({
  title = 'Loading workspace',
  subtitle = 'VERIFYING SESSION & SYNCING MODULES',
}: {
  title?: string
  subtitle?: string
}) {
  return (
    <div className="studio-route-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="route-loader-card">
        <div className="preloader-emblem light-adapt">
          <span className="orbital-ring outer" />
          <span className="orbital-ring inner" />
          <span className="orbital-core">
            <ShoppingBag size={18} />
          </span>
        </div>
        <b>{title}</b>
        <span>{subtitle}</span>
        <div className="indeterminate-track" aria-hidden="true">
          <div className="indeterminate-bar" />
        </div>
      </div>
    </div>
  )
}

/**
 * Storefront 6-card Bento Skeleton Grid matching Desktop (3-col), Tablet (2-col), and Mobile (1-col).
 */
export function CatalogSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-stage" role="status" aria-live="polite" aria-busy="true">
      <div className="sync-status-pill">
        <InlineSpinner size={13} />
        <span>SYNCING LIVE INVENTORY…</span>
      </div>
      <div className="product-grid">
        {Array.from({ length: count }).map((_, idx) => (
          <div className="product-card skeleton-card" key={idx} aria-hidden="true">
            <div className="product-photo skel-shimmer">
              <span className="skel-pill top-left" />
              <span className="skel-circle top-right" />
            </div>
            <div className="product-card-body">
              <div className="card-meta-row">
                <span className="skel-line skel-shimmer" style={{ width: '38%', height: 11 }} />
                <span className="skel-line skel-shimmer" style={{ width: '24%', height: 18, borderRadius: 999 }} />
              </div>
              <span className="skel-line skel-shimmer" style={{ width: '74%', height: 19, marginTop: 6 }} />
              <span className="skel-line skel-shimmer" style={{ width: '92%', height: 12, marginTop: 6 }} />
              <span className="skel-line skel-shimmer" style={{ width: '64%', height: 12 }} />
              <div className="card-footer-row" style={{ marginTop: 12 }}>
                <span className="skel-line skel-shimmer" style={{ width: '32%', height: 22 }} />
                <span className="skel-line skel-shimmer" style={{ width: 92, height: 34, borderRadius: 999 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Product Detail 2-column CLS-free skeleton matching .detail layout.
 */
export function ProductDetailSkeleton() {
  return (
    <div className="store" role="status" aria-live="polite" aria-busy="true">
      <div className="detail-breadcrumb">
        <span className="skel-line skel-shimmer" style={{ width: 148, height: 13, display: 'inline-block' }} />
      </div>
      <div className="detail">
        <div className="gallery" aria-hidden="true">
          <div className="main-photo skel-shimmer" />
          <div className="thumbnails">
            {[0, 1, 2].map((n) => (
              <div
                key={n}
                className="skel-shimmer"
                style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0 }}
              />
            ))}
          </div>
        </div>

        <section className="detail-panel" aria-hidden="true">
          <div className="detail-top">
            <span className="skel-line skel-shimmer" style={{ width: '36%', height: 12 }} />
            <span className="skel-line skel-shimmer" style={{ width: 34, height: 34, borderRadius: 10 }} />
          </div>
          <span className="skel-line skel-shimmer" style={{ width: '82%', height: 34, marginTop: 14 }} />
          <div className="detail-price-bar" style={{ marginTop: 16 }}>
            <span className="skel-line skel-shimmer" style={{ width: 110, height: 28 }} />
            <span className="skel-line skel-shimmer" style={{ width: 78, height: 22, borderRadius: 999 }} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
            <span className="skel-line skel-shimmer" style={{ width: '96%', height: 13 }} />
            <span className="skel-line skel-shimmer" style={{ width: '88%', height: 13 }} />
            <span className="skel-line skel-shimmer" style={{ width: '68%', height: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            <span className="skel-line skel-shimmer" style={{ width: 96, height: 34, borderRadius: 999 }} />
            <span className="skel-line skel-shimmer" style={{ width: 104, height: 34, borderRadius: 999 }} />
          </div>
          <div className="detail-specs" style={{ marginTop: 22 }}>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} style={{ display: 'grid', gap: 6 }}>
                <span className="skel-line skel-shimmer" style={{ width: '48%', height: 10 }} />
                <span className="skel-line skel-shimmer" style={{ width: '76%', height: 14 }} />
              </div>
            ))}
          </div>
          <span className="skel-line skel-shimmer" style={{ width: '100%', height: 48, borderRadius: 12 }} />
        </section>
      </div>
    </div>
  )
}

/**
 * Admin KPI + Table shimmer skeleton for Dashboard, Products, Orders & Reviews.
 */
export function AdminSectionSkeleton({
  showMetrics = false,
  rows = 5,
  label = 'SYNCING STORE RECORDS…',
}: {
  showMetrics?: boolean
  rows?: number
  label?: string
}) {
  return (
    <div className="admin-skeleton-wrap" role="status" aria-live="polite" aria-busy="true">
      <div className="sync-status-pill" style={{ marginBottom: 14 }}>
        <InlineSpinner size={13} />
        <span>{label}</span>
      </div>

      {showMetrics && (
        <div className="metrics" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div className="metric" key={i}>
              <span className="skel-line skel-shimmer" style={{ width: '46%', height: 11 }} />
              <span className="skel-line skel-shimmer" style={{ width: '62%', height: 28, marginTop: 10 }} />
              <span className="skel-line skel-shimmer" style={{ width: '54%', height: 10, marginTop: 10 }} />
            </div>
          ))}
        </div>
      )}

      <div className="panel" aria-hidden="true" style={{ display: 'grid', gap: 14 }}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div className="skel-table-row" key={idx}>
            <span className="skel-line skel-shimmer" style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
              <span className="skel-line skel-shimmer" style={{ width: `${58 - (idx % 3) * 10}%`, height: 14 }} />
              <span className="skel-line skel-shimmer" style={{ width: '34%', height: 10 }} />
            </div>
            <span className="skel-line skel-shimmer hide-xs" style={{ width: 78, height: 22, borderRadius: 999 }} />
            <span className="skel-line skel-shimmer" style={{ width: 64, height: 16 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
