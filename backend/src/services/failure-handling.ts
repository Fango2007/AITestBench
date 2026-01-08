export interface FailureContext {
  reason: string;
  retryable: boolean;
}

export function mapFailure(error: Error): FailureContext {
  return {
    reason: error.message,
    retryable: false
  };
}
