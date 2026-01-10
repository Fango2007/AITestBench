export const testTemplateCreateSchema = {
  body: {
    type: 'object',
    required: ['name', 'format', 'content'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1 },
      format: { type: 'string', enum: ['json', 'python'] },
      content: { type: 'string', minLength: 1 }
    }
  }
};

export const testTemplateUpdateSchema = {
  body: {
    type: 'object',
    required: ['content'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1 },
      content: { type: 'string', minLength: 1 }
    }
  }
};

export const testTemplateInstantiateSchema = {
  body: {
    type: 'object',
    required: ['template_id', 'template_version_id'],
    additionalProperties: false,
    properties: {
      template_id: { type: 'string', minLength: 1 },
      template_version_id: { type: 'string', minLength: 1 }
    }
  }
};
