/**
 * Jest type definitions to support test utilities
 */

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any[]> {
      (...args: Y): T;
      mockImplementation: (fn?: (...args: Y) => T) => Mock<T, Y>;
      mockResolvedValue: (value: T) => Mock<T, Y>;
      mockRejectedValue: (value: any) => Mock<T, Y>;
      mockReturnValue: (value: T) => Mock<T, Y>;
      mockClear: () => void;
      mockReset: () => void;
    }

    interface Expect {
      <T = any>(actual: T): jest.Matchers<T>;
    }

    interface Matchers<R> {
      toBe: (expected: any) => R;
      toEqual: (expected: any) => R;
      toBeInTheDocument: () => R;
      toHaveBeenCalled: () => R;
      toHaveBeenCalledWith: (...args: any[]) => R;
      toHaveBeenCalledTimes: (times: number) => R;
      toHaveFocus: () => R;
      toHaveAttribute: (attr: string, value?: string) => R;
      toHaveStyle: (style: string | Record<string, any>) => R;
      toBeDisabled: () => R;
      not: Matchers<R>;
    }
  }

  const jest: {
    fn: <T extends (...args: any[]) => any>(implementation?: T) => jest.Mock<ReturnType<T>, Parameters<T>>;
    clearAllMocks: () => void;
    restoreAllMocks: () => void;
    spyOn: <T extends {}, M extends keyof T>(object: T, method: M) => jest.Mock;
  };

  const expect: jest.Expect;
  const beforeEach: (fn: () => void) => void;
  const afterEach: (fn: () => void) => void;
  const beforeAll: (fn: () => void) => void;
  const afterAll: (fn: () => void) => void;
  const describe: (name: string, fn: () => void) => void;
  const it: (name: string, fn: () => void | Promise<void>) => void;
}

export {};