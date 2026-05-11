declare module "bun:test" {
  type Awaitable<T> = T | Promise<T>;
  type TestFn = () => Awaitable<void>;
  type HookFn = () => Awaitable<void>;

  interface DescribeFn {
    (name: string, fn: () => void): void;
    skip(name: string, fn: () => void): void;
    only(name: string, fn: () => void): void;
    todo(name: string, fn?: () => void): void;
  }

  interface TestApi {
    (name: string, fn: TestFn, timeoutMs?: number): void;
    skip(name: string, fn?: TestFn): void;
    only(name: string, fn: TestFn): void;
    todo(name: string, fn?: TestFn): void;
    each<T>(table: readonly T[]): (name: string, fn: (row: T) => Awaitable<void>) => void;
  }

  export const describe: DescribeFn;
  export const test: TestApi;
  export const it: TestApi;

  export function beforeAll(fn: HookFn): void;
  export function afterAll(fn: HookFn): void;
  export function beforeEach(fn: HookFn): void;
  export function afterEach(fn: HookFn): void;

  interface Matchers<T = unknown> {
    not: Matchers<T>;
    resolves: Matchers<Awaited<T>>;
    rejects: Matchers<unknown>;
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toContainEqual(expected: unknown): void;
    toHaveLength(n: number): void;
    toHaveProperty(path: string, value?: unknown): void;
    toMatch(re: string | RegExp): void;
    toMatchObject(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toBeCloseTo(n: number, digits?: number): void;
    toBeInstanceOf(cls: new (...args: unknown[]) => unknown): void;
    toThrow(matcher?: string | RegExp | Error): void;
    toThrowError(matcher?: string | RegExp | Error): void;
  }

  type ExpectFn = (<T>(actual: T) => Matchers<T>) & {
    any(cls: unknown): unknown;
    anything(): unknown;
    arrayContaining<T>(arr: readonly T[]): unknown;
    objectContaining(obj: object): unknown;
    stringContaining(s: string): unknown;
    stringMatching(re: string | RegExp): unknown;
  };

  export const expect: ExpectFn;
}
