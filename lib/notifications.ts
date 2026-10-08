export function describeNotification(n: {
  type: string
  actorName: string | null
  taskTitle: string | null
  body: string | null
}): string {
  const who = n.actorName ?? 'Someone'
  const task = n.taskTitle ? `"${n.taskTitle}"` : 'a task'
  switch (n.type) {
    case 'assigned':
      return `${who} assigned you ${task}`
    case 'comment':
      return `${who} commented on ${task}${n.body ? `: ${n.body}` : ''}`
    case 'blocked':
      return `${who} marked ${task} blocked${n.body ? `: ${n.body}` : ''}`
    default:
      return `${who} updated ${task}`
  }
}
