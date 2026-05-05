'use client'

import React, { ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.fallback) {
        return this.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 min-h-[300px]">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-600 mb-6 max-w-xs mx-auto text-sm">
            This section failed to load. Try refreshing the page or contact support if the issue persists.
          </p>
          <Button 
            onClick={() => this.setState({ hasError: false })}
            className="rounded-xl h-10 px-6 font-semibold shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }

  private get fallback() {
    return this.props.fallback
  }
}
