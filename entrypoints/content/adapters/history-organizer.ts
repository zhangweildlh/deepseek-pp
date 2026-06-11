export interface HistoryItem {
  sessionId: string;
  title: string;
  element: HTMLElement;
  tags: string[];
}

export interface HistoryOrganizerState {
  schemaVersion: 1;
  tagsBySessionId: Record<string, string[]>;
}

export interface HistoryOrganizerController {
  stop(): void;
  refreshLabels(): void;
}

export interface HistoryOrganizerLabels {
  title: string;
  searchPlaceholder: string;
  tagPlaceholder: string;
  currentTagsPlaceholder: string;
  noHistoryDetected: string;
  visibleStatus: (visibleCount: number, totalCount: number) => string;
  storageError: (action: 'load' | 'save', message: string) => string;
}

const STORAGE_KEY = 'deepseek_pp_history_organizer';
const STYLE_ID = 'dpp-history-organizer-css';
const PANEL_ID = 'dpp-history-organizer';
const HISTORY_LINK_SELECTOR = [
  'a[href*="/chat/s/"]',
  'a[href*="/a/chat/s/"]',
  'a[href*="chat_session_id="]',
].join(',');

export function normalizeHistoryOrganizerState(value: unknown): HistoryOrganizerState {
  const object = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<HistoryOrganizerState>
    : {};
  const tagsBySessionId: Record<string, string[]> = {};
  const rawTags = object.tagsBySessionId && typeof object.tagsBySessionId === 'object' && !Array.isArray(object.tagsBySessionId)
    ? object.tagsBySessionId
    : {};
  for (const [sessionId, tags] of Object.entries(rawTags)) {
    tagsBySessionId[sessionId] = normalizeTags(tags);
  }
  return { schemaVersion: 1, tagsBySessionId };
}

export function extractHistoryItems(root: ParentNode, state: HistoryOrganizerState): HistoryItem[] {
  const seen = new Set<string>();
  const items: HistoryItem[] = [];
  for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>(HISTORY_LINK_SELECTOR))) {
    const sessionId = parseSessionId(anchor.href);
    if (!sessionId || seen.has(sessionId)) continue;
    seen.add(sessionId);
    const element = findHistoryRow(anchor);
    const title = normalizeTitle(element.textContent || anchor.textContent || sessionId);
    items.push({
      sessionId,
      title,
      element,
      tags: state.tagsBySessionId[sessionId] ?? [],
    });
  }
  return items;
}

export function filterHistoryItems(items: readonly HistoryItem[], input: {
  query: string;
  tag: string;
}): { visible: HistoryItem[]; hidden: HistoryItem[] } {
  const query = input.query.trim().toLowerCase();
  const tag = input.tag.trim().toLowerCase();
  const visible: HistoryItem[] = [];
  const hidden: HistoryItem[] = [];
  for (const item of items) {
    const matchesQuery = !query || item.title.toLowerCase().includes(query);
    const matchesTag = !tag || item.tags.some((value) => value.toLowerCase().includes(tag));
    (matchesQuery && matchesTag ? visible : hidden).push(item);
  }
  return { visible, hidden };
}

export function parseSessionId(href: string): string | null {
  try {
    const url = new URL(href, location.href);
    const pathMatch = url.pathname.match(/\/(?:a\/)?chat\/s\/([^/?#]+)/);
    const value = pathMatch?.[1] ?? url.searchParams.get('chat_session_id');
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

export function startDeepSeekHistoryOrganizer(
  getLabels: () => HistoryOrganizerLabels,
): HistoryOrganizerController {
  let stopped = false;
  let state: HistoryOrganizerState = { schemaVersion: 1, tagsBySessionId: {} };
  let query = '';
  let tag = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  injectStyles();
  const panel = ensurePanel();
  const searchInput = panel.querySelector<HTMLInputElement>('[data-dpp-history-search]');
  const tagInput = panel.querySelector<HTMLInputElement>('[data-dpp-history-tag]');
  const currentTagInput = panel.querySelector<HTMLInputElement>('[data-dpp-current-tags]');
  const status = panel.querySelector<HTMLElement>('[data-dpp-history-status]');

  const refreshLabels = () => {
    renderPanelLabels(panel, getLabels());
  };

  const refresh = () => {
    if (stopped) return;
    refreshLabels();
    const items = extractHistoryItems(document, state);
    const { visible, hidden } = filterHistoryItems(items, { query, tag });
    for (const item of visible) {
      item.element.hidden = false;
      item.element.dataset.dppHistoryTags = item.tags.join(', ');
    }
    for (const item of hidden) {
      item.element.hidden = true;
      item.element.dataset.dppHistoryTags = item.tags.join(', ');
    }
    if (status) {
      const labels = getLabels();
      status.textContent = items.length === 0
        ? labels.noHistoryDetected
        : labels.visibleStatus(visible.length, items.length);
    }
    const currentSessionId = getCurrentSessionId();
    if (currentTagInput && currentSessionId && document.activeElement !== currentTagInput) {
      currentTagInput.value = (state.tagsBySessionId[currentSessionId] ?? []).join(', ');
    }
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      refresh();
    }, 200);
  };

  searchInput?.addEventListener('input', () => {
    query = searchInput.value;
    refresh();
  });
  tagInput?.addEventListener('input', () => {
    tag = tagInput.value;
    refresh();
  });
  currentTagInput?.addEventListener('change', () => {
    const sessionId = getCurrentSessionId();
    if (!sessionId) return;
    state = {
      schemaVersion: 1,
      tagsBySessionId: {
        ...state.tagsBySessionId,
        [sessionId]: normalizeTags(currentTagInput.value.split(',')),
      },
    };
    chrome.storage.local.set({ [STORAGE_KEY]: state })
      .then(refresh)
      .catch((error) => {
        reportStorageError(status, 'save', error, getLabels);
      });
  });

  chrome.storage.local.get(STORAGE_KEY)
    .then((data) => {
      state = normalizeHistoryOrganizerState(data[STORAGE_KEY]);
      refresh();
    })
    .catch((error) => {
      reportStorageError(status, 'load', error, getLabels);
      refresh();
    });

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('dpp:navigation', schedule);
  refresh();

  return {
    refreshLabels,
    stop() {
      stopped = true;
      observer.disconnect();
      window.removeEventListener('popstate', schedule);
      window.removeEventListener('hashchange', schedule);
      window.removeEventListener('dpp:navigation', schedule);
      if (timer) clearTimeout(timer);
      panel.remove();
      for (const item of extractHistoryItems(document, state)) {
        item.element.hidden = false;
        delete item.element.dataset.dppHistoryTags;
      }
    },
  };
}

function ensurePanel(): HTMLElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;
  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="dpp-history-organizer-title" data-dpp-history-title></div>
    <input data-dpp-history-search />
    <input data-dpp-history-tag />
    <input data-dpp-current-tags />
    <div data-dpp-history-status class="dpp-history-organizer-status"></div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function renderPanelLabels(panel: HTMLElement, labels: HistoryOrganizerLabels): void {
  const title = panel.querySelector<HTMLElement>('[data-dpp-history-title]');
  const searchInput = panel.querySelector<HTMLInputElement>('[data-dpp-history-search]');
  const tagInput = panel.querySelector<HTMLInputElement>('[data-dpp-history-tag]');
  const currentTagInput = panel.querySelector<HTMLInputElement>('[data-dpp-current-tags]');

  if (title) title.textContent = labels.title;
  if (searchInput) searchInput.placeholder = labels.searchPlaceholder;
  if (tagInput) tagInput.placeholder = labels.tagPlaceholder;
  if (currentTagInput) currentTagInput.placeholder = labels.currentTagsPlaceholder;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 2147483000;
      width: min(260px, calc(100vw - 24px));
      padding: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.96);
      color: #1d1d1f;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    }
    #${PANEL_ID} input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin-top: 6px;
      padding: 6px 8px;
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 6px;
      font: inherit;
    }
    .dpp-history-organizer-title { font-weight: 600; }
    .dpp-history-organizer-status { margin-top: 6px; color: #64748b; font-size: 11px; }
    [data-dpp-history-tags]:not([data-dpp-history-tags=""])::after {
      content: attr(data-dpp-history-tags);
      display: inline-block;
      margin-left: 6px;
      padding: 1px 5px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.1);
      color: #1d4ed8;
      font-size: 10px;
    }
  `;
  document.head.appendChild(style);
}

function findHistoryRow(anchor: HTMLAnchorElement): HTMLElement {
  let el: HTMLElement = anchor;
  let depth = 0;
  while (el.parentElement && depth < 4) {
    const parent: HTMLElement = el.parentElement;
    if (parent.querySelectorAll('a').length === 1 && parent.textContent && parent.textContent.trim().length <= 240) {
      el = parent;
    }
    depth += 1;
  }
  return el;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim() || 'Untitled chat';
}

function reportStorageError(
  status: HTMLElement | null,
  action: 'load' | 'save',
  error: unknown,
  getLabels: () => HistoryOrganizerLabels,
): void {
  const message = error instanceof Error ? error.message : String(error);
  if (status) status.textContent = getLabels().storageError(action, message);
  console.error(`DeepSeek++ failed to ${action} history tags`, error);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12))];
}

function getCurrentSessionId(): string | null {
  return parseSessionId(location.href);
}
