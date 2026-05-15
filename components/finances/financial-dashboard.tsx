'use client'

import { useState, useMemo } from 'react'
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
  LineChart,
  Line,
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Search
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
import { format } from 'date-fns'

interface Entry {
  id: string
  type: 'income' | 'expense' | 'adjustment'
  amount: number
  description: string
  entry_date: string
  visibility: 'workspace' | 'personal'
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
}

export function FinancialDashboard({ entries, metrics, aiInsights }: FinancialDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'all' || entry.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [entries, searchTerm, typeFilter])

  // Prepare chart data (last 6 months)
  const chartData = useMemo(() => {
    const months: Record<string, { name: string; income: number; expense: number }> = {}
    
    entries.forEach(entry => {
      const date = new Date(entry.entry_date)
      const monthKey = format(date, 'MMM yy')
      
      if (!months[monthKey]) {
        months[monthKey] = { name: monthKey, income: 0, expense: 0 }
      }
      
      if (entry.type === 'income') {
        months[monthKey].income += Number(entry.amount)
      } else if (entry.type === 'expense') {
        months[monthKey].expense += Number(entry.amount)
      }
    })

    return Object.values(months).reverse().slice(-6)
  }, [entries])

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/50 backdrop-blur-sm border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Income</CardTitle>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">${metrics.totalIncome.toLocaleString()}</div>
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
            <div className="text-2xl font-bold text-rose-600">${metrics.totalExpense.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <ArrowDownRight className="w-3 h-3 mr-1" />
              All-time spending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-violet-600 border-none text-white shadow-indigo-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 text-indigo-100">
            <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-90">Net Balance</CardTitle>
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.netBalance.toLocaleString()}</div>
            <div className="h-1.5 w-full bg-white/20 rounded-full mt-3 overflow-hidden">
               <div 
                 className="h-full bg-white transition-all duration-1000" 
                 style={{ width: `${Math.min(Math.max((metrics.totalIncome / (metrics.totalExpense + metrics.totalIncome)) * 100, 0), 100)}%` }} 
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
            <CardDescription>Income vs Expenses over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Financial Entries</CardTitle>
            <CardDescription>Recent transactions and adjustments</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-9 w-[150px] md:w-[200px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[110px]">
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
          <div className="rounded-md border border-slate-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500">{format(new Date(entry.entry_date), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{entry.description}</td>
                    <td className="px-4 py-3">
                      {entry.projects?.name ? (
                        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600">
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
                          entry.type === 'income' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                          entry.type === 'expense' ? 'bg-rose-100 text-rose-700 hover:bg-rose-100' :
                          'bg-blue-100 text-blue-700 hover:bg-blue-100'
                        }
                      >
                        {entry.type}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${entry.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.type === 'income' ? '+' : '-'}${Number(entry.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      No financial entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
