'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/app/actions/auth'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default function UpdatePasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; root?: string }>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    try {
      passwordSchema.parse({ password, confirmPassword })
      const res = await updatePassword(formData)
      if (res?.error) {
        setErrors({ root: res.error })
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        const errors = error.issues
        errors.forEach((err) => {
          if (err.path && err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ root: 'Something went wrong. Please try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full flex-col flex animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Set new password</h1>
        <p className="text-muted-foreground text-sm font-medium">Choose a strong password to get back into SprintRoom.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="font-semibold text-foreground/80">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            disabled={isLoading}
            className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
          />
          {errors.password && <p className="text-[13px] text-destructive font-medium mt-1">{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="font-semibold text-foreground/80">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            disabled={isLoading}
            className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
          />
          {errors.confirmPassword && <p className="text-[13px] text-destructive font-medium mt-1">{errors.confirmPassword}</p>}
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
              Updating...
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
        Already updated it?{' '}
        <Link href="/login" className="text-primary font-semibold hover:text-primary/80 transition-colors">
          Log in
        </Link>
      </div>
    </div>
  )
}
