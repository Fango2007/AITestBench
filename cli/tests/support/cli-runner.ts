export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(_args: string[]): Promise<CliResult> {
  return { exitCode: 0, stdout: '', stderr: '' };
}
