import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "spec-fixtures");

export interface FixtureBundle {
  slug: string;
  spec: string;
  plan: string;
  tasks: string;
}

export function loadFixture(slug: string): FixtureBundle {
  const dir = join(FIXTURES_DIR, slug);
  return {
    slug,
    spec: readFileSync(join(dir, "spec.md"), "utf8"),
    plan: readFileSync(join(dir, "plan.md"), "utf8"),
    tasks: readFileSync(join(dir, "tasks.md"), "utf8"),
  };
}

export function listFixtures(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function loadAllFixtures(): FixtureBundle[] {
  return listFixtures().map(loadFixture);
}
