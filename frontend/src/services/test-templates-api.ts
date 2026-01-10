import { apiGet, apiPost, apiPut } from './api';

export interface TestTemplateRecord {
  id: string;
  name: string;
  format: 'json' | 'python';
  status: 'active' | 'archived';
  current_version_id: string;
  current_version_number: number;
}

export interface TestTemplateVersionRecord {
  id: string;
  template_id: string;
  version_number: number;
  content: string;
  created_at: string;
}

export interface TestTemplateDetail extends TestTemplateRecord {
  versions: TestTemplateVersionRecord[];
}

export interface TestTemplateCreateInput {
  name: string;
  format: 'json' | 'python';
  content: string;
}

export interface TestTemplateUpdateInput {
  name?: string;
  content: string;
}

export async function listTestTemplates(
  status: 'active' | 'archived' | 'all' = 'all'
): Promise<TestTemplateRecord[]> {
  const query = status === 'all' ? '' : `?status=${status}`;
  return apiGet<TestTemplateRecord[]>(`/test-templates${query}`);
}

export async function createTestTemplate(input: TestTemplateCreateInput): Promise<TestTemplateRecord> {
  return apiPost<TestTemplateRecord>('/test-templates', input);
}

export async function getTestTemplateDetail(id: string): Promise<TestTemplateDetail> {
  return apiGet<TestTemplateDetail>(`/test-templates/${id}`);
}

export async function updateTestTemplate(
  id: string,
  input: TestTemplateUpdateInput
): Promise<TestTemplateRecord> {
  return apiPut<TestTemplateRecord>(`/test-templates/${id}`, input);
}
