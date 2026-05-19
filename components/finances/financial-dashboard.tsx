'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Search,
  Globe,
  Edit2,
  Trash2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { EditEntryDialog } from './edit-entry-dialog'
import { deleteFinancialEntry } from '@/app/actions/finances'

interface Entry {
  id: string
  type: 'income' | 'expense' | 'adjustment'
  amount: number
  description: string
  entry_date: string
  visibility: 'workspace' | 'personal'
  project_id?: string | null
  projects?: { name: string }
  tasks?: { title: string }
}

interface FinancialDashboardProps {
  entries: Entry[]
  metrics: {
    totalIncome: number
    totalExpense: number
    netBalance: number
    byProject: Record<string, number>
  }
  aiInsights?: string | null
  workspaceId: string
  projects: { id: string; name: string }[]
}

const CURRENCIES = {
  USD: { symbol: '$', code: 'USD', name: 'USD ($)' },
  EUR: { symbol: '€', code: 'EUR', name: 'EUR (€)' },
  GBP: { symbol: '£', code: 'GBP', name: 'GBP (£)' },
  JPY: { symbol: '¥', code: 'JPY', name: 'JPY (¥)' },
  CAD: { symbol: 'CA$', code: 'CAD', name: 'CAD (CA$)' },
  AUD: { symbol: 'A$', code: 'AUD', name: 'AUD (A$)' },
  INR: { symbol: '₹', code: 'INR', name: 'INR (₹)' },
  NGN: { symbol: '₦', code: 'NGN', name: 'NGN (₦)' }
}

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

export function FinancialDashboard({ entries, metrics, aiInsights, workspaceId, projects }: FinancialDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currencyMode, setCurrencyMode] = useState<string>('auto')
  const [resolvedCurrency, setResolvedCurrency] = useState<{ code: string; symbol: string }>({ code: 'USD', symbol: '$' })
  
  // Edit & Delete state
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // Sync preference with localStorage and handle other tabs/settings changing it
  useEffect(() => {
    const syncCurrency = () => {
      const saved = localStorage.getItem('sprint_finances_currency') || 'auto'
      setCurrencyMode(saved)
    }
    syncCurrency()
    window.addEventListener('storage', syncCurrency)
    return () => window.removeEventListener('storage', syncCurrency)
  }, [])

  useEffect(() => {
    if (currencyMode === 'auto') {
      const detected = detectCurrencyFromLocaleOrTimezone()
      setResolvedCurrency(detected)
    } else {
      const mapped = CURRENCIES[currencyMode as keyof typeof CURRENCIES] || CURRENCIES.USD
      setResolvedCurrency({ code: mapped.code, symbol: mapped.symbol })
    }
  }, [currencyMode])

  const handleCurrencyChange = (value: string) => {
    setCurrencyMode(value)
    localStorage.setItem('sprint_finances_currency', value)
    window.dispatchEvent(new Event('storage'))
  }

  const formatCurrency = (amount: number) => {
    return `${resolvedCurrency.symbol}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'all' || entry.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [entries, searchTerm, typeFilter])

  // Prepare chart data (daily cash flow history)
  const chartData = useMemo(() => {
    const dailyData: Record<string, { dateObj: Date; name: string; income: number; expense: number }> = {}
    
    entries.forEach(entry => {
      // Parse YYYY-MM-DD date safely to avoid timezone shift errors
      const parts = entry.entry_date.split('-')
      let date: Date
      if (parts.length === 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      } else {
        date = new Date(entry.entry_date)
      }
      
      const dayKey = format(date, 'yyyy-MM-dd')
      const label = format(date, 'MMM d') // e.g. "May 19"
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = { dateObj: date, name: label, income: 0, expense: 0 }
      }
      
      if (entry.type === 'income') {
        dailyData[dayKey].income += Number(entry.amount)
      } else if (entry.type === 'expense') {
        dailyData[dayKey].expense += Number(entry.amount)
      }
    })

    const result = Object.values(dailyData)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .slice(-10) // Display the last 10 active dates

    if (result.length === 0) {
      // Fallback to last 7 calendar days if no data exists
      const fallback: { name: string; income: number; expense: number }[] = []
      const today = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
        fallback.push({ name: format(d, 'MMM d'), income: 0, expense: 0 })
      }
      return fallback
    }

    return result
  }, [entries])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this financial entry?')) return
    setIsDeleting(id)
    try {
      const res = await deleteFinancialEntry(id)
      if (res.success) {
        toast.success('Entry deleted successfully')
      } else {
        toast.error(res.error?.message || 'Failed to delete entry')
      }
    } catch (e) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry)
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Currency Preference Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-600">Currency Display:</span>
          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 font-semibold">
            {resolvedCurrency.code} ({resolvedCurrency.symbol})
          </Badge>
        </div>
        <div className="w-full sm:w-auto">
          <Select value={currencyMode} onValueChange={(val) => { if (val) handleCurrencyChange(val) }}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white border-slate-200 shadow-sm text-sm">
              <SelectValue placeholder="Change currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🌍 Auto ({detectCurrencyFromLocaleOrTimezone().code})</SelectItem>
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-white/50 backdrop-blur-sm border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Income</CardTitle>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.totalIncome)}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              All-time earnings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-sm border-rose-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Expenses</CardTitle>
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{formatCurrency(metrics.totalExpense)}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <ArrowDownRight className="w-3 h-3 mr-1" />
              All-time spending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-violet-600 border-none text-white shadow-indigo-200/50 sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 text-indigo-100">
            <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-90">Net Balance</CardTitle>
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.netBalance)}</div>
            <div className="h-1.5 w-full bg-white/20 rounded-full mt-3 overflow-hidden">
               <div 
                 className="h-full bg-white transition-all duration-1000" 
                 style={{ width: `${Math.min(Math.max((metrics.totalIncome / ((metrics.totalExpense + metrics.totalIncome) || 1)) * 100, 0), 100)}%` }} 
               />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Trends</CardTitle>
            <CardDescription>Daily cash flow by transaction date</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.15}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.15}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  tickFormatter={(value) => `${resolvedCurrency.symbol}${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 4 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
                  formatter={(value) => [formatCurrency(Number(value)), '']}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income" fill="url(#incomeGradient)" stroke="#10b981" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="expense" name="Expense" fill="url(#expenseGradient)" stroke="#f43f5e" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Insights Card */}
        <Card className="bg-indigo-50/50 border-indigo-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-700">
              <Sparkles className="w-5 h-5" />
              AI Insights
            </CardTitle>
            <CardDescription className="text-indigo-600/70">Powered by Gemini AI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-700 leading-relaxed space-y-2 whitespace-pre-line">
              {aiInsights || "Generating your financial overview..."}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0 pb-4">
          <div>
            <CardTitle>Financial Entries</CardTitle>
            <CardDescription>Recent transactions and adjustments</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-9 w-full sm:w-[150px] md:w-[200px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'all')}>
              <SelectTrigger className="w-full sm:w-[110px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="adjustment">Adjust</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-100 overflow-x-auto w-full">
            <table className="w-full text-sm text-left min-w-[600px]">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{format(new Date(entry.entry_date), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{entry.description}</td>
                    <td className="px-4 py-3">
                      {entry.projects?.name ? (
                        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 whitespace-nowrap">
                          {entry.projects.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant="secondary" 
                        className={
                          entry.type === 'income' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 capitalize' :
                          entry.type === 'expense' ? 'bg-rose-100 text-rose-700 hover:bg-rose-100 capitalize' :
                          'bg-blue-100 text-blue-700 hover:bg-blue-100 capitalize'
                        }
                      >
                        {entry.type}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${entry.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(entry)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(entry.id)}
                          disabled={isDeleting === entry.id}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-slate-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No financial entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Entry Dialog */}
      <EditEntryDialog
        workspaceId={workspaceId}
        projects={projects}
        entry={editingEntry}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  )
}

