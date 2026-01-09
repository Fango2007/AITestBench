interface TargetErrorsProps {
  message: string | null;
}

export function TargetErrors({ message }: TargetErrorsProps) {
  if (!message) {
    return null;
  }
  let copy = message;
  if (message.includes('Target name already exists')) {
    copy = 'That target name is already in use. Choose a unique name.';
  }
  if (message.includes('Target has existing runs')) {
    copy = 'This target has runs and must be archived instead of deleted.';
  }
  return <p className="error">{copy}</p>;
}
