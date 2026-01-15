const rfc3339 = { type: 'string' };

const identitySchema = {
  type: 'object',
  properties: {
    provider: { type: 'string', enum: ['openai', 'meta', 'mistral', 'qwen', 'google', 'custom', 'unknown'] },
    family: { type: ['string', 'null'] },
    version: { type: ['string', 'null'] },
    revision: { type: ['string', 'null'] },
    checksum: { type: ['string', 'null'] }
  }
};

const architectureSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['decoder-only', 'encoder-decoder', 'other', 'unknown'] },
    parameter_count: { type: ['number', 'null'] },
    precision: { type: 'string', enum: ['fp32', 'fp16', 'bf16', 'int8', 'int4', 'mixed', 'unknown'] },
    quantisation: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['gguf', 'gptq', 'awq', 'mlx', 'none', 'unknown'] },
        bits: { type: ['number', 'null'] },
        group_size: { type: ['number', 'null'] }
      }
    }
  }
};

const modalitiesSchema = {
  type: 'object',
  properties: {
    input: {
      type: 'array',
      items: { type: 'string' }
    },
    output: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

const capabilitiesSchema = {
  type: 'object',
  properties: {
    generation: {
      type: 'object',
      properties: {
        text: { type: 'boolean' },
        json_schema_output: { type: 'boolean' },
        tools: { type: 'boolean' },
        embeddings: { type: 'boolean' }
      }
    },
    multimodal: {
      type: 'object',
      properties: {
        vision: { type: 'boolean' },
        audio: { type: 'boolean' }
      }
    },
    reasoning: {
      type: 'object',
      properties: {
        supported: { type: 'boolean' },
        explicit_tokens: { type: 'boolean' }
      }
    }
  }
};

const limitsSchema = {
  type: 'object',
  properties: {
    context_window_tokens: { type: ['number', 'null'] },
    max_output_tokens: { type: ['number', 'null'] },
    max_images: { type: ['number', 'null'] },
    max_batch_size: { type: ['number', 'null'] }
  }
};

const performanceSchema = {
  type: 'object',
  properties: {
    theoretical: {
      type: 'object',
      properties: {
        tokens_per_second: { type: ['number', 'null'] }
      }
    },
    observed: {
      type: 'object',
      properties: {
        prefill_tps: { type: ['number', 'null'] },
        generation_tps: { type: ['number', 'null'] },
        latency_ms_p50: { type: ['number', 'null'] },
        latency_ms_p95: { type: ['number', 'null'] },
        measured_at: { type: ['string', 'null'] }
      }
    }
  }
};

const configurationSchema = {
  type: 'object',
  properties: {
    default_parameters: {
      type: 'object',
      properties: {
        temperature: { type: ['number', 'null'] },
        top_p: { type: ['number', 'null'] },
        top_k: { type: ['number', 'null'] },
        presence_penalty: { type: ['number', 'null'] },
        frequency_penalty: { type: ['number', 'null'] },
        seed: { type: ['number', 'null'] }
      }
    },
    context_strategy: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['truncate', 'sliding', 'summarise', 'custom'] },
        window_tokens: { type: ['number', 'null'] }
      }
    }
  }
};

const discoverySchema = {
  type: 'object',
  properties: {
    retrieved_at: rfc3339,
    source: { type: 'string', enum: ['server', 'manual', 'test'] }
  }
};

export const modelCreateSchema = {
  body: {
    type: 'object',
    required: ['model'],
    additionalProperties: false,
    properties: {
      model: {
        type: 'object',
        required: ['model_id', 'server_id'],
        properties: {
          model_id: { type: 'string' },
          server_id: { type: 'string' },
          display_name: { type: 'string' },
          active: { type: 'boolean' },
          archived: { type: 'boolean' },
          archived_at: { type: ['string', 'null'] }
        }
      },
      identity: identitySchema,
      architecture: architectureSchema,
      modalities: modalitiesSchema,
      capabilities: capabilitiesSchema,
      limits: limitsSchema,
      performance: performanceSchema,
      configuration: configurationSchema,
      discovery: discoverySchema,
      raw: { type: 'object' }
    }
  }
};

export const modelUpdateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      model: {
        type: 'object',
        properties: {
          display_name: { type: 'string' },
          active: { type: 'boolean' },
          archived: { type: 'boolean' },
          archived_at: { type: ['string', 'null'] }
        }
      },
      identity: identitySchema,
      architecture: architectureSchema,
      modalities: modalitiesSchema,
      capabilities: capabilitiesSchema,
      limits: limitsSchema,
      performance: performanceSchema,
      configuration: configurationSchema,
      discovery: discoverySchema,
      raw: { type: 'object' }
    }
  }
};
