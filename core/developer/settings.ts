export interface DeveloperSettings {
  developerMode: boolean;
  apiPlaygroundEnabled: boolean;
}
export const DEFAULT_DEVELOPER_SETTINGS: DeveloperSettings = {
  developerMode: false,
  apiPlaygroundEnabled: false,
};

const STORAGE_KEY = 'deepseek_pp_developer_settings';

export async function getDeveloperSettings(): Promise<DeveloperSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  return normalizeDeveloperSettings(data[STORAGE_KEY]);
}

export async function saveDeveloperSettings(settings: Partial<DeveloperSettings>): Promise<DeveloperSettings> {
  const current = await getDeveloperSettings();
  const normalized = normalizeDeveloperSettings({ ...current, ...settings });
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export function normalizeDeveloperSettings(value: unknown): DeveloperSettings {
  const object = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<DeveloperSettings>
    : {};
  const developerMode = object.developerMode === true;
  return {
    developerMode,
    apiPlaygroundEnabled: developerMode && object.apiPlaygroundEnabled === true,
  };
}
