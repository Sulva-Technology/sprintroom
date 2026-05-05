import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] font-sans selection:bg-primary/20 selection:text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center group">
              <Image src="/logo.png" alt="SprintRoom Logo" width={160} height={40} className="h-10 w-auto object-contain transition-transform group-hover:scale-105" priority />
            </Link>
            <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
              <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
              <Link href="#method" className="hover:text-foreground transition-colors">Method</Link>
              <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Log in
            </Link>
            <Button render={<Link href="/signup" />} className="rounded-full shadow-sm px-5 h-9 font-medium">
              Get Started
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border/40 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <Image src="/logo.png" alt="SprintRoom Logo" width={128} height={32} className="h-8 w-auto object-contain" />
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SprintRoom Inc. Build teams that finish.
          </p>
        </div>
      </footer>
    </div>
  )
}
