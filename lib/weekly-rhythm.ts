export interface WeeklyRhythmTask {
  id: string
  title: string
  day_of_week: number
}

export interface GroupedWeeklyRhythmTask {
  id: string
  title: string
  taskIdsByDay: Partial<Record<number, string>>
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
