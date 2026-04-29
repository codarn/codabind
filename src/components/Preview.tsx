interface PreviewProps {
  text: string;
}

export function Preview({ text }: PreviewProps) {
  return (
    <details className="preview">
      <summary>Preview output</summary>
      <pre>{text}</pre>
    </details>
  );
}
