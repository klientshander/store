import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase'
import { DEFAULT_STORE_SETTINGS, STARTER_CATEGORIES, STARTER_PRODUCTS } from '../lib/starterCatalog'
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
  ProductVariant,
  Review,
  ReviewStatus,
  StoreSettings,
  SystemHealth,
} from '../types/database'

const fullProductsQuery = '*, category:categories(*), product_images(*), product_variants(*)'
const baseProductsQuery = '*, category:categories(*), product_images(*)'
const SETTINGS_CACHE_KEY = 'nook-store-settings'

function isMissingSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = 'code' in err ? String((err as { code?: string }).code) : ''
  const message = 'message' in err ? String((err as { message?: string }).message) : ''
  return (
    code === 'PGRST200' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    code === '42703' ||
    /schema cache|does not exist|relationship/i.test(message)
  )
}

function normalizeProduct(raw: Product & { stock_quantity?: number | null; low_stock_threshold?: number | null }): Product {
  const variants = (raw.product_variants ?? []).map((v) => ({
    ...v,
    price: v.price != null ? Number(v.price) : null,
    stock_quantity: Number(v.stock_quantity ?? 0),
  }))
  const images = [...(raw.product_images ?? [])].sort((a, b) => a.display_order - b.display_order)
  // If stock_quantity column wasn't migrated yet (undefined), treat as available (10) rather than locking out purchases
  const baseStock = raw.stock_quantity === undefined || raw.stock_quantity === null ? 10 : Number(raw.stock_quantity)
  return {
    ...raw,
    price: Number(raw.price ?? 0),
    stock_quantity: baseStock,
    low_stock_threshold: Number(raw.low_stock_threshold ?? 5),
    product_images: images,
    product_variants: variants,
  }
}

export function getEffectiveStock(product: Product): number {
  const enabledVariants = (product.product_variants ?? []).filter((v) => v.enabled)
  if (enabledVariants.length > 0) {
    return enabledVariants.reduce((sum, v) => sum + Number(v.stock_quantity ?? 0), 0)
  }
  return Number(product.stock_quantity ?? 0)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function logAdminActivity(action: string, description: string, relatedRecordId?: string | null) {
  if (!supabase) return
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('admin_activity_logs').insert({
      admin_id: user?.id ?? null,
      action,
      description,
      related_record_id: relatedRecordId ?? null,
    })
  } catch {
    // Non-blocking if audit table isn't migrated yet
  }
}

export async function getProducts(
  options: { featured?: boolean; category?: string; search?: string; includeHidden?: boolean } = {},
): Promise<Product[]> {
  const db = requireSupabase()
  const runQuery = async (selectStr: string) => {
    let query = db.from('products').select(selectStr).order('created_at', { ascending: false })
    if (!options.includeHidden) query = query.eq('availability', true)
    if (options.featured) query = query.eq('is_featured', true)
    if (options.category) query = query.eq('category_id', options.category)
    if (options.search) query = query.ilike('name', `%${options.search}%`)
    return query
  }

  let { data, error } = await runQuery(fullProductsQuery)
  if (error && isMissingSchemaError(error)) {
    const fallback = await runQuery(baseProductsQuery)
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  return ((data ?? []) as unknown as Product[]).map(normalizeProduct)
}

export async function getProduct(slug: string, includeHidden = false): Promise<Product> {
  const db = requireSupabase()
  const runQuery = async (selectStr: string) => {
    let query = db.from('products').select(selectStr).eq('slug', slug)
    if (!includeHidden) query = query.eq('availability', true)
    return query.maybeSingle()
  }

  let { data, error } = await runQuery(fullProductsQuery)
  if (error && isMissingSchemaError(error)) {
    const fallback = await runQuery(baseProductsQuery)
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  if (!data) throw new Error('Product not found or currently unavailable.')
  return normalizeProduct(data as unknown as Product)
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase().from('categories').select('*').order('name')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function saveCategory(category: Partial<Category>): Promise<Category> {
  const db = requireSupabase()
  const payload = {
    name: category.name?.trim(),
    slug: category.slug?.trim() || slugify(category.name ?? ''),
    description: category.description?.trim() || null,
  }
  const query = category.id ? db.from('categories').update(payload).eq('id', category.id) : db.from('categories').insert(payload)
  const { data, error } = await query.select().single()
  if (error) throw error
  const saved = data as Category
  void logAdminActivity(category.id ? 'category.update' : 'category.create', `Saved category "${saved.name}"`, saved.id)
  return saved
}

export async function deleteCategory(id: string) {
  const { error } = await requireSupabase().from('categories').delete().eq('id', id)
  if (error) throw error
  void logAdminActivity('category.delete', 'Deleted category', id)
}

export async function trackView(productId: string, sessionId: string) {
  if (!supabase || productId.startsWith('demo-')) return
  try {
    await supabase.from('product_views').insert({ product_id: productId, session_id: sessionId })
  } catch {
    // Ignore view tracking failures
  }
}

export async function trackOutboundClick(productId: string, sessionId: string) {
  if (!supabase || productId.startsWith('demo-')) return
  try {
    await supabase.from('outbound_clicks').insert({ product_id: productId, session_id: sessionId })
  } catch {
    // Ignore outbound click tracking failures so user redirect always succeeds
  }
}

export async function saveProduct(product: Partial<Product>): Promise<Product> {
  const db = requireSupabase()
  const basePayload = {
    name: product.name?.trim(),
    slug: product.slug?.trim() || slugify(product.name ?? ''),
    description: product.description?.trim() ?? '',
    price: Number(product.price ?? 0),
    category_id: product.category_id || null,
    tiktok_url: product.tiktok_url?.trim(),
    availability: product.availability ?? true,
    is_featured: product.is_featured ?? false,
  }
  const fullPayload = {
    ...basePayload,
    stock_quantity: Math.max(0, Math.round(Number(product.stock_quantity ?? 10))),
    low_stock_threshold: Math.max(0, Math.round(Number(product.low_stock_threshold ?? 5))),
    seo_title: product.seo_title?.trim() || null,
    seo_description: product.seo_description?.trim() || null,
    og_image_url: product.og_image_url?.trim() || null,
  }

  const execute = (payload: Record<string, unknown>) =>
    product.id
      ? db.from('products').update(payload).eq('id', product.id).select().single()
      : db.from('products').insert(payload).select().single()

  let { data, error } = await execute(fullPayload)
  if (error && isMissingSchemaError(error)) {
    const fallback = await execute(basePayload)
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  const saved = normalizeProduct(data as Product)
  void logAdminActivity(product.id ? 'product.update' : 'product.create', `Saved product "${saved.name}"`, saved.id)
  return saved
}

export async function deleteProduct(id: string) {
  const { error } = await requireSupabase().from('products').delete().eq('id', id)
  if (error) throw error
  void logAdminActivity('product.delete', 'Deleted product', id)
}

export async function uploadProductImageFile(productId: string, file: File): Promise<string> {
  const db = requireSupabase()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await db.storage.from('product-images').upload(path, file, { upsert: false })
  if (uploadError) throw uploadError
  const { data } = db.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function syncProductImages(productId: string, keptUrls: string[], newFiles: File[]) {
  const db = requireSupabase()
  const uploadedUrls: string[] = []
  for (const file of newFiles) {
    const url = await uploadProductImageFile(productId, file)
    uploadedUrls.push(url)
  }
  const finalUrls = [...keptUrls.map((u) => u.trim()).filter(Boolean), ...uploadedUrls]
  const { error: clearError } = await db.from('product_images').delete().eq('product_id', productId)
  if (clearError) throw clearError
  if (finalUrls.length > 0) {
    const rows = finalUrls.map((image_url, index) => ({
      product_id: productId,
      image_url,
      display_order: index,
    }))
    const { error: insertError } = await db.from('product_images').insert(rows)
    if (insertError) throw insertError
  }
}

export type EditableVariant = {
  id?: string
  name: string
  sku: string
  price: string
  stock_quantity: number
  image_url: string
  tiktok_url: string
  enabled: boolean
}

export async function syncProductVariants(productId: string, variants: EditableVariant[]): Promise<{ synced: boolean; totalStock?: number }> {
  const db = requireSupabase()
  const cleaned = variants.filter((v) => v.name.trim().length > 0)

  const { data: existing, error: fetchErr } = await db.from('product_variants').select('id').eq('product_id', productId)
  if (fetchErr) {
    if (isMissingSchemaError(fetchErr)) return { synced: false }
    throw fetchErr
  }

  const keptIds = new Set(cleaned.map((v) => v.id).filter(Boolean))
  const toDelete = (existing ?? []).map((row: { id: string }) => row.id).filter((id) => !keptIds.has(id))

  if (toDelete.length > 0) {
    const { error: delErr } = await db.from('product_variants').delete().in('id', toDelete)
    if (delErr) throw delErr
  }

  for (const variant of cleaned) {
    const payload = {
      product_id: productId,
      name: variant.name.trim(),
      sku: variant.sku.trim() || null,
      price: variant.price.trim() !== '' ? Number(variant.price) : null,
      stock_quantity: Math.max(0, Math.round(Number(variant.stock_quantity || 0))),
      image_url: variant.image_url.trim() || null,
      tiktok_url: variant.tiktok_url.trim() || null,
      enabled: variant.enabled,
    }
    if (variant.id) {
      const { error } = await db.from('product_variants').update(payload).eq('id', variant.id)
      if (error) throw error
    } else {
      const { error } = await db.from('product_variants').insert(payload)
      if (error) throw error
    }
  }

  if (cleaned.length > 0) {
    const enabledStock = cleaned.filter((v) => v.enabled).reduce((sum, v) => sum + Math.max(0, Math.round(Number(v.stock_quantity || 0))), 0)
    await db.from('products').update({ stock_quantity: enabledStock }).eq('id', productId)
    return { synced: true, totalStock: enabledStock }
  }

  return { synced: true }
}

export async function adjustInventory(
  productId: string,
  variantId: string | null,
  quantityChange: number,
  reason: InventoryReason,
  notes?: string,
) {
  const db = requireSupabase()
  const { error } = await db.rpc('adjust_inventory', {
    p_product_id: productId,
    p_variant_id: variantId || null,
    p_quantity_change: quantityChange,
    p_reason: reason,
    p_notes: notes?.trim() || null,
  })

  if (error) {
    if (isMissingSchemaError(error) || /function.*adjust_inventory/i.test(error.message)) {
      // Direct fallback if RPC hasn't been installed yet
      if (variantId) {
        const { data: v } = await db.from('product_variants').select('stock_quantity').eq('id', variantId).single()
        const next = Math.max(0, Number(v?.stock_quantity ?? 0) + quantityChange)
        const { error: uErr } = await db.from('product_variants').update({ stock_quantity: next }).eq('id', variantId)
        if (uErr) throw uErr
      } else {
        const { data: p } = await db.from('products').select('stock_quantity').eq('id', productId).single()
        const next = Math.max(0, Number(p?.stock_quantity ?? 0) + quantityChange)
        const { error: uErr } = await db.from('products').update({ stock_quantity: next }).eq('id', productId)
        if (uErr) throw uErr
      }
    } else {
      throw error
    }
  }
  void logAdminActivity('inventory.adjust', `Adjusted stock by ${quantityChange > 0 ? `+${quantityChange}` : quantityChange} (${reason})`, productId)
}

export async function getInventoryMovements(limit = 30): Promise<InventoryMovement[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('inventory_movements')
    .select('*, product:products(name, slug), variant:product_variants(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (isMissingSchemaError(error)) return []
    throw error
  }
  return (data ?? []) as InventoryMovement[]
}

export async function getOrders(limit = 100): Promise<Order[]> {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select('*, order_items(*, product:products(id, name, slug))')
    .order('order_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as Order[]).map((o) => ({
    ...o,
    total_amount: Number(o.total_amount ?? 0),
  }))
}

export async function getRecentOrders(): Promise<Order[]> {
  return getOrders(6)
}

export type NewOrderInput = {
  id?: string
  order_reference: string
  customer_name: string
  order_status: OrderStatus
  source: string
  order_date: string
  notes: string
  total_amount: number
  items: { product_id: string; quantity: number; unit_price: number }[]
  deductStock?: boolean
}

export async function saveOrder(input: NewOrderInput): Promise<Order> {
  const db = requireSupabase()
  const computedTotal =
    input.items.length > 0
      ? input.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0)
      : Number(input.total_amount || 0)

  const payload = {
    order_reference: input.order_reference.trim(),
    customer_name: input.customer_name.trim() || null,
    order_status: input.order_status,
    source: input.source.trim() || 'tiktok_shop',
    order_date: input.order_date ? new Date(input.order_date).toISOString() : new Date().toISOString(),
    notes: input.notes.trim() || null,
    total_amount: Math.max(0, Number(computedTotal.toFixed(2))),
  }

  const query = input.id ? db.from('orders').update(payload).eq('id', input.id) : db.from('orders').insert(payload)
  const { data, error } = await query.select().single()
  if (error) throw error
  const saved = data as Order

  if (!input.id && input.items.length > 0) {
    const validItems = input.items.filter((i) => i.product_id && i.quantity > 0)
    if (validItems.length > 0) {
      const { error: itemsErr } = await db.from('order_items').insert(
        validItems.map((i) => ({
          order_id: saved.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      )
      if (itemsErr) throw itemsErr

      if (input.deductStock) {
        for (const item of validItems) {
          try {
            await adjustInventory(item.product_id, null, -Math.abs(item.quantity), 'verified_order', `Order ${saved.order_reference}`)
          } catch {
            // Continue if inventory adjustment table isn't migrated
          }
        }
      }
    }
  }

  void logAdminActivity(input.id ? 'order.update' : 'order.create', `Recorded order ${saved.order_reference}`, saved.id)
  return saved
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { error } = await requireSupabase().from('orders').update({ order_status: status }).eq('id', id)
  if (error) throw error
  void logAdminActivity('order.status', `Updated order status to ${status}`, id)
}

export async function deleteOrder(id: string) {
  const { error } = await requireSupabase().from('orders').delete().eq('id', id)
  if (error) throw error
  void logAdminActivity('order.delete', 'Deleted order record', id)
}

export async function getApprovedReviews(productId: string): Promise<Review[]> {
  if (!supabase || productId.startsWith('demo-')) return []
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingSchemaError(error)) return []
    throw error
  }
  return (data ?? []) as Review[]
}

export async function submitReview(input: { product_id: string; author_name: string; rating: number; body: string }) {
  const db = requireSupabase()
  const {
    data: { user },
  } = await db.auth.getUser()

  const fullPayload = {
    product_id: input.product_id,
    user_id: user?.id ?? null,
    author_name: input.author_name.trim() || 'Customer',
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    body: input.body.trim(),
    status: 'pending' as const,
    verified_purchase: false,
  }

  let { error } = await db.from('reviews').insert(fullPayload)
  if (error && isMissingSchemaError(error)) {
    const { author_name: _unused, ...fallbackPayload } = fullPayload
    const retry = await db.from('reviews').insert(fallbackPayload)
    error = retry.error
  }
  if (error) throw error
}

export async function getAdminReviews(): Promise<Review[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*, product:products(name, slug)')
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingSchemaError(error)) return []
    throw error
  }
  return (data ?? []) as Review[]
}

export async function updateReviewStatus(id: string, status: ReviewStatus, verified_purchase?: boolean) {
  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (verified_purchase !== undefined) payload.verified_purchase = verified_purchase
  const { error } = await requireSupabase().from('reviews').update(payload).eq('id', id)
  if (error) throw error
  void logAdminActivity('review.moderate', `Marked review as ${status}`, id)
}

export async function deleteReview(id: string) {
  const { error } = await requireSupabase().from('reviews').delete().eq('id', id)
  if (error) throw error
}

export async function getDashboardSummary(): Promise<AnalyticsSummary> {
  const db = requireSupabase()
  const [productsRes, ordersRes, viewsRes, clicksRes, reviewsRes] = await Promise.all([
    db.from('products').select('id, stock_quantity, low_stock_threshold'),
    db.from('orders').select('total_amount, order_status'),
    db.from('product_views').select('*', { count: 'exact', head: true }),
    db.from('outbound_clicks').select('*', { count: 'exact', head: true }),
    db.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  let productRows = (productsRes.data ?? []) as { id: string; stock_quantity?: number; low_stock_threshold?: number }[]
  if (productsRes.error) {
    if (isMissingSchemaError(productsRes.error)) {
      const fallback = await db.from('products').select('id')
      if (fallback.error) throw fallback.error
      productRows = (fallback.data ?? []) as { id: string }[]
    } else {
      throw productsRes.error
    }
  }
  if (ordersRes.error) throw ordersRes.error
  if (viewsRes.error) throw viewsRes.error
  if (clicksRes.error) throw clicksRes.error

  const lowStock = productRows.filter((p) => {
    if (p.stock_quantity === undefined) return false
    return Number(p.stock_quantity) <= Number(p.low_stock_threshold ?? 5)
  }).length

  const validOrders = (ordersRes.data ?? []) as { total_amount: number; order_status: OrderStatus }[]
  const revenue = validOrders
    .filter((o) => o.order_status !== 'Cancelled')
    .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0)

  return {
    products: productRows.length,
    orders: validOrders.length,
    views: viewsRes.count ?? 0,
    clicks: clicksRes.count ?? 0,
    revenue,
    lowStock,
    pendingReviews: reviewsRes.error ? 0 : (reviewsRes.count ?? 0),
  }
}

export async function getDailyActivity(): Promise<DailyActivity[]> {
  const db = requireSupabase()
  const since = new Date()
  since.setDate(since.getDate() - 13)
  since.setHours(0, 0, 0, 0)

  const [views, clicks] = await Promise.all([
    db.from('product_views').select('viewed_at').gte('viewed_at', since.toISOString()),
    db.from('outbound_clicks').select('clicked_at').gte('clicked_at', since.toISOString()),
  ])
  if (views.error) throw views.error
  if (clicks.error) throw clicks.error

  const map = new Map<string, DailyActivity>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    map.set(key, {
      day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      views: 0,
      clicks: 0,
    })
  }
  views.data.forEach(({ viewed_at }) => {
    const item = map.get(viewed_at.slice(0, 10))
    if (item) item.views++
  })
  clicks.data.forEach(({ clicked_at }) => {
    const item = map.get(clicked_at.slice(0, 10))
    if (item) item.clicks++
  })
  return [...map.values()]
}

export async function getProductPerformance(): Promise<ProductPerformance[]> {
  const db = requireSupabase()
  const [productsRes, viewsRes, clicksRes] = await Promise.all([
    db.from('products').select('id, name, slug'),
    db.from('product_views').select('product_id'),
    db.from('outbound_clicks').select('product_id'),
  ])
  if (productsRes.error) throw productsRes.error
  const viewCounts = new Map<string, number>()
  const clickCounts = new Map<string, number>()
  ;(viewsRes.data ?? []).forEach((v: { product_id: string }) => {
    viewCounts.set(v.product_id, (viewCounts.get(v.product_id) ?? 0) + 1)
  })
  ;(clicksRes.data ?? []).forEach((c: { product_id: string }) => {
    clickCounts.set(c.product_id, (clickCounts.get(c.product_id) ?? 0) + 1)
  })
  return ((productsRes.data ?? []) as { id: string; name: string; slug: string }[])
    .map((p) => {
      const views = viewCounts.get(p.id) ?? 0
      const clicks = clickCounts.get(p.id) ?? 0
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        views,
        clicks,
        ctr: views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0,
      }
    })
    .sort((a, b) => b.clicks - a.clicks || b.views - a.views)
}

export function getCachedStoreSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (raw) return { ...DEFAULT_STORE_SETTINGS, ...(JSON.parse(raw) as Partial<StoreSettings>) }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_STORE_SETTINGS
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const cached = getCachedStoreSettings()
  if (!supabase) return cached
  try {
    const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()
    if (error || !data) return cached
    const merged: StoreSettings = { ...DEFAULT_STORE_SETTINGS, ...(data as Partial<StoreSettings>) }
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged))
    return merged
  } catch {
    return cached
  }
}

export async function saveStoreSettings(settings: StoreSettings): Promise<{ persistedToDb: boolean }> {
  const cleaned: StoreSettings = {
    id: 1,
    store_name: settings.store_name.trim() || 'Nook',
    tagline: settings.tagline.trim() || DEFAULT_STORE_SETTINGS.tagline,
    hero_badge: settings.hero_badge.trim() || DEFAULT_STORE_SETTINGS.hero_badge,
    hero_title: settings.hero_title.trim() || DEFAULT_STORE_SETTINGS.hero_title,
    hero_subtitle: settings.hero_subtitle.trim() || DEFAULT_STORE_SETTINGS.hero_subtitle,
    tiktok_profile_url: settings.tiktok_profile_url?.trim() || null,
    support_email: settings.support_email?.trim() || null,
    free_shipping_text: settings.free_shipping_text.trim() || DEFAULT_STORE_SETTINGS.free_shipping_text,
    returns_text: settings.returns_text.trim() || DEFAULT_STORE_SETTINGS.returns_text,
    warranty_text: settings.warranty_text.trim() || DEFAULT_STORE_SETTINGS.warranty_text,
  }
  localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cleaned))
  window.dispatchEvent(new CustomEvent('nook-settings-updated', { detail: cleaned }))

  if (!supabase) return { persistedToDb: false }
  const { error } = await supabase
    .from('store_settings')
    .upsert({ ...cleaned, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  if (error) {
    if (isMissingSchemaError(error)) return { persistedToDb: false }
    throw error
  }
  void logAdminActivity('settings.update', `Updated store settings for "${cleaned.store_name}"`)
  return { persistedToDb: true }
}

export async function getNotifications(): Promise<AdminNotification[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    if (isMissingSchemaError(error)) return []
    throw error
  }
  return (data ?? []) as AdminNotification[]
}

export async function markAllNotificationsRead() {
  if (!supabase) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}

export async function getActivityLogs(limit = 20): Promise<ActivityLog[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('admin_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (isMissingSchemaError(error)) return []
    throw error
  }
  return (data ?? []) as ActivityLog[]
}

export async function checkSystemHealth(): Promise<SystemHealth> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      connected: false,
      coreSchemaReady: false,
      enhancementsReady: false,
      settingsTableReady: false,
      details: [{ name: 'Supabase Configuration', ok: false, hint: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' }],
    }
  }

  const probe = async (table: string, selectCols = 'id') => {
    const { error } = await supabase!.from(table).select(selectCols, { head: true, count: 'exact' })
    return { ok: !error, error }
  }

  const [products, categories, orders, variants, movements, reviews, settings] = await Promise.all([
    probe('products', 'id'),
    probe('categories', 'id'),
    probe('orders', 'id'),
    probe('product_variants', 'id'),
    probe('inventory_movements', 'id'),
    probe('reviews', 'id'),
    probe('store_settings', 'id'),
  ])

  const coreOk = products.ok && categories.ok && orders.ok
  const enhanceOk = variants.ok && movements.ok && reviews.ok

  return {
    connected: coreOk || enhanceOk || settings.ok,
    coreSchemaReady: coreOk,
    enhancementsReady: enhanceOk,
    settingsTableReady: settings.ok,
    details: [
      {
        name: 'Core Catalog & Orders (supabase/schema.sql)',
        ok: coreOk,
        hint: coreOk ? 'Ready' : 'Run supabase/schema.sql in Supabase SQL Editor',
      },
      {
        name: 'Variants, Stock & Reviews (20261106_store_enhancements.sql)',
        ok: enhanceOk,
        hint: enhanceOk ? 'Ready' : 'Run supabase/migrations/20261106_store_enhancements.sql',
      },
      {
        name: 'System Store Settings (store_settings)',
        ok: settings.ok,
        hint: settings.ok ? 'Synced to database' : 'Using local browser fallback until migration runs',
      },
    ],
  }
}

export async function claimInitialAdmin(): Promise<boolean> {
  const db = requireSupabase()
  const { data, error } = await db.rpc('claim_initial_admin')
  if (error) throw error
  return Boolean(data)
}

export async function seedStarterCatalog(): Promise<number> {
  const db = requireSupabase()
  const existingCats = await getCategories()
  const catMap = new Map<string, Category>(existingCats.map((c) => [c.slug, c]))

  for (const cat of STARTER_CATEGORIES) {
    if (!catMap.has(cat.slug)) {
      const saved = await saveCategory(cat)
      catMap.set(saved.slug, saved)
    }
  }

  const existingProducts = await getProducts({ includeHidden: true })
  const existingSlugs = new Set(existingProducts.map((p) => p.slug))
  let createdCount = 0

  for (const seed of STARTER_PRODUCTS) {
    if (existingSlugs.has(seed.slug)) continue
    const category = catMap.get(seed.categorySlug)
    const created = await saveProduct({
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
    })

    await syncProductImages(created.id, [seed.image_url], [])
    if (seed.variants?.length) {
      await syncProductVariants(
        created.id,
        seed.variants.map((v) => ({
          name: v.name,
          sku: v.sku,
          price: v.price != null ? String(v.price) : '',
          stock_quantity: v.stock_quantity,
          image_url: '',
          tiktok_url: '',
          enabled: true,
        })),
      )
    }
    createdCount++
  }

  void logAdminActivity('catalog.seed', `Loaded ${createdCount} starter Nook products`)
  return createdCount
}
