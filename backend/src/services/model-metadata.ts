import { ModelRecord } from '../models/model.js';
import { ModelInput, upsertModelRecord } from './models-repository.js';

export type ModelMetadataInput = ModelInput;

export function recordModelMetadata(input: ModelMetadataInput): ModelRecord {
  return upsertModelRecord(input);
}
