// Stub for `https://deno.land/std@0.192.0/http/server.ts`.
// Captures the handler the edge function registers so a test can invoke it.
let handler: ((req: Request) => Promise<Response> | Response) | null = null

export function serve(fn: (req: Request) => Promise<Response> | Response) {
  handler = fn
}

export function __getHandler() {
  if (!handler) throw new Error('edge function never called serve()')
  return handler
}

export function __reset() {
  handler = null
}
