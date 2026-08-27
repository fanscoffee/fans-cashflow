import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const bucket = "payment-documents"

export function getPaymentStorage(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export { bucket as paymentStorageBucket }
