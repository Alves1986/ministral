/**
 * evolutionClient.ts — Helper local para comunicação com a Evolution API.
 */

export async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  text: string,
  options: {
    timeout?: number;
    retries?: number;
    delayMs?: number;
    presence?: "composing" | "recording" | "paused";
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const {
    timeout = 8000,
    retries = 2,
    delayMs = 1200,
    presence = "composing",
  } = options;

  const cleanApiUrl = apiUrl.trim().replace(/\/+$/, "");
  const cleanInstance = instanceName ? instanceName.trim().replace(/^\/+|\/+$/g, "") : "";
  if (!cleanInstance) {
    return { success: false, error: "Instance name is empty or invalid" };
  }
  const endpoint = `${cleanApiUrl}/message/sendText/${cleanInstance}`;
  let lastError = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: phone,
          options: { delay: delayMs, presence },
          text,
        }),
        timeout,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = `Evolution API ${response.status}: ${body}`;
        if (attempt < retries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return { success: false, error: lastError };
      }

      return { success: true };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
    }
  }

  return { success: false, error: lastError };
}

export async function fetchWithTimeout(
  resource: string,
  options: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
