// Stub for `https://esm.sh/@supabase/supabase-js@2.39.0`.
// Hands the edge function a recording fake so the test can see the exact
// PostgREST calls it makes.
let client: any = null

export function __setClient(next: any) {
  client = next
}

export function createClient(_url: string, _key: string) {
  if (!client) throw new Error('no fake client installed')
  return client
}
