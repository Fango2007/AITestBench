export interface TestSpecValidationError {
  message: string;
  path?: string;
}

const REQUIRED_FIELDS = [
  'id',
  'version',
  'name',
  'description',
  'protocols',
  'request',
  'assertions',
  'metrics'
];

export function validateJsonTestSpec(spec: Record<string, unknown>): TestSpecValidationError[] {
  const errors: TestSpecValidationError[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in spec)) {
      errors.push({ message: `Missing required field: ${field}`, path: field });
    }
  }

  if (spec.protocols && !Array.isArray(spec.protocols)) {
    errors.push({ message: 'protocols must be an array', path: 'protocols' });
  }

  if (spec.assertions && !Array.isArray(spec.assertions)) {
    errors.push({ message: 'assertions must be an array', path: 'assertions' });
  }

  if (spec.request && typeof spec.request !== 'object') {
    errors.push({ message: 'request must be an object', path: 'request' });
  }

  return errors;
}
