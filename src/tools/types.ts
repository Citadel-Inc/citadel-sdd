import type { Profile } from "../profile/types.js";

export interface ToolContext {
  rootDir: string;
  profile: Profile;
  clock?: () => Date;
  principal?: string;
}
