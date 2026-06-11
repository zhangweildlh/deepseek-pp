import { getExtensionVersion } from './version';

export interface WhatsNewItem {
  id: string;
  titleKey: 'sidepanel.whatsNew.projectContext' | 'sidepanel.whatsNew.interactiveTools' | 'sidepanel.whatsNew.productSurfaces';
}
export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  { id: 'project-context', titleKey: 'sidepanel.whatsNew.projectContext' },
  { id: 'interactive-tools', titleKey: 'sidepanel.whatsNew.interactiveTools' },
  { id: 'product-surfaces', titleKey: 'sidepanel.whatsNew.productSurfaces' },
];

const STORAGE_KEY = 'deepseek_pp_whats_new_dismissed_version';

export async function shouldShowWhatsNew(): Promise<boolean> {
  const version = getExtensionVersion();
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  return data[STORAGE_KEY] !== version;
}

export async function dismissWhatsNew(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: getExtensionVersion() });
}
