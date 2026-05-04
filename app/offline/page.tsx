import { CloudOff } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4 font-sans antialiased text-slate-900">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
          <CloudOff className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-4 tracking-tight">You are offline.</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Open SprintRoom to continue with your cached workspace, focus timer, and pending changes.
          We will sync everything when you are back online.
        </p>
        <Button render={<Link href="/dashboard" />} size="lg" className="w-full rounded-xl">
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}
