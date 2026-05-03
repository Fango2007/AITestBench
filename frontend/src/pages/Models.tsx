import { useEffect, useMemo, useState } from 'react';

import { InferenceServerRecord, listInferenceServers } from '../services/inference-servers-api.js';
import {
  ModelCapabilityTag,
  ModelFormat,
  ModelInput,
  ModelProvider,
  ModelQuantisationMethod,
  ModelRecord,
  createModel,
  listModels,
  updateModel
} from '../services/models-api.js';
import { extractBaseModelName, inferModelMetadata } from '../services/model-metadata-inference.js';

type ModelServerInfo = {
  server_id: string;
  display_name: string;
  base_url: string;
  schema_families: string[];
};

type ModelAggregate = {
  model_id: string;
  model_ids: string[];
  display_name: string;
  context_windows: number[];
  quantisations: string[];
  servers: ModelServerInfo[];
};

function modelLabel(modelId: string, displayName: string, record?: ModelRecord): string {
  const storedBaseName = record?.model.base_model_name?.trim();
  const normalizedStoredBaseName = storedBaseName ? extractBaseModelName(storedBaseName) : null;
  return normalizedStoredBaseName
    ?? inferModelMetadata(modelId, displayName).baseModelName
    ?? extractBaseModelName(displayName)
    ?? displayName;
}

function canonicalModelKey(modelId: string, displayName: string, record?: ModelRecord): string {
  return modelLabel(modelId, displayName, record).toLowerCase();
}

function isProviderPrefixedModelId(modelId: string): boolean {
  return /^\/?[a-zA-Z0-9][a-zA-Z0-9._-]*\//.test(modelId);
}

function shouldPreferModelCandidate(current: ModelAggregate, candidate: ModelAggregate): boolean {
  const currentPrefixed = isProviderPrefixedModelId(current.model_id);
  const candidatePrefixed = isProviderPrefixedModelId(candidate.model_id);
  if (currentPrefixed !== candidatePrefixed) {
    return !candidatePrefixed;
  }
  return candidate.model_id.length < current.model_id.length;
}

function mergeModelAggregate(target: ModelAggregate, source: ModelAggregate): void {
  for (const modelId of source.model_ids) {
    if (!target.model_ids.includes(modelId)) {
      target.model_ids.push(modelId);
    }
  }
  for (const contextWindow of source.context_windows) {
    if (!target.context_windows.includes(contextWindow)) {
      target.context_windows.push(contextWindow);
    }
  }
  for (const quantisation of source.quantisations) {
    if (!target.quantisations.includes(quantisation)) {
      target.quantisations.push(quantisation);
    }
  }
  for (const server of source.servers) {
    if (!target.servers.some((entry) => entry.server_id === server.server_id)) {
      target.servers.push(server);
    }
  }
}

function inferredMetadataCandidates(model: ModelAggregate) {
  return model.model_ids.map((modelId) => inferModelMetadata(modelId, model.display_name));
}

function firstInferred<T>(model: ModelAggregate, selector: (metadata: ReturnType<typeof inferModelMetadata>) => T | null | undefined): T | null {
  for (const metadata of inferredMetadataCandidates(model)) {
    const value = selector(metadata);
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return null;
}

function bestInferredMetadata(model: ModelAggregate) {
  const candidates = inferredMetadataCandidates(model);
  return candidates.find((metadata) => metadata.quantizedProvider || metadata.format || metadata.quantisation.bits != null)
    ?? candidates[0]
    ?? inferModelMetadata(model.model_id, model.display_name);
}

function inferProviderKey(model: ModelAggregate): ModelProvider {
  const raw = `${model.model_id} ${model.display_name}`.toLowerCase();
  if (raw.includes('mistral') || raw.includes('mixtral')) {
    return 'mistral';
  }
  if (raw.includes('qwen')) {
    return 'qwen';
  }
  if (raw.includes('gemini') || raw.includes('google') || raw.includes('palm') || raw.includes('gemma')) {
    return 'google';
  }
  if (raw.includes('moonshot') || /\bkimi\b/i.test(raw)) {
    return 'moonshot';
  }
  if (raw.includes('gpt') || raw.includes('openai')) {
    return 'openai';
  }
  if (raw.includes('claude') || raw.includes('anthropic')) {
    return 'anthropic';
  }
  if (raw.includes('llama') || raw.includes('meta')) {
    return 'meta';
  }
  if (raw.includes('cohere') || raw.includes('command')) {
    return 'cohere';
  }
  if (raw.includes('deepseek')) {
    return 'deepseek';
  }
  if (raw.includes('nvidia') || raw.includes('nemotron')) {
    return 'nvidia';
  }
  if (raw.includes('zai') || raw.includes('01.ai') || raw.includes('01ai') || raw.includes('yi')) {
    return 'zai';
  }
  return 'custom';
}

function formatProviderLabel(provider: ModelProvider): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'meta':
      return 'Meta';
    case 'mistral':
      return 'Mistral';
    case 'qwen':
      return 'Qwen';
    case 'google':
      return 'Google';
    case 'moonshot':
      return 'Moonshot';
    case 'cohere':
      return 'Cohere';
    case 'deepseek':
      return 'Deepseek';
    case 'anthropic':
      return 'Anthropic';
    case 'nvidia':
      return 'NVIDIA';
    case 'zai':
      return 'Zai';
    case 'custom':
      return 'Custom';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

function formatQuantisation(
  quantisation?: {
    method?: ModelQuantisationMethod;
    bits?: number | null;
    group_size?: number | null;
    weight_format?: string | null;
  } | null
): string {
  if (!quantisation) {
    return 'Unknown';
  }
  if (quantisation.weight_format) {
    return quantisation.weight_format;
  }
  const method = quantisation.method ?? 'unknown';
  const bits = quantisation.bits;
  const groupSize = quantisation.group_size;
  if (bits && groupSize) {
    return `${method.toUpperCase()} · ${bits}-bit · group ${groupSize}`;
  }
  return bits ? `${method.toUpperCase()} · ${bits}-bit` : method.toUpperCase();
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDiscoveryQuantisation(
  quantisation:
    | {
        method: string;
        bits: number | null;
        group_size: number | null;
        scheme?: string | null;
        variant?: string | null;
        weight_format?: string | null;
      }
    | string
    | null
): string | null {
  if (!quantisation) {
    return null;
  }
  if (typeof quantisation === 'string') {
    return quantisation;
  }
  if (quantisation.weight_format) {
    return quantisation.weight_format;
  }
  const method = quantisation.method ?? 'unknown';
  const bits = quantisation.bits;
  const groupSize = quantisation.group_size;
  if (bits && groupSize) {
    return `${method.toUpperCase()} · ${bits}-bit · group ${groupSize}`;
  }
  return bits ? `${method.toUpperCase()} · ${bits}-bit` : method.toUpperCase();
}

interface ModelsProps {
  onModelSelect?: (serverId: string, modelId: string) => void;
}

export function Models({ onModelSelect }: ModelsProps = {}) {
  const [servers, setServers] = useState<InferenceServerRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | 'all'>('all');
  const [selectedQuantizedProvider, setSelectedQuantizedProvider] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<ModelFormat | 'all'>('all');
  const [selectedQuantBits, setSelectedQuantBits] = useState<string>('all');
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<ModelCapabilityTag>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelRecords, setModelRecords] = useState<ModelRecord[]>([]);
  const [modelRecordsError, setModelRecordsError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState({
    provider: 'unknown' as ModelProvider,
    quantMethod: 'unknown' as ModelQuantisationMethod,
    quantBits: '',
    quantGroupSize: '',
    quantScheme: 'unknown',
    quantVariant: '',
    quantWeightFormat: '',
    contextWindow: '',
    capText: false,
    capJson: false,
    capTools: false,
    capEmbeddings: false,
    capVision: false,
    capAudio: false,
    capReasoning: false,
    capExplicit: false,
    quantizedProvider: '',
    capThinking: false,
    capCoding: false,
    capInstruct: false,
    capMoe: false,
    format: '' as ModelFormat | ''
  });

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError(null);
    setModelRecordsError(null);
    Promise.allSettled([listInferenceServers(), listModels()])
      .then(([serversResult, modelsResult]) => {
        if (!isActive) {
          return;
        }
        if (serversResult.status === 'fulfilled') {
          setServers(serversResult.value);
        } else {
          setError(serversResult.reason instanceof Error ? serversResult.reason.message : 'Unable to load models');
          setServers([]);
        }
        if (modelsResult.status === 'fulfilled') {
          setModelRecords(modelsResult.value);
        } else {
          setModelRecordsError(
            modelsResult.reason instanceof Error ? modelsResult.reason.message : 'Unable to load model records'
          );
          setModelRecords([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  const modelRecordMap = useMemo(() => {
    const map = new Map<string, ModelRecord>();
    for (const record of modelRecords) {
      map.set(`${record.model.server_id}:${record.model.model_id}`, record);
    }
    return map;
  }, [modelRecords]);

  const providerByModelId = useMemo(() => {
    const map = new Map<string, ModelProvider>();
    for (const record of modelRecords) {
      const existing = map.get(record.model.model_id);
      if (record.identity.provider !== 'unknown' && (!existing || existing === 'unknown')) {
        map.set(record.model.model_id, record.identity.provider);
      }
    }
    return map;
  }, [modelRecords]);

  const modelRecordByModelId = useMemo(() => {
    const map = new Map<string, ModelRecord>();
    for (const record of modelRecords) {
      if (!map.has(record.model.model_id)) {
        map.set(record.model.model_id, record);
      }
    }
    return map;
  }, [modelRecords]);

  const modelDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of modelRecords) {
      if (!map.has(record.model.model_id)) {
        map.set(record.model.model_id, modelLabel(record.model.model_id, record.model.display_name, record));
      }
    }
    return map;
  }, [modelRecords]);

  const quantizedProviders = useMemo(() => {
    const set = new Set<string>();
    for (const record of modelRecords) {
      if (record.identity.quantized_provider) {
        set.add(record.identity.quantized_provider);
      }
    }
    for (const server of servers) {
      for (const model of server.discovery.model_list.normalised) {
        const inferred = inferModelMetadata(model.model_id, model.display_name ?? model.model_id);
        if (inferred.quantizedProvider) {
          set.add(inferred.quantizedProvider);
        }
      }
    }
    return Array.from(set).sort();
  }, [modelRecords, servers]);

  const formats = useMemo(() => {
    const set = new Set<ModelFormat>();
    for (const record of modelRecords) {
      if (record.architecture.format) {
        set.add(record.architecture.format);
      }
    }
    for (const server of servers) {
      for (const model of server.discovery.model_list.normalised) {
        const inferred = inferModelMetadata(model.model_id, model.display_name ?? model.model_id);
        if (inferred.format) {
          set.add(inferred.format);
        }
      }
    }
    return Array.from(set).sort();
  }, [modelRecords, servers]);

  const quantisationBits = useMemo(() => {
    const set = new Set<number>();
    for (const record of modelRecords) {
      if (record.architecture.quantisation.bits != null) {
        set.add(record.architecture.quantisation.bits);
      }
    }
    for (const server of servers) {
      for (const model of server.discovery.model_list.normalised) {
        const inferred = inferModelMetadata(model.model_id, model.display_name ?? model.model_id);
        if (inferred.quantisation.bits != null) {
          set.add(inferred.quantisation.bits);
        }
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [modelRecords, servers]);

  const models = useMemo<ModelAggregate[]>(() => {
    const map = new Map<string, ModelAggregate>();
    const addOrMergeModel = (candidate: ModelAggregate, record?: ModelRecord) => {
      const key = canonicalModelKey(candidate.model_id, candidate.display_name, record);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...candidate,
          model_ids: [...candidate.model_ids],
          context_windows: [...candidate.context_windows],
          quantisations: [...candidate.quantisations],
          servers: [...candidate.servers]
        });
        return;
      }
      if (shouldPreferModelCandidate(existing, candidate)) {
        const merged = {
          ...candidate,
          model_ids: [...candidate.model_ids],
          context_windows: [...candidate.context_windows],
          quantisations: [...candidate.quantisations],
          servers: [...candidate.servers]
        };
        mergeModelAggregate(merged, existing);
        map.set(key, merged);
        return;
      }
      mergeModelAggregate(existing, candidate);
    };

    for (const server of servers) {
      const schemaFamilies = server.runtime.api.schema_family;
      for (const model of server.discovery.model_list.normalised) {
        if (!model.model_id) {
          continue;
        }
        const displayName = model.display_name ?? model.model_id;
        const quantLabel = formatDiscoveryQuantisation(model.quantisation);
        addOrMergeModel({
          model_id: model.model_id,
          model_ids: [model.model_id],
          display_name: displayName,
          context_windows: model.context_window_tokens != null ? [model.context_window_tokens] : [],
          quantisations: quantLabel ? [quantLabel] : [],
          servers: [
            {
              server_id: server.inference_server.server_id,
              display_name: server.inference_server.display_name,
              base_url: server.endpoints.base_url,
              schema_families: schemaFamilies
            }
          ]
        });
      }
    }
    // Merge in models from modelRecords not covered by discovery
    for (const record of modelRecords) {
      const server = servers.find((s) => s.inference_server.server_id === record.model.server_id);
      const serverInfo = server
        ? {
            server_id: server.inference_server.server_id,
            display_name: server.inference_server.display_name,
            base_url: server.endpoints.base_url,
            schema_families: server.runtime.api.schema_family
          }
        : null;
      addOrMergeModel({
        model_id: record.model.model_id,
        model_ids: [record.model.model_id],
        display_name: record.model.display_name,
        context_windows: record.limits.context_window_tokens != null ? [record.limits.context_window_tokens] : [],
        quantisations: [],
        servers: serverInfo ? [serverInfo] : []
      }, record);
    }
    return Array.from(map.values()).sort((a, b) => modelLabel(a.model_id, a.display_name).localeCompare(modelLabel(b.model_id, b.display_name)));
  }, [servers, modelRecords]);

  const providers = useMemo(() => {
    const bucket = new Set<ModelProvider>();
    for (const provider of providerByModelId.values()) {
      bucket.add(provider);
    }
    for (const model of models) {
      const inferred = inferModelMetadata(model.model_id, model.display_name).provider;
      bucket.add(providerByModelId.get(model.model_id) ?? (inferred === 'unknown' ? inferProviderKey(model) : inferred));
    }
    return Array.from(bucket).sort((a, b) => a.localeCompare(b));
  }, [models, providerByModelId]);

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      if (selectedServerId !== 'all') {
        if (!model.servers.some((server) => server.server_id === selectedServerId)) {
          return false;
        }
      }

      if (selectedProvider !== 'all') {
        const recordProvider =
          selectedServerId !== 'all'
            ? modelRecordMap.get(`${selectedServerId}:${model.model_id}`)?.identity.provider
            : undefined;
        const providerKey =
          providerByModelId.get(model.model_id)
          ?? (recordProvider && recordProvider !== 'unknown' ? recordProvider : undefined)
          ?? firstInferred(model, (metadata) => metadata.provider !== 'unknown' ? metadata.provider : null)
          ?? inferProviderKey(model);
        if (providerKey !== selectedProvider) {
          return false;
        }
      }

      if (selectedQuantizedProvider !== 'all') {
        const record =
          selectedServerId !== 'all'
            ? (modelRecordMap.get(`${selectedServerId}:${model.model_id}`) ?? modelRecordByModelId.get(model.model_id))
            : modelRecordByModelId.get(model.model_id);
        const quantizedProvider = record?.identity.quantized_provider
          ?? firstInferred(model, (metadata) => metadata.quantizedProvider);
        if (quantizedProvider !== selectedQuantizedProvider) {
          return false;
        }
      }

      if (selectedFormat !== 'all') {
        const record =
          selectedServerId !== 'all'
            ? (modelRecordMap.get(`${selectedServerId}:${model.model_id}`) ?? modelRecordByModelId.get(model.model_id))
            : modelRecordByModelId.get(model.model_id);
        const format = record?.architecture.format ?? firstInferred(model, (metadata) => metadata.format);
        if (format !== selectedFormat) {
          return false;
        }
      }

      if (selectedQuantBits !== 'all') {
        const record =
          selectedServerId !== 'all'
            ? (modelRecordMap.get(`${selectedServerId}:${model.model_id}`) ?? modelRecordByModelId.get(model.model_id))
            : modelRecordByModelId.get(model.model_id);
        const bits = record?.architecture.quantisation.bits
          ?? firstInferred(model, (metadata) => metadata.quantisation.bits);
        if (bits == null || bits.toString() !== selectedQuantBits) {
          return false;
        }
      }

      if (selectedCapabilities.size > 0) {
        const record =
          selectedServerId !== 'all'
            ? (modelRecordMap.get(`${selectedServerId}:${model.model_id}`) ?? modelRecordByModelId.get(model.model_id))
            : modelRecordByModelId.get(model.model_id);
        for (const cap of selectedCapabilities) {
          if (!(record?.capabilities.use_case[cap] ?? firstInferred(model, (metadata) => metadata.useCase[cap]))) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    models,
    modelRecordByModelId,
    modelRecordMap,
    providerByModelId,
    selectedProvider,
    selectedServerId,
    selectedQuantizedProvider,
    selectedFormat,
    selectedQuantBits,
    selectedCapabilities
  ]);

  const visibleModels = useMemo(() => {
    const map = new Map<string, ModelAggregate>();
    for (const model of filteredModels) {
      const key = modelLabel(model.model_id, model.display_name).toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, model);
        continue;
      }
      if (shouldPreferModelCandidate(existing, model)) {
        const merged = {
          ...model,
          model_ids: [...model.model_ids],
          context_windows: [...model.context_windows],
          quantisations: [...model.quantisations],
          servers: [...model.servers]
        };
        mergeModelAggregate(merged, existing);
        map.set(key, merged);
        continue;
      }
      mergeModelAggregate(existing, model);
    }
    return Array.from(map.values());
  }, [filteredModels]);

  useEffect(() => {
    if (!visibleModels.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleModels.some((model) => model.model_id === selectedId)) {
      setSelectedId(visibleModels[0].model_id);
    }
  }, [visibleModels, selectedId]);

  useEffect(() => {
    if (servers.length === 1 && selectedServerId === 'all') {
      setSelectedServerId(servers[0].inference_server.server_id);
    }
  }, [servers, selectedServerId]);

  const selectedModel = visibleModels.find((model) => model.model_id === selectedId) ?? null;
  const effectiveServerId =
    selectedModel && selectedServerId === 'all' && selectedModel.servers.length === 1
      ? selectedModel.servers[0].server_id
      : selectedServerId;
  const selectedRecord =
    selectedModel && effectiveServerId !== 'all'
      ? modelRecordMap.get(`${effectiveServerId}:${selectedModel.model_id}`) ?? null
      : null;
  const selectedInferred = selectedModel
    ? bestInferredMetadata(selectedModel)
    : null;
  const contextLabel = selectedModel?.context_windows.length
    ? selectedModel.context_windows.sort((a, b) => a - b).join(', ')
    : 'N/A';
  const quantLabel = selectedModel?.quantisations.length
    ? selectedModel.quantisations.join(', ')
    : 'N/A';
  const providerLabel = selectedModel
    ? formatProviderLabel(providerByModelId.get(selectedModel.model_id) ?? selectedInferred?.provider ?? inferProviderKey(selectedModel))
    : 'Unknown';
  const quantisationLabel = selectedRecord
    ? formatQuantisation(selectedRecord.architecture.quantisation)
    : selectedInferred
      ? formatQuantisation({
          method: selectedInferred.quantisation.method,
          bits: selectedInferred.quantisation.bits,
          group_size: null,
        })
      : quantLabel;
  const discoveryQuantisation =
    selectedModel && effectiveServerId !== 'all'
      ? servers
          .find((server) => server.inference_server.server_id === effectiveServerId)
          ?.discovery.model_list.normalised.find((entry) => entry.model_id === selectedModel.model_id)
          ?.quantisation ?? null
      : null;
  const quantisationLines = selectedRecord
    ? [
        `method: ${selectedRecord.architecture.quantisation.method ?? 'unknown'}`,
        `bits: ${selectedRecord.architecture.quantisation.bits ?? 'none'}`,
        `group: ${selectedRecord.architecture.quantisation.group_size ?? 'none'}`,
        `scheme: ${selectedRecord.architecture.quantisation.scheme ?? 'none'}`,
        `variant: ${selectedRecord.architecture.quantisation.variant ?? 'none'}`,
        `weight: ${selectedRecord.architecture.quantisation.weight_format ?? 'none'}`
      ]
    : selectedInferred
      ? [
          `method: ${selectedInferred.quantisation.method}`,
          `bits: ${selectedInferred.quantisation.bits ?? 'none'}`,
          'group: none',
          'scheme: none',
          'variant: none',
          'weight: none'
        ]
    : discoveryQuantisation && typeof discoveryQuantisation !== 'string'
      ? [
          `method: ${discoveryQuantisation.method ?? 'unknown'}`,
          `bits: ${discoveryQuantisation.bits ?? 'none'}`,
          `group: ${discoveryQuantisation.group_size ?? 'none'}`,
          `scheme: ${discoveryQuantisation.scheme ?? 'none'}`,
          `variant: ${discoveryQuantisation.variant ?? 'none'}`,
          `weight: ${discoveryQuantisation.weight_format ?? 'none'}`
        ]
      : null;
  const capabilityGenerationLabel = selectedRecord
    ? [
        `text: ${selectedRecord.capabilities.generation.text ? 'yes' : 'none'}`,
        `json: ${selectedRecord.capabilities.generation.json_schema_output ? 'yes' : 'none'}`,
        `tools: ${selectedRecord.capabilities.generation.tools ? 'yes' : 'none'}`,
        `embeddings: ${selectedRecord.capabilities.generation.embeddings ? 'yes' : 'none'}`
      ]
    : null;
  const capabilityUseCaseLabel = selectedRecord
    ? [
        `thinking: ${selectedRecord.capabilities.use_case.thinking ? 'yes' : 'none'}`,
        `coding: ${selectedRecord.capabilities.use_case.coding ? 'yes' : 'none'}`,
        `instruct: ${selectedRecord.capabilities.use_case.instruct ? 'yes' : 'none'}`,
        `mixture of experts: ${selectedRecord.capabilities.use_case.mixture_of_experts ? 'yes' : 'none'}`
      ]
    : selectedInferred
      ? [
          `thinking: ${selectedInferred.useCase.thinking ? 'yes' : 'none'}`,
          `coding: ${selectedInferred.useCase.coding ? 'yes' : 'none'}`,
          `instruct: ${selectedInferred.useCase.instruct ? 'yes' : 'none'}`,
          `mixture of experts: ${selectedInferred.useCase.mixture_of_experts ? 'yes' : 'none'}`
        ]
      : null;
  const capabilityMultimodalLabel = selectedRecord
    ? [
        `vision: ${selectedRecord.capabilities.multimodal.vision ? 'yes' : 'none'}`,
        `audio: ${selectedRecord.capabilities.multimodal.audio ? 'yes' : 'none'}`
      ]
    : null;
  const capabilityReasoningLabel = selectedRecord
    ? [
        `supported: ${selectedRecord.capabilities.reasoning.supported ? 'yes' : 'none'}`,
        `explicit tokens: ${selectedRecord.capabilities.reasoning.explicit_tokens ? 'yes' : 'none'}`
      ]
    : null;

  const canUpdate = Boolean(selectedModel && effectiveServerId !== 'all');

  function openUpdateModal() {
    if (!selectedModel || effectiveServerId === 'all') {
      return;
    }
    const record = selectedRecord;
    const inferred = bestInferredMetadata(selectedModel);
    const provider = providerByModelId.get(selectedModel.model_id) ?? inferred.provider ?? inferProviderKey(selectedModel);
    setUpdateForm({
      provider,
      quantMethod: record?.architecture.quantisation.method ?? inferred.quantisation.method,
      quantBits: record?.architecture.quantisation.bits?.toString() ?? inferred.quantisation.bits?.toString() ?? '',
      quantGroupSize: record?.architecture.quantisation.group_size?.toString() ?? '',
      quantScheme: record?.architecture.quantisation.scheme ?? 'unknown',
      quantVariant: record?.architecture.quantisation.variant ?? '',
      quantWeightFormat: record?.architecture.quantisation.weight_format ?? '',
      contextWindow: record?.limits.context_window_tokens?.toString() ?? '',
      capText: record?.capabilities.generation.text ?? false,
      capJson: record?.capabilities.generation.json_schema_output ?? false,
      capTools: record?.capabilities.generation.tools ?? false,
      capEmbeddings: record?.capabilities.generation.embeddings ?? false,
      capVision: record?.capabilities.multimodal.vision ?? false,
      capAudio: record?.capabilities.multimodal.audio ?? false,
      capReasoning: record?.capabilities.reasoning.supported ?? false,
      capExplicit: record?.capabilities.reasoning.explicit_tokens ?? false,
      quantizedProvider: record?.identity.quantized_provider ?? inferred.quantizedProvider ?? '',
      capThinking: record?.capabilities.use_case.thinking ?? inferred.useCase.thinking,
      capCoding: record?.capabilities.use_case.coding ?? inferred.useCase.coding,
      capInstruct: record?.capabilities.use_case.instruct ?? inferred.useCase.instruct,
      capMoe: record?.capabilities.use_case.mixture_of_experts ?? inferred.useCase.mixture_of_experts,
      format: record?.architecture.format ?? inferred.format ?? ''
    });
    setUpdateError(null);
    setShowUpdateModal(true);
  }

  async function handleUpdateModel() {
    if (!selectedModel || effectiveServerId === 'all') {
      return;
    }
    setUpdateBusy(true);
    setUpdateError(null);
    const payload: ModelInput = {
      model: {
        model_id: selectedModel.model_id,
        server_id: effectiveServerId,
        display_name: selectedModel.display_name
      },
      identity: {
        provider: updateForm.provider,
        quantized_provider: updateForm.quantizedProvider.trim() || null
      },
      architecture: {
        quantisation: {
          method: updateForm.quantMethod,
          bits: parseOptionalNumber(updateForm.quantBits),
          group_size: parseOptionalNumber(updateForm.quantGroupSize),
          scheme: updateForm.quantScheme === '' ? null : updateForm.quantScheme,
          variant: updateForm.quantVariant === '' ? null : updateForm.quantVariant,
          weight_format: updateForm.quantWeightFormat.trim() ? updateForm.quantWeightFormat.trim() : null
        },
        format: updateForm.format || null
      },
      limits: {
        context_window_tokens: parseOptionalNumber(updateForm.contextWindow)
      },
      capabilities: {
        generation: {
          text: updateForm.capText,
          json_schema_output: updateForm.capJson,
          tools: updateForm.capTools,
          embeddings: updateForm.capEmbeddings
        },
        multimodal: { vision: updateForm.capVision, audio: updateForm.capAudio },
        reasoning: { supported: updateForm.capReasoning, explicit_tokens: updateForm.capExplicit },
        use_case: {
          thinking: updateForm.capThinking,
          coding: updateForm.capCoding,
          instruct: updateForm.capInstruct,
          mixture_of_experts: updateForm.capMoe
        }
      }
    };

    try {
      const providerPayload: ModelInput = {
        model: {
          model_id: selectedModel.model_id
        },
        identity: { provider: updateForm.provider }
      };

      await Promise.all(
        selectedModel.servers.map(async (server) => {
          if (server.server_id === effectiveServerId) {
            return;
          }
          const key = `${server.server_id}:${selectedModel.model_id}`;
          const record = modelRecordMap.get(key);
          if (record) {
            await updateModel(server.server_id, selectedModel.model_id, providerPayload);
            return;
          }
          await createModel({
            ...providerPayload,
            model: {
              model_id: selectedModel.model_id,
              server_id: server.server_id,
              display_name: selectedModel.display_name
            }
          });
        })
      );

      if (selectedRecord) {
        await updateModel(effectiveServerId, selectedModel.model_id, payload);
      } else {
        await createModel(payload);
      }

      const refreshed = await listModels();
      setModelRecords(refreshed);
      setShowUpdateModal(false);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Unable to update model');
    } finally {
      setUpdateBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Models</h2>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {modelRecordsError ? <div className="error">{modelRecordsError}</div> : null}
      {loading ? <p className="muted">Loading models…</p> : null}
      <div className="filters-row">
        <div className="field">
          <label htmlFor="provider-filter">Provider</label>
          <select
            id="provider-filter"
            value={selectedProvider}
            onChange={(event) => setSelectedProvider(event.target.value as ModelProvider | 'all')}
            disabled={providers.length === 0}
          >
            <option value="all">All providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {formatProviderLabel(provider)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="server-filter">Inference server</label>
          <select
            id="server-filter"
            value={selectedServerId}
            onChange={(event) => setSelectedServerId(event.target.value)}
            disabled={servers.length === 0}
          >
            <option value="all">All servers</option>
            {servers.map((server) => (
              <option key={server.inference_server.server_id} value={server.inference_server.server_id}>
                {server.inference_server.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="quantized-provider-filter">Quantized provider</label>
          <select
            id="quantized-provider-filter"
            value={selectedQuantizedProvider}
            onChange={(event) => setSelectedQuantizedProvider(event.target.value)}
            disabled={quantizedProviders.length === 0}
          >
            <option value="all">All providers</option>
            {quantizedProviders.map((qp) => (
              <option key={qp} value={qp}>
                {qp}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="format-filter">Format</label>
          <select
            id="format-filter"
            value={selectedFormat}
            onChange={(event) => setSelectedFormat(event.target.value as ModelFormat | 'all')}
            disabled={formats.length === 0}
          >
            <option value="all">All formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="quant-bits-filter">Quantization</label>
          <select
            id="quant-bits-filter"
            value={selectedQuantBits}
            onChange={(event) => setSelectedQuantBits(event.target.value)}
            disabled={quantisationBits.length === 0}
          >
            <option value="all">All bit-depths</option>
            {quantisationBits.map((bits) => (
              <option key={bits} value={bits.toString()}>
                {bits}-bit
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Capabilities</label>
          <div className="checkbox-grid">
            {(['thinking', 'coding', 'instruct', 'mixture_of_experts'] as ModelCapabilityTag[]).map((cap) => (
              <label key={cap} className="checkbox">
                <input
                  type="checkbox"
                  value={cap}
                  checked={selectedCapabilities.has(cap)}
                  onChange={(event) => {
                    setSelectedCapabilities((prev) => {
                      const next = new Set(prev);
                      if (event.target.checked) {
                        next.add(cap);
                      } else {
                        next.delete(cap);
                      }
                      return next;
                    });
                  }}
                />
                {cap.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="model-filter">Model</label>
          <select
            id="model-filter"
            value={selectedId ?? ''}
            onChange={(event) => setSelectedId(event.target.value || null)}
            disabled={visibleModels.length === 0}
          >
            {visibleModels.length === 0 ? (
              <option value="">No models</option>
            ) : (
              visibleModels.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {modelDisplayMap.get(model.model_id)
                    ?? inferModelMetadata(model.model_id, model.display_name).baseModelName
                    ?? model.display_name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
      <div className="details-panel">
        <div className="card">
          <div className="panel-header">
            <h3>Models</h3>
            <span className="muted">{visibleModels.length}</span>
          </div>
          {visibleModels.length === 0 ? (
            <p className="muted">No models discovered yet.</p>
          ) : null}
          {!selectedModel ? (
            <p className="muted">No model selected.</p>
          ) : (
            <>
              <div className="details-grid">
                <div className="detail-row">
                  <span>Provider</span>
                  <strong>{providerLabel}</strong>
                </div>
                <div className="detail-row">
                  <span>Quantized provider</span>
                  <strong>{selectedRecord?.identity.quantized_provider ?? selectedInferred?.quantizedProvider ?? 'N/A'}</strong>
                </div>
                <div className="detail-row">
                  <span>Format</span>
                  <strong>{selectedRecord?.architecture.format ?? selectedInferred?.format ?? 'N/A'}</strong>
                </div>
                <div className="detail-row">
                  <span>Display name</span>
                  <strong>{selectedModel.display_name}</strong>
                </div>
                <div className="detail-row">
                  <span>Model ID</span>
                  <strong>{selectedModel.model_id}</strong>
                </div>
                <div className="detail-row">
                  <span>Context window</span>
                  <strong>{contextLabel}</strong>
                </div>
                <div className="detail-row">
                  <span>Quantisation</span>
                  <strong>
                    {quantisationLines ? (
                      quantisationLines.map((line) => (
                        <span key={line} className="detail-stack">
                          {line}
                        </span>
                      ))
                    ) : (
                      quantisationLabel
                    )}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Capabilities</span>
                  <strong>
                    {capabilityGenerationLabel ? (
                      capabilityGenerationLabel.map((line) => (
                        <span key={line} className="detail-stack">
                          {line}
                        </span>
                      ))
                    ) : (
                      'N/A'
                    )}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Use cases</span>
                  <strong>
                    {capabilityUseCaseLabel ? (
                      capabilityUseCaseLabel.map((line) => (
                        <span key={line} className="detail-stack">
                          {line}
                        </span>
                      ))
                    ) : (
                      'N/A'
                    )}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Multimodal</span>
                  <strong>
                    {capabilityMultimodalLabel ? (
                      capabilityMultimodalLabel.map((line) => (
                        <span key={line} className="detail-stack">
                          {line}
                        </span>
                      ))
                    ) : (
                      'N/A'
                    )}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Reasoning</span>
                  <strong>
                    {capabilityReasoningLabel ? (
                      capabilityReasoningLabel.map((line) => (
                        <span key={line} className="detail-stack">
                          {line}
                        </span>
                      ))
                    ) : (
                      'N/A'
                    )}
                  </strong>
                </div>
                <div className="divider details-span" />
                <div className="detail-row">
                  <span>Servers</span>
                  <span className="muted">{selectedModel.servers.length}</span>
                </div>
                <div className="models-server-list details-span">
                  {selectedModel.servers.map((server) => (
                    <div key={server.server_id} className="models-server-card">
                      <strong>{server.display_name}</strong>
                      <div className="muted">{server.base_url}</div>
                      <div className="meta">Schemas: {server.schema_families.join(', ')}</div>
                    </div>
                  ))}
                </div>
                <div className="divider details-span" />
                {!canUpdate ? (
                  <p className="muted details-span">
                    Select a specific inference server to update model details.
                  </p>
                ) : null}
                <div className="actions details-span">
                  {onModelSelect && canUpdate ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedModel && effectiveServerId !== 'all') {
                          onModelSelect(effectiveServerId, selectedModel.model_id);
                        }
                      }}
                    >
                      View details
                    </button>
                  ) : null}
                  <button type="button" onClick={openUpdateModal} disabled={!canUpdate}>
                    Update
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {showUpdateModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card model-update-form">
            <div className="modal-header">
              <h3>Update model</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowUpdateModal(false)}
                aria-label="Close"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>
            {updateError ? <div className="error">{updateError}</div> : null}
            <div className="field">
              <label htmlFor="update-provider">Provider</label>
              <select
                id="update-provider"
                value={updateForm.provider}
                onChange={(event) =>
                  setUpdateForm((current) => ({
                    ...current,
                    provider: event.target.value as ModelProvider
                  }))
                }
              >
                {[
                  'openai',
                  'meta',
                  'mistral',
                  'qwen',
                  'google',
                  'moonshot',
                  'cohere',
                  'deepseek',
                  'anthropic',
                  'nvidia',
                  'zai',
                  'custom',
                  'unknown'
                ].map((provider) => (
                  <option key={provider} value={provider}>
                    {formatProviderLabel(provider as ModelProvider)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="update-quantized-provider">Quantized provider</label>
              <input
                id="update-quantized-provider"
                value={updateForm.quantizedProvider}
                onChange={(event) =>
                  setUpdateForm((current) => ({ ...current, quantizedProvider: event.target.value }))
                }
                placeholder="lmstudio-community"
              />
            </div>
            <div className="field">
              <label htmlFor="update-format">Format</label>
              <select
                id="update-format"
                value={updateForm.format}
                onChange={(event) =>
                  setUpdateForm((current) => ({ ...current, format: event.target.value as ModelFormat | '' }))
                }
              >
                <option value="">Not set</option>
                {(['MLX', 'GGUF', 'GPTQ', 'AWQ', 'SafeTensors'] as ModelFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Use case capabilities</label>
              <div className="checkbox-grid">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="update-cap-thinking"
                    checked={updateForm.capThinking}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capThinking: event.target.checked }))
                    }
                  />
                  Thinking
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="update-cap-coding"
                    checked={updateForm.capCoding}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capCoding: event.target.checked }))
                    }
                  />
                  Coding
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="update-cap-instruct"
                    checked={updateForm.capInstruct}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capInstruct: event.target.checked }))
                    }
                  />
                  Instruct
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="update-cap-moe"
                    checked={updateForm.capMoe}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capMoe: event.target.checked }))
                    }
                  />
                  Mixture of experts
                </label>
              </div>
            </div>
            <div className="field">
              <label>Quantisation</label>
              <div className="quantisation-grid">
                <div className="field quant-method">
                  <label htmlFor="update-quant-method">Method</label>
                  <select
                    id="update-quant-method"
                    value={updateForm.quantMethod}
                    onChange={(event) =>
                      setUpdateForm((current) => ({
                        ...current,
                        quantMethod: event.target.value as ModelQuantisationMethod
                      }))
                    }
                  >
                    {['gguf', 'gptq', 'awq', 'mlx', 'none', 'unknown'].map((method) => (
                      <option key={method} value={method}>
                        {method.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field compact quant-bits">
                  <label htmlFor="update-quant-bits">Bits</label>
                  <input
                    id="update-quant-bits"
                    type="number"
                    min="0"
                    value={updateForm.quantBits}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, quantBits: event.target.value }))
                    }
                  />
                </div>
                <div className="field quant-scheme">
                  <label htmlFor="update-quant-scheme">Scheme</label>
                  <select
                    id="update-quant-scheme"
                    value={updateForm.quantScheme}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, quantScheme: event.target.value }))
                    }
                  >
                    {['unknown', 'k-quant', 'legacy', 'tensorwise'].map((scheme) => (
                      <option key={scheme} value={scheme}>
                        {scheme}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field quant-variant">
                  <label htmlFor="update-quant-variant">Variant</label>
                  <select
                    id="update-quant-variant"
                    value={updateForm.quantVariant}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, quantVariant: event.target.value }))
                    }
                  >
                    <option value="">Not set</option>
                    {['S', 'M', 'L'].map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field compact quant-group">
                  <label htmlFor="update-quant-group">Group</label>
                  <input
                    id="update-quant-group"
                    type="number"
                    min="0"
                    value={updateForm.quantGroupSize}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, quantGroupSize: event.target.value }))
                    }
                  />
                </div>
                <div className="field quant-weight">
                  <label htmlFor="update-quant-weight">Weight format</label>
                  <input
                    id="update-quant-weight"
                    value={updateForm.quantWeightFormat}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, quantWeightFormat: event.target.value }))
                    }
                    placeholder="Q4_K_M"
                  />
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="update-context-window">Context window (tokens)</label>
              <input
                id="update-context-window"
                type="number"
                min="0"
                value={updateForm.contextWindow}
                onChange={(event) =>
                  setUpdateForm((current) => ({ ...current, contextWindow: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Generation capabilities</label>
              <div className="checkbox-grid">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capText}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capText: event.target.checked }))
                    }
                  />
                  Text
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capJson}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capJson: event.target.checked }))
                    }
                  />
                  JSON schema output
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capTools}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capTools: event.target.checked }))
                    }
                  />
                  Tools
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capEmbeddings}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capEmbeddings: event.target.checked }))
                    }
                  />
                  Embeddings
                </label>
              </div>
            </div>
            <div className="field">
              <label>Multimodal capabilities</label>
              <div className="checkbox-grid">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capVision}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capVision: event.target.checked }))
                    }
                  />
                  Vision
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capAudio}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capAudio: event.target.checked }))
                    }
                  />
                  Audio
                </label>
              </div>
            </div>
            <div className="field">
              <label>Reasoning capabilities</label>
              <div className="checkbox-grid">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capReasoning}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capReasoning: event.target.checked }))
                    }
                  />
                  Supported
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={updateForm.capExplicit}
                    onChange={(event) =>
                      setUpdateForm((current) => ({ ...current, capExplicit: event.target.checked }))
                    }
                  />
                  Explicit tokens
                </label>
              </div>
            </div>
            <div className="actions">
              <button type="button" onClick={handleUpdateModel} disabled={updateBusy}>
                {updateBusy ? 'Updating…' : 'Update model'}
              </button>
              <button type="button" onClick={() => setShowUpdateModal(false)} disabled={updateBusy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
