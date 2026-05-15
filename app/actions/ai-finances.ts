'use server'

import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function getFinancialInsights(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !process.env.GEMINI_API_KEY) return null

  // 1. Fetch financial summary
  const { data: entries } = await supabase
    .from('financial_entries')
    .select('type, amount, description, entry_date, project_id, projects(name)')
    .eq('workspace_id', workspaceId)
    .order('entry_date', { ascending: false })
    .limit(50)

  // 2. Fetch project timelines/budgets if we have any (optional future enhancement)
  // For now, let's look at spend distribution.

  if (!entries || entries.length === 0) {
    return "Not enough financial data yet to generate insights. Start logging your income and expenses!"
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const context = JSON.stringify(entries.map(e => ({
    type: e.type,
    amount: e.amount,
    desc: e.description,
    date: e.entry_date,
    project: (e.projects as any)?.name || 'General'
  })))

  const prompt = `
    You are a senior financial advisor for a productivity workspace called SprintRoom.
    Analyze the following recent financial entries (income and expenses) and provide 3 concise, actionable insights or warnings.
    Focus on:
    - Unexpected spending patterns.
    - Project ROI or cost overruns.
    - Suggestions for budget optimization.

    Format the output as a clean bulleted list.

    Entries: ${context}
  `

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('AI Insight Error:', error)
    return "Failed to generate AI insights at this time."
  }
}
