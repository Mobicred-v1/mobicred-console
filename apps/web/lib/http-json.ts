/** Bounded JSON reader usable in both browser and server code; no Node dependencies. */
export async function readHttpJson(response: Response, limit: number): Promise<unknown> {
  if (!Number.isSafeInteger(limit) || limit < 1 || !response.body) throw new Error('Missing JSON response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0; let text = '';
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) throw new Error('Response too large');
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
}
