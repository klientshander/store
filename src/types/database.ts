export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

export type ProductImage = {
  id: string
  product_id: string
  image_url: string
  display_order: number
  created_at: string
}

export type ProductVariant = {
  id: string
  product_id: string
  name: string
  sku: string | null
  price: number | null
  stock_quantity: number
  image_url: string | null
  tiktok_url: string | null
  enabled: boolean
  created_at: string
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  category_id: string | null
  tiktok_url: string
  availability: boolean
  is_featured: boolean
  stock_quantity: number
  low_stock_threshold: number
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  created_at: string
  updated_at: string
  category?: Category | null
  product_images?: ProductImage[]
  product_variants?: ProductVariant[]
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Completed' | 'Cancelled'

export type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  quantity: number
  unit_price: number
  product?: Pick<Product, 'id' | 'name' | 'slug'> | null
}

export type Order = {
  id: string
  order_reference: string
  customer_name: string | null
  order_status: OrderStatus
  total_amount: number
  source: string
  order_date: string
  notes: string | null
  created_at: string
  order_items?: OrderItem[]
}

export type InventoryReason = 'manual_adjustment' | 'verified_order' | 'restock' | 'correction'

export type InventoryMovement = {
  id: string
  product_id: string
  variant_id: string | null
  quantity_change: number
  reason: InventoryReason
  notes: string | null
  created_by: string | null
  created_at: string
  product?: Pick<Product, 'name' | 'slug'> | null
  variant?: Pick<ProductVariant, 'name'> | null
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type Review = {
  id: string
  product_id: string
  user_id: string | null
  author_name: string | null
  rating: number
  body: string
  status: ReviewStatus
  verified_purchase: boolean
  created_at: string
  updated_at: string
  product?: Pick<Product, 'name' | 'slug'> | null
}

export type ActivityLog = {
  id: string
  admin_id: string | null
  action: string
  description: string
  related_record_id: string | null
  created_at: string
}

export type AdminNotification = {
  id: string
  admin_id: string | null
  type: string
  title: string
  body: string | null
  related_record_id: string | null
  read_at: string | null
  created_at: string
}

export type StoreSettings = {
  id?: number
  store_name: string
  tagline: string
  hero_badge: string
  hero_title: string
  hero_subtitle: string
  tiktok_profile_url: string | null
  support_email: string | null
  free_shipping_text: string
  returns_text: string
  warranty_text: string
  updated_at?: string
}

export type AnalyticsSummary = {
  products: number
  orders: number
  views: number
  clicks: number
  revenue: number
  lowStock: number
  pendingReviews: number
}

export type DailyActivity = {
  day: string
  views: number
  clicks: number
}

export type ProductPerformance = {
  id: string
  name: string
  slug: string
  views: number
  clicks: number
  ctr: number
}

export type SystemHealth = {
  connected: boolean
  coreSchemaReady: boolean
  enhancementsReady: boolean
  settingsTableReady: boolean
  details: { name: string; ok: boolean; hint?: string }[]
}
