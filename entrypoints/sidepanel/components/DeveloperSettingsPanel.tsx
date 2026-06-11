import { useEffect, useState } from 'react';
import {
  DEFAULT_DEVELOPER_SETTINGS,
  normalizeDeveloperSettings,
  type DeveloperSettings,
} from '../../../core/developer/settings';
import { useI18n } from '../i18n';

export default function DeveloperSettingsPanel() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<DeveloperSettings>(DEFAULT_DEVELOPER_SETTINGS);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_DEVELOPER_SETTINGS' })
      .then((result) => setSettings(normalizeDeveloperSettings(result)))
      .catch(() => setSettings(DEFAULT_DEVELOPER_SETTINGS));
  }, []);

  const save = async (patch: Partial<DeveloperSettings>) => {
    const next = normalizeDeveloperSettings({ ...settings, ...patch });
    setSettings(next);
    const saved = await chrome.runtime.sendMessage({
      type: 'SAVE_DEVELOPER_SETTINGS',
      payload: next,
    });
    setSettings(normalizeDeveloperSettings(saved));
  };

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-medium" style={{ color: 'var(--ds-text)' }}>
        {t('sidepanel.developerSettings.title')}
      </h2>
      <div className="ds-surface-panel rounded-xl p-4 space-y-3">
        <ToggleRow
          title={t('sidepanel.developerSettings.developerMode')}
          description={t('sidepanel.developerSettings.developerModeDescription')}
          enabled={settings.developerMode}
          onToggle={(enabled) => save({ developerMode: enabled })}
        />
        <ToggleRow
          title={t('sidepanel.developerSettings.apiPlayground')}
          description={t('sidepanel.developerSettings.apiPlaygroundDescription')}
          enabled={settings.apiPlaygroundEnabled}
          disabled={!settings.developerMode}
          onToggle={(enabled) => save({ apiPlaygroundEnabled: enabled })}
        />
        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--ds-text-tertiary)' }}>
          {t('sidepanel.developerSettings.cssPolicy')}
        </div>
      </div>
    </section>
  );
}
function ToggleRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <div>
        <div className="text-xs font-medium" style={{ color: 'var(--ds-text)' }}>{title}</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--ds-text-tertiary)' }}>{description}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className="relative shrink-0 w-10 h-[22px] rounded-full transition-colors duration-200 disabled:opacity-40"
        style={{ background: enabled && !disabled ? 'var(--ds-blue)' : 'var(--ds-border)' }}
      >
        <span
          className="ds-switch-thumb absolute top-[3px] left-[3px] w-4 h-4 rounded-full transition-transform duration-200"
          style={{ transform: enabled && !disabled ? 'translateX(18px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}
