/** Sends the brief to Web3Forms. Never throws; the caller keeps everything the visitor typed. */
export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

export type SendResult = { ok: true } | { ok: false; reason: 'network' | 'rejected' | 'timeout' };

export async function sendBrief(
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let success = res.ok;
    try {
      const json = (await res.json()) as { success?: boolean };
      if (typeof json.success === 'boolean') success = success && json.success;
    } catch {
      success = false;
    }
    return success ? { ok: true } : { ok: false, reason: 'rejected' };
  } catch (err) {
    return { ok: false, reason: (err as Error)?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
