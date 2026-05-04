'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/app/actions/auth'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; root?: string }>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      // Client-side validation
      loginSchema.parse({ email, password })
      
      // Server action
      const res = await login(formData)
      if (res?.error) {
        setErrors({ root: res.error })
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        const errors = (error as any).errors || (error as any).issues
        errors.forEach((err: any) => {
          if (err.path && err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full flex-col flex animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Welcome back</h1>
        <p className="text-muted-foreground text-sm font-medium">Log in to your execution room.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-semibold text-foreground/80">Email</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="you@company.com" 
            autoComplete="email"
            disabled={isLoading}
            className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
          />
          {errors.email && <p className="text-[13px] text-destructive font-medium mt-1">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-semibold text-foreground/80">Password</Label>
            <Link href="/forgot-password" className="text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input 
              id="password" 
              name="password" 
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              className="h-11 rounded-xl shadow-sm border-border/80 pr-10 focus-visible:ring-primary/20"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-[13px] text-destructive font-medium mt-1">{errors.password}</p>}
        </div>

        {errors.root && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
            {errors.root}
          </div>
        )}

        <Button type="submit" className="w-full h-11 rounded-xl shadow-md text-base" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary font-semibold hover:text-primary/80 transition-colors">
          Create team room
        </Link>
      </div>
    </div>
  )
}
