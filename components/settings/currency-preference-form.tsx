'use client'

import { CURRENCIES, useCurrencyPreference } from '@/hooks/use-currency-preference'
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

export function CurrencyPreferenceForm() {
  const { autoResolved, currencyMode, resolvedCurrency, setCurrencyMode } = useCurrencyPreference()

  const handleCurrencyChange = (value: string) => {
    setCurrencyMode(value)
    toast.success('Currency preference updated successfully')
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
              <SelectItem value="auto">Auto (Location Detected)</SelectItem>
              {Object.values(CURRENCIES).map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.name}
                </SelectItem>
              ))}
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
            : `${resolvedCurrency.code} (${resolvedCurrency.symbol})`
          }
        </Badge>
      </div>
    </div>
  )
}
