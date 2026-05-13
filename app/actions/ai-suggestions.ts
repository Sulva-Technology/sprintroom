'use server'

import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

// We assume the API key is in environment variables
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' })

export async function getTaskSuggestions() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return { 
        success: false, 
        error: 'Google Gemini API key not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your environment.' 
      }
    }

    // 1. Gather Context: Recent tasks and focus session history
    const [
      { data: recentTasks },
      { data: focusNotes }
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select('title, description, status, last_progress_note')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(15),
      supabase
        .from('focus_sessions')
        .select('progress_note, is_meaningful, tasks(title)')
        .eq('user_id', user.id)
        .not('progress_note', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    // 2. Prepare Prompt


    const historyPrompt = recentTasks?.map(t => 
      `- Task: ${t.title} (${t.status}). Note: ${t.last_progress_note || 'N/A'}`
    ).join('\n') || 'No task history found.'

    const notesPrompt = focusNotes?.map(n => 
      `- Focused on: ${(n.tasks as any)?.title}. Proof: ${n.progress_note}`
    ).join('\n') || 'No focus session notes found.'

    const prompt = `
      You are an elite productivity coach for "SprintRoom," an execution-focused task manager.
      Your goal is to analyze the user's recent activity and suggest 3 to 5 high-impact tasks or "Weekly Rhythms" (recurring habits) for their upcoming week.

      USER WORK HISTORY:
      ${historyPrompt}

      RECENT FOCUS SESSION NOTES:
      ${notesPrompt}

      STRICT INSTRUCTIONS:
      1. Identify patterns (e.g., if they focus on 'Refactoring', suggest a 'Code Quality Audit').
      2. Suggest realistic, shipping-focused items.
      3. Distinguish between a one-off "Task" and a recurring "Weekly Rhythm."
      4. Return ONLY a valid JSON array of objects. No intro, no outro, no markdown formatting.

      JSON FORMAT:
      [
        {
          "title": "Short descriptive title",
          "description": "Clear actionable instruction",
          "reason": "Explain why you're suggesting this based on their history",
          "is_rhythm": boolean,
          "estimated_pomodoros": number
        }
      ]
    `

    // 3. Generate Suggestions
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    const text = response.text ?? ''
    
    // Clean up potential markdown JSON blocks
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim()
    
    const suggestions = JSON.parse(cleanedText)

    return { success: true, suggestions }

  } catch (error: any) {
    console.error('Error generating AI suggestions:', error)
    return { success: false, error: 'Failed to generate suggestions', details: error.message }
  }
}
