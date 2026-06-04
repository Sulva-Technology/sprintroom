import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

const readProjectFile = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('PWA offline support', () => {
  it('registers the service worker from the root app shell', () => {
    const rootLayout = readProjectFile('app/layout.tsx')

    expect(rootLayout).toContain('ServiceWorkerRegistrar')
  })

  it('declares installable PWA icon assets', () => {
    const appManifest = manifest()

    expect(appManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
        expect.objectContaining({ src: '/apple-touch-icon.png', sizes: '180x180' }),
      ]),
    )
  })

  it('caches Next image optimizer responses and common app assets for offline use', () => {
    const serviceWorker = readProjectFile('public/sw.js')

    expect(serviceWorker).toContain("url.pathname.startsWith('/_next/image')")
    expect(serviceWorker).toContain("'.ico'")
    expect(serviceWorker).toContain("'.webp'")
    expect(serviceWorker).toContain("'.mp3'")
  })

  it('listens for browser background sync requests', () => {
    const serviceWorker = readProjectFile('public/sw.js')

    expect(serviceWorker).toContain("self.addEventListener('sync'")
    expect(serviceWorker).toContain("'sprintroom-sync'")
  })
})
