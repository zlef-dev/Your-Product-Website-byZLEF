/** Builds a mailto: URL with every part URL-encoded. */
export function mailtoUrl(to: string | null, subject: string, body: string): string {
  const recipient = to ? encodeURIComponent(to).replace(/%40/g, '@') : '';
  // RFC 6068 asks for CRLF line breaks in the body.
  const crlf = body.replace(/\r?\n/g, '\r\n');
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf)}`;
}
