interface InferenceServerErrorsProps {
  message: string | null;
}

export function InferenceServerErrors({ message }: InferenceServerErrorsProps) {
  if (!message) {
    return null;
  }
  let copy = message;
  if (message.includes('Invalid base URL')) {
    copy = 'Base URL must be a valid http(s) URL.';
  }
  if (message.includes('display_name')) {
    copy = 'Display name is required.';
  }
  return <p className="error">{copy}</p>;
}
