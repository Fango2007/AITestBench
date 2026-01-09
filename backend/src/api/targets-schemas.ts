export const targetCreateSchema = {
  body: {
    type: 'object',
    required: ['name', 'base_url'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1 },
      base_url: { type: 'string', minLength: 1 },
      auth_type: { type: ['string', 'null'] },
      provider: { type: 'string', enum: ['openai', 'ollama', 'auto'] },
      auth_token_ref: { type: ['string', 'null'] },
      default_model: { type: ['string', 'null'] },
      default_params: { type: ['object', 'null'] },
      timeouts: { type: ['object', 'null'] },
      concurrency_limit: { type: ['number', 'null'] }
    }
  }
};

export const targetUpdateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1 },
      base_url: { type: 'string', minLength: 1 },
      auth_type: { type: ['string', 'null'] },
      provider: { type: 'string', enum: ['openai', 'ollama', 'auto'] },
      auth_token_ref: { type: ['string', 'null'] },
      default_model: { type: ['string', 'null'] },
      default_params: { type: ['object', 'null'] },
      timeouts: { type: ['object', 'null'] },
      concurrency_limit: { type: ['number', 'null'] }
    }
  }
};
