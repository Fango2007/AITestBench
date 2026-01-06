export function benchmarkPlaceholder() {
  const start = performance.now();
  for (let i = 0; i < 10000; i += 1) {
    JSON.stringify({ index: i });
  }
  const elapsed = performance.now() - start;
  return { elapsed_ms: elapsed };
}
