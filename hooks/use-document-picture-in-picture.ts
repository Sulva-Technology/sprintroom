'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function useDocumentPictureInPicture() {
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'documentPictureInPicture' in window)
  const [isOpen, setIsOpen] = useState(false)
  const [popoutWindow, setPopoutWindow] = useState<Window | null>(null)

  const copyStylesheets = (win: Window) => {
    // Copy all style sheets and style elements
    const styleSheets = Array.from(document.styleSheets)
    styleSheets.forEach((styleSheet) => {
      try {
        if (styleSheet.href) {
          const link = win.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = styleSheet.href
          win.document.head.appendChild(link)
        } else if (styleSheet.ownerNode) {
          const style = win.document.createElement('style')
          style.textContent = styleSheet.ownerNode.textContent
          win.document.head.appendChild(style)
        }
      } catch (e) {
        console.warn('Failed to copy stylesheet', e)
      }
    })
  }

  const openPopout = useCallback(async () => {
    if (!isSupported) return null

    try {
      const documentPictureInPicture = (window as Window & {
        documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> }
      }).documentPictureInPicture

      if (!documentPictureInPicture) return null

      const pipWindow = await documentPictureInPicture.requestWindow({
        width: 360,
        height: 520,
      })

      pipWindow.document.title = 'SprintRoom Focus Tube'

      copyStylesheets(pipWindow)

      pipWindow.addEventListener('pagehide', () => {
        setIsOpen(false)
        setPopoutWindow(null)
      })

      setPopoutWindow(pipWindow)
      setIsOpen(true)
      return pipWindow
    } catch (error) {
      console.error('Failed to open Picture-in-Picture window', error)
      return null
    }
  }, [isSupported])

  const closePopout = useCallback(() => {
    if (popoutWindow) {
      popoutWindow.close()
    }
  }, [popoutWindow])

  return { isSupported, isOpen, openPopout, closePopout, popoutWindow }
}
