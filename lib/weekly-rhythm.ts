export interface WeeklyRhythmTask {
  id: string
  title: string
  day_of_week: number
}

export interface WeeklyRhythmTemplateLike {
  id: string
  weekly_rhythm_tasks: WeeklyRhythmTask[]
}

export interface WeeklyRhythmLogLike {
  rhythm_task_id: string
  completed_at: string
}

export interface GroupedWeeklyRhythmTask {
  id: string
  title: string
  taskIdsByDay: Partial<Record<number, string>>
}

export interface WeeklyRhythmProgress {
  scheduled: number
  completed: number
  completionRate: number
}

export interface WeeklyRhythmSummary {
  totalScheduled: number
  totalCompleted: number
  completionRate: number
  dueToday: number
  completedToday: number
  todayCompletionRate: number
  byRhythmId: Record<string, WeeklyRhythmProgress>
}

export function groupWeeklyRhythmTasks(tasks: WeeklyRhythmTask[]): GroupedWeeklyRhythmTask[] {
  const groupedTasks = new Map<string, GroupedWeeklyRhythmTask>()

  for (const task of tasks) {
    const existingTask = groupedTasks.get(task.title)

    if (existingTask) {
      existingTask.taskIdsByDay[task.day_of_week] = task.id
      continue
    }

    groupedTasks.set(task.title, {
      id: task.id,
      title: task.title,
      taskIdsByDay: {
        [task.day_of_week]: task.id,
      },
    })
  }

  return Array.from(groupedTasks.values())
}

function toPercent(completed: number, scheduled: number) {
  if (scheduled === 0) return 0
  return Math.round((completed / scheduled) * 100)
}

export function calculateWeeklyRhythmSummary({
  rhythms,
  logs,
  today,
}: {
  rhythms: WeeklyRhythmTemplateLike[]
  logs: WeeklyRhythmLogLike[]
  today: string
}): WeeklyRhythmSummary {
  const todayDayOfWeek = new Date(`${today}T00:00:00`).getDay()
  const taskIds = new Set<string>()
  const taskToRhythmId = new Map<string, string>()
  const byRhythmId: Record<string, WeeklyRhythmProgress> = {}

  let totalScheduled = 0
  let dueToday = 0

  for (const rhythm of rhythms) {
    const scheduled = rhythm.weekly_rhythm_tasks?.length ?? 0
    totalScheduled += scheduled
    dueToday += rhythm.weekly_rhythm_tasks.filter(
      (task) => task.day_of_week === todayDayOfWeek
    ).length

    byRhythmId[rhythm.id] = {
      scheduled,
      completed: 0,
      completionRate: 0,
    }

    for (const task of rhythm.weekly_rhythm_tasks) {
      taskIds.add(task.id)
      taskToRhythmId.set(task.id, rhythm.id)
    }
  }

  const relevantLogs = logs.filter((log) => taskIds.has(log.rhythm_task_id))
  const totalCompleted = relevantLogs.length
  const completedToday = relevantLogs.filter(
    (log) => log.completed_at === today
  ).length

  for (const log of relevantLogs) {
    const rhythmId = taskToRhythmId.get(log.rhythm_task_id)
    if (!rhythmId) continue

    byRhythmId[rhythmId].completed += 1
  }

  for (const rhythmId of Object.keys(byRhythmId)) {
    const progress = byRhythmId[rhythmId]
    progress.completionRate = toPercent(progress.completed, progress.scheduled)
  }

  return {
    totalScheduled,
    totalCompleted,
    completionRate: toPercent(totalCompleted, totalScheduled),
    dueToday,
    completedToday,
    todayCompletionRate: toPercent(completedToday, dueToday),
    byRhythmId,
  }
}
