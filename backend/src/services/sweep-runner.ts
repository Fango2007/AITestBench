export interface SweepDefinition {
  parameters: Record<string, Array<string | number | boolean>>;
}

export interface SweepRun {
  sweep_id: string;
  variants: Array<Record<string, string | number | boolean>>;
}

export function buildSweepVariants(definition: SweepDefinition): SweepRun {
  const entries = Object.entries(definition.parameters);
  const variants: Array<Record<string, string | number | boolean>> = [];

  function build(index: number, current: Record<string, string | number | boolean>) {
    if (index >= entries.length) {
      variants.push({ ...current });
      return;
    }

    const [key, values] = entries[index];
    for (const value of values) {
      current[key] = value;
      build(index + 1, current);
    }
  }

  build(0, {});

  return {
    sweep_id: `sweep-${Date.now()}`,
    variants
  };
}
