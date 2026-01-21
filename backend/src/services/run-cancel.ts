const runControllers = new Map<string, AbortController>();

export function registerRunAbortController(runId: string): AbortSignal {
  const controller = new AbortController();
  runControllers.set(runId, controller);
  return controller.signal;
}

export function cancelRun(runId: string): boolean {
  const controller = runControllers.get(runId);
  if (!controller) {
    return false;
  }
  controller.abort();
  return true;
}

export function clearRunAbortController(runId: string): void {
  runControllers.delete(runId);
}
