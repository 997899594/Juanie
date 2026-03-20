declare module 'bun:test' {
  type TestHandler = (...args: any[]) => any;

  interface ExpectMatchers {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toContain(expected: any): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toThrow(expected?: any): void;
    toHaveBeenCalledWith(...args: any[]): void;
    not: ExpectMatchers;
  }

  interface MockFunction<T extends TestHandler = TestHandler> {
    (...args: Parameters<T>): ReturnType<T>;
    mock?: {
      calls?: unknown[][];
    };
  }

  interface MockFactory {
    <T extends TestHandler>(fn?: T): MockFunction<T>;
    module(path: string, factory: () => Record<string, unknown>): void;
  }

  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: TestHandler) => void;
  export const expect: (value: any) => ExpectMatchers;
  export const mock: MockFactory;
}
