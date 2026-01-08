export interface ComplianceFinding {
  code: string;
  message: string;
}

export interface ComplianceReport {
  status: 'pass' | 'fail';
  findings: ComplianceFinding[];
}

export function evaluateCompliance(input: { response: Record<string, unknown> }): ComplianceReport {
  const findings: ComplianceFinding[] = [];
  if (!('id' in input.response)) {
    findings.push({ code: 'missing_id', message: 'Response missing id' });
  }
  if (!('choices' in input.response)) {
    findings.push({ code: 'missing_choices', message: 'Response missing choices' });
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    findings
  };
}
