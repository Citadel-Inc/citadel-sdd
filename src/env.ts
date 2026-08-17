/**
 * Single point of `process.env` access. Every other module reads configuration
 * from here, so the coupling to the environment stays in one place.
 */
import process from "node:process";
export const env = {
  /** Overrides the discovered project root when the CWD is not the repo. */
  sddRoot: process.env.CITADEL_SDD_ROOT,
} as const;
