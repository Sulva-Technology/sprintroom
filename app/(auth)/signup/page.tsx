'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signup } from '@/app/actions/auth'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { z } from 'zod'

const signupSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string()
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"]
})

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<{ full_name?: string; email?: string; password?: string; confirm_password?: string; root?: string }>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const full_name = formData.get('full_name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirm_password = formData.get('confirm_password') as string

    try {
      // Client-side validation
      signupSchema.parse({ full_name, email, password, confirm_password })
      
      // Server action
      const res = await signup(formData)
      if (res?.error) {
        setErrors({ root: res.error })
      } else {
        setIsSuccess(true)
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

  if (isSuccess) {
    return (
      <div className="w-full flex-col flex animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Check your email</h1>
          <p className="text-muted-foreground text-sm font-medium">
            We&apos;ve sent a confirmation link to your email address. Please click the link to verify your account.
          </p>
        </div>
        <Button render={<Link href="/login" />} variant="outline" className="h-11 rounded-xl">
          Return to login
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full flex-col flex animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Create team room</h1>
        <p className="text-muted-foreground text-sm font-medium">Join SprintRoom and start shipping.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="font-semibold text-foreground/80">Full Name</Label>
          <Input 
            id="full_name" 
            name="full_name" 
            placeholder="John Doe"
            disabled={isLoading}
            className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
          />
          {errors.full_name && <p className="text-[13px] text-destructive font-medium mt-1">{errors.full_name}</p>}
        </div>

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
          <Label htmlFor="password" className="font-semibold text-foreground/80">Password</Label>
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

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="font-semibold text-foreground/80">Confirm Password</Label>
          <Input 
            id="confirm_password" 
            name="confirm_password" 
            type={showPassword ? "text" : "password"}
            disabled={isLoading}
            className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
          />
          {errors.confirm_password && <p className="text-[13px] text-destructive font-medium mt-1">{errors.confirm_password}</p>}
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
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
          Log in
        </Link>
      </div>
    </div>
  )
}
