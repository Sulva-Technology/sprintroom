'use server'

import { revalidatePath } from 'next/cache'

export async function globalRevalidate() {
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
