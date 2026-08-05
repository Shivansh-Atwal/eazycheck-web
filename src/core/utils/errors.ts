export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof AppError && error.code === 'NETWORK_ERROR') return true;
  const err = error as { code?: string; message?: string; response?: { status?: number } };
  if (!err.response && err.message?.includes('Network')) return true;
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true;
  return false;
};

export const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

export const isConflictStatus = (status: number): boolean =>
  status === 409 || status === 422;

export const getErrorMessage = (error: unknown): string => {
  const err = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };
  return (
    err.response?.data?.error ||
    err.response?.data?.message ||
    err.message ||
    'An unexpected error occurred'
  );
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
