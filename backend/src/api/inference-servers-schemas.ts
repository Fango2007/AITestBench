const rfc3339 = { type: 'string' };

const runtimeSchema = {
  type: 'object',
  properties: {
    retrieved_at: rfc3339,
    source: { type: 'string', enum: ['server', 'client', 'mixed'] },
    server_software: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: ['string', 'null'] },
        build: { type: ['string', 'null'] }
      }
    },
    api: {
      type: 'object',
      properties: {
        schema_family: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', enum: ['openai-compatible', 'ollama', 'custom'] }
        },
        api_version: { type: ['string', 'null'] }
      }
    },
    platform: {
      type: 'object',
      properties: {
        os: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: ['macos', 'linux', 'windows', 'unknown'] },
            version: { type: ['string', 'null'] },
            arch: { type: 'string', enum: ['arm64', 'x86_64', 'unknown'] }
          }
        },
        container: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['docker', 'podman', 'none', 'unknown'] },
            image: { type: ['string', 'null'] }
          }
        }
      }
    },
    hardware: {
      type: 'object',
      properties: {
        cpu: {
          type: 'object',
          properties: {
            model: { type: ['string', 'null'] },
            cores: { type: ['number', 'null'] }
          }
        },
        gpu: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              vendor: { type: 'string', enum: ['nvidia', 'amd', 'apple', 'intel', 'unknown'] },
              model: { type: ['string', 'null'] },
              vram_mb: { type: ['number', 'null'] }
            }
          }
        },
        ram_mb: { type: ['number', 'null'] }
      }
    }
  }
};

const endpointsSchema = {
  type: 'object',
  properties: {
    base_url: { type: 'string', minLength: 1 },
    health_url: { type: ['string', 'null'] },
    https: { type: 'boolean' }
  }
};

const authSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['none', 'bearer', 'basic', 'oauth', 'custom'] },
    header_name: { type: 'string' },
    token_env: { type: ['string', 'null'] }
  }
};

const capabilitiesSchema = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: {
        streaming: { type: 'boolean' },
        models_endpoint: { type: 'boolean' }
      }
    },
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
        vision: {
          type: 'object',
          properties: {
            input_images: { type: 'boolean' },
            output_images: { type: 'boolean' }
          }
        },
        audio: {
          type: 'object',
          properties: {
            input_audio: { type: 'boolean' },
            output_audio: { type: 'boolean' }
          }
        }
      }
    },
    reasoning: {
      type: 'object',
      properties: {
        exposed: { type: 'boolean' },
        token_budget_configurable: { type: 'boolean' }
      }
    },
    concurrency: {
      type: 'object',
      properties: {
        parallel_requests: { type: 'boolean' },
        parallel_tool_calls: { type: 'boolean' },
        max_concurrent_requests: { type: ['number', 'null'] }
      }
    },
    enforcement: { type: 'string', enum: ['server'] }
  }
};

const discoverySchema = {
  type: 'object',
  properties: {
    retrieved_at: rfc3339,
    ttl_seconds: { type: 'number' },
    model_list: {
      type: 'object',
      properties: {
        raw: { type: 'object' },
        normalised: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model_id: { type: 'string' },
              display_name: { type: ['string', 'null'] },
              context_window_tokens: { type: ['number', 'null'] },
              quantisation: { type: ['string', 'null'] }
            }
          }
        }
      }
    }
  }
};

export const inferenceServerCreateSchema = {
  body: {
    type: 'object',
    required: ['inference_server', 'endpoints', 'runtime'],
    additionalProperties: false,
    properties: {
      inference_server: {
        type: 'object',
        required: ['display_name'],
        properties: {
          server_id: { type: 'string' },
          display_name: { type: 'string', minLength: 1 },
          active: { type: 'boolean' },
          archived: { type: 'boolean' },
          archived_at: { type: ['string', 'null'] }
        }
      },
      runtime: runtimeSchema,
      endpoints: endpointsSchema,
      auth: authSchema,
      capabilities: capabilitiesSchema,
      discovery: discoverySchema,
      raw: { type: 'object' }
    }
  }
};

export const inferenceServerUpdateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      inference_server: {
        type: 'object',
        properties: {
          display_name: { type: 'string', minLength: 1 },
          active: { type: 'boolean' },
          archived: { type: 'boolean' },
          archived_at: { type: ['string', 'null'] }
        }
      },
      runtime: runtimeSchema,
      endpoints: endpointsSchema,
      auth: authSchema,
      capabilities: capabilitiesSchema,
      discovery: discoverySchema,
      raw: { type: 'object' }
    }
  }
};
