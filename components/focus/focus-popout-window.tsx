'use client'

import { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface FocusPopoutWindowProps {
  pipWindow: Window | null
  children: ReactNode
}

export function FocusPopoutWindow({ pipWindow, children }: FocusPopoutWindowProps) {
  if (!pipWindow) return null

  return createPortal(
    <div className="fixed inset-0 h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {children}
    </div>,
    pipWindow.document.body
  )
}
