'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type SoundName = 'focus-start' | 'focus-complete' | 'warning' | 'break-start' | 'tick'

export function useFocusSound() {
  const [soundEnabled, setSoundEnabled] = useState(true) // Changed default to true
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})

  // Initialize from localStorage on mount or set default
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sprintroom-sound-enabled')
      if (stored === null) { // If not set, default to true and store it
        localStorage.setItem('sprintroom-sound-enabled', 'true')
        setTimeout(() => setSoundEnabled(true), 0)
      } else if (stored === 'true') {
        setTimeout(() => setSoundEnabled(true), 0)
      } else {
        setTimeout(() => setSoundEnabled(false), 0)
      }
    } catch (e) {
      // Ignore errors (e.g. cookies disabled, server-side render)
    }
  }, [])

  // Create and preload audio elements when sound is enabled
  useEffect(() => {
    if (!soundEnabled || typeof window === 'undefined') return

    const names: SoundName[] = ['focus-start', 'focus-complete', 'warning', 'break-start', 'tick']
    names.forEach(name => {
      // Only create if we haven't already
      if (!audioRefs.current[name]) {
        const audio = new Audio(`/sounds/${name}.mp3`)
        audio.preload = 'auto'
        audioRefs.current[name] = audio
      }
    })

    return () => {
      // Cleanup
      Object.keys(audioRefs.current).forEach(key => {
         const audio = audioRefs.current[key]
         if (audio) {
           audio.pause()
           audio.src = ''
         }
      })
      audioRefs.current = {}
    }
  }, [soundEnabled])

  const enableSound = useCallback(() => {
    setSoundEnabled(true)
    try {
      localStorage.setItem('sprintroom-sound-enabled', 'true')
    } catch (e) {}
  }, [])

  const disableSound = useCallback(() => {
    setSoundEnabled(false)
    try {
      localStorage.setItem('sprintroom-sound-enabled', 'false')
    } catch (e) {}
  }, [])

  const stopSound = useCallback((name: SoundName) => {
    const audio = audioRefs.current[name];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [])

  const toggleSound = useCallback(() => {
    if (soundEnabled) {
      disableSound()
    } else {
      enableSound()
    }
  }, [soundEnabled, enableSound, disableSound])

  const playSound = useCallback((name: SoundName, loop: boolean = false) => {
    if (!soundEnabled) return

    const audio = audioRefs.current[name]
    if (audio) {
      audio.loop = loop;
      // Reset to start before playing if it's already playing
      audio.currentTime = 0
      audio.play().catch(() => {
        // Silently catch autoplay errors or empty sources
      })
    }

    if (name === 'focus-complete' && typeof navigator !== 'undefined' && navigator.vibrate) {
       try {
         // Vibrate pattern for completion: 200ms on, 100ms off, 200ms on
         navigator.vibrate([200, 100, 200])
       } catch (e) {
         // Silently ignore vibration errors
       }
    }
  }, [soundEnabled])

  return {
    soundEnabled,
    enableSound,
    disableSound,
    toggleSound,
    playSound,
    stopSound
  }
}