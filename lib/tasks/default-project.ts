/**
 * Where a quick-added task goes: the workspace's "General" project (every
 * workspace gets one from createWorkspace), else the oldest project.
 */
export function pickDefaultProjectId(
  projects: { id: string; name: string; created_at: string }[]
): string | undefined {
  const general = projects.find((p) => p.name.trim().toLowerCase() === 'general')
  if (general) return general.id
  return [...projects].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id
}
