import type { Category, Product, StoreSettings } from '../types/database'

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: 1,
  store_name: 'Nook',
  tagline: 'Gadgets and rooms, designed together.',
  hero_badge: 'New: curated collections',
  hero_title: 'Gadgets that already fit your room.',
  hero_subtitle: 'Browse thoughtful products, then open the original TikTok Shop listing whenever you are ready to buy.',
  tiktok_profile_url: 'https://www.tiktok.com',
  support_email: 'hello@nook.store',
  free_shipping_text: 'Free shipping over $150',
  returns_text: '30-day returns',
  warranty_text: '2-year warranty',
}

function makeArtDataUri(bgStart: string, bgEnd: string, innerSvg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#bg)"/>
    <ellipse cx="200" cy="248" rx="95" ry="12" fill="#09090b" opacity="0.1"/>
    <g transform="translate(100, 48) scale(1.0)">${innerSvg}</g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const STARTER_CATEGORIES: Omit<Category, 'id' | 'created_at'>[] = [
  { name: 'Lighting', slug: 'lighting', description: 'Warm ambient lamps and bias lighting for calm workspaces.' },
  { name: 'Audio', slug: 'audio', description: 'Compact speakers and noise-cancelling headphones.' },
  { name: 'Desk', slug: 'desk', description: 'Tactile keyboards, chargers, and everyday desk essentials.' },
  { name: 'Smart home', slug: 'smart-home', description: 'Quiet air purifiers and connected room controls.' },
]

export type StarterProductSeed = {
  name: string
  slug: string
  categorySlug: string
  price: number
  stock_quantity: number
  low_stock_threshold: number
  is_featured: boolean
  description: string
  tiktok_url: string
  image_url: string
  variants?: { name: string; sku: string; price: number | null; stock_quantity: number }[]
}

export const STARTER_PRODUCTS: StarterProductSeed[] = [
  {
    name: 'Aura desk lamp',
    slug: 'aura-desk-lamp',
    categorySlug: 'lighting',
    price: 89,
    stock_quantity: 18,
    low_stock_threshold: 5,
    is_featured: true,
    description: 'Warm-to-cool stepless dimming with capacitive touch control and weighted anodized base.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#fef3c7',
      '#f4f4f5',
      `<path d="M60 190h80" stroke="#18181b" stroke-width="10" stroke-linecap="round"/><path d="M100 190V95l48-48" fill="none" stroke="#18181b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M144 82l36 90H116z" fill="#f59e0b" opacity="0.24"/><path d="M128 36l48 20-14 28z" fill="#f59e0b"/>`,
    ),
    variants: [
      { name: 'Matte Black', sku: 'AURA-BLK', price: 89, stock_quantity: 11 },
      { name: 'Brushed Brass', sku: 'AURA-BRS', price: 99, stock_quantity: 7 },
    ],
  },
  {
    name: 'Pulse speaker',
    slug: 'pulse-speaker',
    categorySlug: 'audio',
    price: 149,
    stock_quantity: 12,
    low_stock_threshold: 4,
    is_featured: true,
    description: 'Room-filling 360-degree acoustics wrapped in woven acoustic fabric with 18-hour battery life.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#e0e7ff',
      '#f4f4f5',
      `<rect x="52" y="34" width="96" height="146" rx="22" fill="#18181b"/><circle cx="100" cy="128" r="28" fill="none" stroke="#fafafa" stroke-width="4" opacity="0.8"/><circle cx="100" cy="128" r="10" fill="#fafafa" opacity="0.8"/><circle cx="100" cy="68" r="8" fill="#f59e0b"/>`,
    ),
  },
  {
    name: 'Halo wireless charger',
    slug: 'halo-wireless-charger',
    categorySlug: 'desk',
    price: 49,
    stock_quantity: 24,
    low_stock_threshold: 5,
    is_featured: false,
    description: '15W magnetic Qi2 fast charging pad crafted from solid slate aluminum and soft silicone.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#d1fae5',
      '#f4f4f5',
      `<ellipse cx="100" cy="164" rx="68" ry="18" fill="#18181b"/><ellipse cx="100" cy="156" rx="38" ry="9" fill="none" stroke="#f59e0b" stroke-width="4"/><rect x="68" y="42" width="64" height="86" rx="12" fill="#18181b" transform="rotate(-8 100 85)"/><rect x="74" y="50" width="52" height="70" rx="7" fill="#fafafa" opacity="0.9" transform="rotate(-8 100 85)"/>`,
    ),
  },
  {
    name: 'Orbit smart hub',
    slug: 'orbit-smart-hub',
    categorySlug: 'smart-home',
    price: 79,
    stock_quantity: 9,
    low_stock_threshold: 4,
    is_featured: false,
    description: 'Matter & Thread room controller to orchestrate lamps, plugs, and scenes with one dial.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#e0f2fe',
      '#f4f4f5',
      `<rect x="38" y="84" width="124" height="72" rx="24" fill="#18181b"/><path d="M72 84c0-32 56-32 56 0" fill="none" stroke="#18181b" stroke-width="7"/><circle cx="100" cy="120" r="9" fill="#f59e0b"/><circle cx="68" cy="120" r="4" fill="#fafafa" opacity="0.7"/><circle cx="132" cy="120" r="4" fill="#fafafa" opacity="0.7"/>`,
    ),
  },
  {
    name: 'Ember mechanical keyboard',
    slug: 'ember-keyboard',
    categorySlug: 'desk',
    price: 129,
    stock_quantity: 14,
    low_stock_threshold: 5,
    is_featured: true,
    description: 'Gasket-mounted 75% wireless mechanical keyboard with quiet tactile switches and CNC aluminum frame.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#fce7f3',
      '#f4f4f5',
      `<rect x="16" y="70" width="168" height="84" rx="12" fill="#18181b"/><rect x="28" y="84" width="22" height="14" rx="3" fill="#fafafa" opacity="0.85"/><rect x="56" y="84" width="22" height="14" rx="3" fill="#fafafa" opacity="0.85"/><rect x="84" y="84" width="22" height="14" rx="3" fill="#fafafa" opacity="0.85"/><rect x="112" y="84" width="22" height="14" rx="3" fill="#fafafa" opacity="0.85"/><rect x="140" y="84" width="32" height="14" rx="3" fill="#f59e0b"/><rect x="28" y="105" width="144" height="14" rx="3" fill="#fafafa" opacity="0.75"/><rect x="54" y="126" width="92" height="14" rx="3" fill="#f59e0b"/>`,
    ),
    variants: [
      { name: 'Tactile Quiet', sku: 'EMB-TAC', price: 129, stock_quantity: 9 },
      { name: 'Linear Smooth', sku: 'EMB-LIN', price: 129, stock_quantity: 5 },
    ],
  },
  {
    name: 'Lumen LED bias strip',
    slug: 'lumen-led-strip',
    categorySlug: 'lighting',
    price: 39,
    stock_quantity: 30,
    low_stock_threshold: 6,
    is_featured: true,
    description: 'Two meters of high-CRI warm-to-sunset ambient light designed for desks, monitors, and shelving.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#f3e8ff',
      '#f4f4f5',
      `<path d="M20 135c36-62 72 48 106-14s48-34 58-6" fill="none" stroke="#f59e0b" stroke-width="24" opacity="0.26" stroke-linecap="round"/><path d="M20 135c36-62 72 48 106-14s48-34 58-6" fill="none" stroke="#18181b" stroke-width="8" stroke-linecap="round"/><path d="M20 135c36-62 72 48 106-14s48-34 58-6" fill="none" stroke="#f59e0b" stroke-width="9" stroke-linecap="round" stroke-dasharray="0 20"/>`,
    ),
  },
  {
    name: 'Drift ANC headphones',
    slug: 'drift-headphones',
    categorySlug: 'audio',
    price: 249,
    stock_quantity: 4,
    low_stock_threshold: 5,
    is_featured: true,
    description: 'Adaptive hybrid noise cancelling over-ear headphones with memory-foam cushions and 40-hour battery.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#fee2e2',
      '#f4f4f5',
      `<path d="M44 120V104a56 56 0 0 1 112 0v16" fill="none" stroke="#18181b" stroke-width="10" stroke-linecap="round"/><rect x="30" y="108" width="32" height="58" rx="14" fill="#18181b"/><rect x="138" y="108" width="32" height="58" rx="14" fill="#18181b"/><rect x="38" y="122" width="8" height="28" rx="4" fill="#f59e0b"/>`,
    ),
  },
  {
    name: 'Calm HEPA air purifier',
    slug: 'calm-air-purifier',
    categorySlug: 'smart-home',
    price: 119,
    stock_quantity: 11,
    low_stock_threshold: 4,
    is_featured: false,
    description: 'True H13 HEPA filtration with a 21dB whisper-quiet sleep mode and automatic air quality sensor.',
    tiktok_url: 'https://www.tiktok.com/shop',
    image_url: makeArtDataUri(
      '#ccfbf1',
      '#f4f4f5',
      `<rect x="58" y="34" width="84" height="148" rx="20" fill="#18181b"/><path d="M76 74h48M76 92h48M76 110h48M76 128h48" stroke="#fafafa" stroke-width="4" stroke-linecap="round" opacity="0.65"/><circle cx="100" cy="158" r="6" fill="#16a34a"/>`,
    ),
  },
]

export function getDemoCatalog(): { categories: Category[]; products: Product[] } {
  const now = new Date().toISOString()
  const categories: Category[] = STARTER_CATEGORIES.map((cat, idx) => ({
    id: `demo-cat-${idx + 1}`,
    ...cat,
    created_at: now,
  }))
  const products: Product[] = STARTER_PRODUCTS.map((seed, idx) => {
    const category = categories.find((c) => c.slug === seed.categorySlug) ?? null
    const productId = `demo-prod-${idx + 1}`
    return {
      id: productId,
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
      price: seed.price,
      category_id: category?.id ?? null,
      tiktok_url: seed.tiktok_url,
      availability: true,
      is_featured: seed.is_featured,
      stock_quantity: seed.stock_quantity,
      low_stock_threshold: seed.low_stock_threshold,
      seo_title: `${seed.name} — Nook`,
      seo_description: seed.description,
      og_image_url: null,
      created_at: new Date(Date.now() - idx * 3600_000).toISOString(),
      updated_at: now,
      category,
      product_images: [
        {
          id: `demo-img-${idx + 1}`,
          product_id: productId,
          image_url: seed.image_url,
          display_order: 0,
          created_at: now,
        },
      ],
      product_variants: (seed.variants ?? []).map((v, vIdx) => ({
        id: `demo-var-${idx + 1}-${vIdx + 1}`,
        product_id: productId,
        name: v.name,
        sku: v.sku,
        price: v.price,
        stock_quantity: v.stock_quantity,
        image_url: null,
        tiktok_url: null,
        enabled: true,
        created_at: now,
      })),
    }
  })
  return { categories, products }
}
