'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(
          function(registration) {
            console.log('Service Worker registration successful with scope: ', registration.scope)
          },
          function(err) {
            console.log('Service Worker registration failed: ', err)
          }
        )
      })
    }

    // Listen for install prompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Check if user dismissed it recently
      const dismissed = localStorage.getItem('pwa_prompt_dismissed')
      if (!dismissed || Date.now() - parseInt(dismissed) > 86400000) { // 24 hours
        setShowPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    setShowPrompt(false)
    deferredPrompt.prompt()

    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
      setIsInstalled(true)
    } else {
      console.log('User dismissed the install prompt')
    }
    
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString())
  }

  if (!showPrompt || isInstalled) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <Card className="p-4 shadow-xl border-primary/20 bg-white/95 backdrop-blur max-w-sm flex gap-4 items-start relative pr-10">
        <div className="bg-primary/10 p-2 rounded-xl shrink-0 text-primary">
          <Download className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1 text-foreground">Install SprintRoom</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Add to your home screen for a faster, app-like experience with offline access.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstallClick} className="rounded-full px-4 h-8 text-xs font-semibold shadow-md">
              Install App
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="rounded-full px-4 h-8 text-xs font-medium">
              Not now
            </Button>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </Card>
    </div>
  )
}
