'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sprint_finances_currency'
const CHANGE_EVENT = 'sprint-finances-currency-change'

export const CURRENCIES = {
  USD: { symbol: '$', code: 'USD', name: 'USD ($)' },
  EUR: { symbol: '\u20ac', code: 'EUR', name: 'EUR (\u20ac)' },
  GBP: { symbol: '\u00a3', code: 'GBP', name: 'GBP (\u00a3)' },
  JPY: { symbol: '\u00a5', code: 'JPY', name: 'JPY (\u00a5)' },
  CAD: { symbol: 'CA$', code: 'CAD', name: 'CAD (CA$)' },
  AUD: { symbol: 'A$', code: 'AUD', name: 'AUD (A$)' },
  INR: { symbol: '\u20b9', code: 'INR', name: 'INR (\u20b9)' },
  NGN: { symbol: '\u20a6', code: 'NGN', name: 'NGN (\u20a6)' },
} as const

export type CurrencyMode = 'auto' | keyof typeof CURRENCIES
export type ResolvedCurrency = { code: string; symbol: string }

const DEFAULT_CURRENCY: ResolvedCurrency = { code: 'USD', symbol: '$' }
let lastAutoCurrencySnapshot: ResolvedCurrency = DEFAULT_CURRENCY

export function detectCurrencyFromLocaleOrTimezone(): ResolvedCurrency {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const locale = navigator.language || ''

    if (timezone.includes('London') || timezone.includes('Dublin') || locale.startsWith('en-GB')) {
      return { code: 'GBP', symbol: CURRENCIES.GBP.symbol }
    }
    if (
      timezone.includes('Europe') ||
      ['de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'fi', 'gr', 'pt'].some((language) =>
        locale.startsWith(language)
      )
    ) {
      return { code: 'EUR', symbol: CURRENCIES.EUR.symbol }
    }
    if (timezone.includes('Tokyo') || timezone.includes('Asia/Tokyo') || locale.startsWith('ja')) {
      return { code: 'JPY', symbol: CURRENCIES.JPY.symbol }
    }
    if (
      timezone.includes('Calcutta') ||
      timezone.includes('Kolkata') ||
      locale.startsWith('hi') ||
      locale.startsWith('en-IN')
    ) {
      return { code: 'INR', symbol: CURRENCIES.INR.symbol }
    }
    if (timezone.includes('Lagos') || timezone.includes('Africa/Lagos') || locale.startsWith('en-NG')) {
      return { code: 'NGN', symbol: CURRENCIES.NGN.symbol }
    }
    if (
      timezone.includes('Sydney') ||
      timezone.includes('Melbourne') ||
      timezone.includes('Australia') ||
      locale.startsWith('en-AU')
    ) {
      return { code: 'AUD', symbol: CURRENCIES.AUD.symbol }
    }
    if (
      timezone.includes('Toronto') ||
      timezone.includes('Vancouver') ||
      timezone.includes('Canada') ||
      locale.startsWith('en-CA')
    ) {
      return { code: 'CAD', symbol: CURRENCIES.CAD.symbol }
    }
  } catch (error) {
    console.error(error)
  }

  return DEFAULT_CURRENCY
}

function getStoredCurrencyMode(): CurrencyMode {
  if (typeof window === 'undefined') return 'auto'

  const value = localStorage.getItem(STORAGE_KEY)
  if (value && (value === 'auto' || value in CURRENCIES)) {
    return value as CurrencyMode
  }

  return 'auto'
}

function subscribeToCurrencyPreference(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

function getServerCurrencyModeSnapshot(): CurrencyMode {
  return 'auto'
}

function getServerAutoCurrencySnapshot(): ResolvedCurrency {
  return DEFAULT_CURRENCY
}

function getAutoCurrencySnapshot() {
  const nextSnapshot = detectCurrencyFromLocaleOrTimezone()
  if (
    nextSnapshot.code === lastAutoCurrencySnapshot.code &&
    nextSnapshot.symbol === lastAutoCurrencySnapshot.symbol
  ) {
    return lastAutoCurrencySnapshot
  }

  lastAutoCurrencySnapshot = nextSnapshot
  return lastAutoCurrencySnapshot
}

export function useCurrencyPreference() {
  const currencyMode = useSyncExternalStore(
    subscribeToCurrencyPreference,
    getStoredCurrencyMode,
    getServerCurrencyModeSnapshot
  )
  const autoResolved = useSyncExternalStore(
    subscribeToCurrencyPreference,
    getAutoCurrencySnapshot,
    getServerAutoCurrencySnapshot
  )

  const resolvedCurrency = useMemo(() => {
    if (currencyMode === 'auto') return autoResolved

    const mapped = CURRENCIES[currencyMode] || CURRENCIES.USD
    return { code: mapped.code, symbol: mapped.symbol }
  }, [autoResolved, currencyMode])

  const setCurrencyMode = useCallback((value: string) => {
    if (typeof window === 'undefined') return

    localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    window.dispatchEvent(new Event('storage'))
  }, [])

  return { autoResolved, currencyMode, resolvedCurrency, setCurrencyMode }
}
