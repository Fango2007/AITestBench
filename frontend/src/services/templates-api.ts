import { apiDelete, apiGet, apiPost, apiPut } from './api.js';

export type TemplateType = 'json' | 'python';

export interface TemplateRecord {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateInput {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
  version: string;
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  return apiGet<TemplateRecord[]>('/templates');
}

export async function createTemplate(input: TemplateInput): Promise<TemplateRecord> {
  return apiPost<TemplateRecord>('/templates', input);
}

export async function updateTemplate(
  id: string,
  updates: Omit<TemplateInput, 'id'>
): Promise<TemplateRecord> {
  return apiPut<TemplateRecord>(`/templates/${id}`, updates);
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiDelete(`/templates/${id}`);
}
