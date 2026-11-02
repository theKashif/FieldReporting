import {API_BASE_URL} from '../config/api';

export type ChaosMode =
  | 'none'
  | 'error'
  | 'delay'
  | 'drop'
  | 'rate_limit';

export interface ChaosConfig {
  mode: ChaosMode;
  status: number;
  delayMs: number;
  message: string;
}

const API_CHAOS_URL = `${API_BASE_URL}/api/chaos`;

export async function fetchChaosConfig(): Promise<ChaosConfig> {
  const response = await fetch(API_CHAOS_URL, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chaos config (${response.status}).`);
  }

  const data = (await response.json()) as { chaos: ChaosConfig };
  return data.chaos;
}

export async function setChaosMode(
  mode: ChaosMode,
  options?: Partial<ChaosConfig>,
): Promise<ChaosConfig> {
  const response = await fetch(API_CHAOS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to set chaos mode (${response.status}).`);
  }

  const data = (await response.json()) as { chaos: ChaosConfig };
  return data.chaos;
}

export async function resetChaosMode(): Promise<ChaosConfig> {
  const response = await fetch(`${API_CHAOS_URL}/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to reset chaos mode (${response.status}).`);
  }

  const data = (await response.json()) as { chaos: ChaosConfig };
  return data.chaos;
}
