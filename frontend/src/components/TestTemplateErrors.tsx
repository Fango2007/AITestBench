interface TestTemplateErrorsProps {
  message: string | null;
}

export function TestTemplateErrors({ message }: TestTemplateErrorsProps) {
  if (!message) {
    return null;
  }
  let copy = message;
  if (message.includes('Template name already exists')) {
    copy = 'That template name is already in use. Choose a unique name.';
  }
  if (message.includes('Invalid template format')) {
    copy = 'Choose a valid template format.';
  }
  if (message.includes('Invalid template') || message.includes('Python template content is empty')) {
    copy = 'Template content is invalid. Check the format and try again.';
  }
  return <p className="error">{copy}</p>;
}
