import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F7F8FA] font-sans selection:bg-primary/20">
      {/* Left side (Desktop) */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-white border-r border-border/40 relative overflow-hidden">
        <Link href="/" className="relative z-10 flex items-center">
          <Image src="/logo.png" alt="SprintRoom Logo" width={160} height={40} className="h-10 w-auto object-contain" priority />
        </Link>

        <div className="relative z-10 max-w-md mt-12">
          <h2 className="text-3xl font-medium tracking-tight text-foreground leading-[1.15] mb-8">
            Your team’s work rhythm, <span className="text-primary/80 italic">visible.</span>
          </h2>

          <div className="bg-[#fcfcfd]/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-xl shadow-primary/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div className="flex-1">
                <div className="h-3 w-24 bg-slate-200 rounded-full mb-1.5" />
                <div className="h-2 w-16 bg-slate-100 rounded-full" />
              </div>
              <div className="font-mono text-sm font-bold text-amber-600">25:00</div>
            </div>
            <div className="space-y-2">
              <div className="h-10 border border-border/50 rounded-lg flex items-center px-3 bg-white shadow-sm">
                <div className="w-4 h-4 rounded border border-slate-200 mr-3" />
                <div className="h-2 w-1/2 bg-slate-200 rounded-full" />
              </div>
              <div className="h-10 border border-border/50 rounded-lg flex items-center px-3 bg-white shadow-sm">
                <div className="w-4 h-4 rounded border border-slate-200 mr-3" />
                <div className="h-2 w-3/4 bg-slate-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-muted-foreground mt-12">
          © {new Date().getFullYear()} SprintRoom Inc.
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Right side */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative">
        <div className="w-full max-w-sm">
          {/* Mobile brand header (hidden on lg) */}
          <Link href="/" className="lg:hidden flex justify-center items-center mb-8">
            <Image src="/logo.png" alt="SprintRoom Logo" width={160} height={40} className="h-10 w-auto object-contain" priority />
          </Link>

          {children}
        </div>
      </div>
    </div>
  )
}
