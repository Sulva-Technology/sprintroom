'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { resetPassword } from '@/app/actions/auth'

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; root?: string }>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    try {
      resetSchema.parse({ email })
      
      const res = await resetPassword(formData)
      if (res?.error) {
        setErrors({ root: res.error })
        return
      }
      
      setIsSubmitted(true)
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        setErrors({ email: (error as any).errors[0].message })
      } else {
        setErrors({ root: 'Something went wrong. Please try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="w-full flex-col flex items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">Check your email</h1>
        <p className="text-muted-foreground text-sm font-medium mb-8">
          We&apos;ve sent a password reset link to your email address.
        </p>
        <Button variant="outline" render={<Link href="/login" />} className="w-full h-11 rounded-xl shadow-sm border-border/80">
          Return to log in
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full flex-col flex animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 relative">
        <Link href="/login" className="absolute -top-12 left-0 text-muted-foreground hover:text-foreground flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Forgot password?</h1>
        <p className="text-muted-foreground text-sm font-medium">No worries, we&apos;ll send you reset instructions.</p>
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

        {errors.root && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
            {errors.root}
          </div>
        )}

        <Button type="submit" className="w-full h-11 rounded-xl shadow-md text-base" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending instructions...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
        Wait, I remember my password.{' '}
        <Link href="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
          Log in
        </Link>
      </div>
    </div>
  )
}
