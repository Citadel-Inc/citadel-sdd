import type { Profile } from '../profile/types.ts'

export interface ToolContext {
  rootDir: string
  profile: Profile
  clock?: () => Date
  principal?: string
}
