'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Globe, Check } from 'lucide-react'
import { toast } from 'sonner'

const detectCurrencyFromLocaleOrTimezone = (): { code: string; symbol: string } => {
  if (typeof window === 'undefined') return { code: 'USD', symbol: '$' }
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const locale = navigator.language || ''
    if (timezone.includes('London') || timezone.includes('Dublin') || locale.startsWith('en-GB')) {
      return { code: 'GBP', symbol: '£' }
    }
    if (
      timezone.includes('Europe') || 
      ['de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'fi', 'gr', 'pt'].some(l => locale.startsWith(l))
    ) {
      return { code: 'EUR', symbol: '€' }
    }
    if (timezone.includes('Tokyo') || timezone.includes('Asia/Tokyo') || locale.startsWith('ja')) {
      return { code: 'JPY', symbol: '¥' }
    }
    if (timezone.includes('Calcutta') || timezone.includes('Kolkata') || locale.startsWith('hi') || locale.startsWith('en-IN')) {
      return { code: 'INR', symbol: '₹' }
    }
    if (timezone.includes('Lagos') || timezone.includes('Africa/Lagos') || locale.startsWith('en-NG')) {
      return { code: 'NGN', symbol: '₦' }
    }
    if (timezone.includes('Sydney') || timezone.includes('Melbourne') || timezone.includes('Australia') || locale.startsWith('en-AU')) {
      return { code: 'AUD', symbol: 'A$' }
    }
    if (timezone.includes('Toronto') || timezone.includes('Vancouver') || timezone.includes('Canada') || locale.startsWith('en-CA')) {
      return { code: 'CAD', symbol: 'CA$' }
    }
  } catch (e) {
    console.error(e)
  }
  return { code: 'USD', symbol: '$' }
}

export function CurrencyPreferenceForm() {
  const [currencyMode, setCurrencyMode] = useState<string>('auto')
  const [autoResolved, setAutoResolved] = useState<{ code: string; symbol: string }>({ code: 'USD', symbol: '$' })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sprint_finances_currency') || 'auto'
    setCurrencyMode(saved)
    setAutoResolved(detectCurrencyFromLocaleOrTimezone())
  }, [])

  const handleCurrencyChange = (value: string) => {
    setCurrencyMode(value)
    localStorage.setItem('sprint_finances_currency', value)
    // Dispatch storage event to sync all open tabs/components
    window.dispatchEvent(new Event('storage'))
    toast.success('Currency preference updated successfully')
  }

  if (!mounted) {
    return <div className="h-10 bg-slate-100 animate-pulse rounded-xl" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            Default Currency
          </label>
          <p className="text-xs text-muted-foreground">
            Choose the display currency for your financial metrics, trends, and transactions.
          </p>
        </div>
        <div className="w-full sm:w-[240px]">
          <Select value={currencyMode} onValueChange={(val) => { if (val) handleCurrencyChange(val) }}>
            <SelectTrigger className="w-full bg-white border-slate-200 shadow-sm rounded-xl">
              <SelectValue placeholder="Select currency mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🌍 Auto (Location Detected)</SelectItem>
              <SelectItem value="USD">🇺🇸 USD ($)</SelectItem>
              <SelectItem value="EUR">🇪🇺 EUR (€)</SelectItem>
              <SelectItem value="GBP">🇬🇧 GBP (£)</SelectItem>
              <SelectItem value="JPY">🇯🇵 JPY (¥)</SelectItem>
              <SelectItem value="CAD">🇨🇦 CAD (CA$)</SelectItem>
              <SelectItem value="AUD">🇦🇺 AUD (A$)</SelectItem>
              <SelectItem value="INR">🇮🇳 INR (₹)</SelectItem>
              <SelectItem value="NGN">🇳🇬 NGN (₦)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-2 p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-500" />
          <span>Active display currency resolved to:</span>
        </div>
        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-50 font-bold px-2 py-0.5 text-xs flex items-center gap-1">
          <Check className="w-3 h-3 text-indigo-600" />
          {currencyMode === 'auto' 
            ? `${autoResolved.code} (${autoResolved.symbol}) [Auto]` 
            : `${currencyMode} (${currencyMode === 'USD' ? '$' : currencyMode === 'EUR' ? '€' : currencyMode === 'GBP' ? '£' : currencyMode === 'JPY' ? '¥' : currencyMode === 'CAD' ? 'CA$' : currencyMode === 'AUD' ? 'A$' : currencyMode === 'INR' ? '₹' : '₦'})`
          }
        </Badge>
      </div>
    </div>
  )
}
