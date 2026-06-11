import { useEffect, useState } from 'react';
import { dismissWhatsNew, shouldShowWhatsNew, WHATS_NEW_ITEMS } from '../../../core/whats-new';
import { useI18n } from '../i18n';

export default function WhatsNewPanel() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    shouldShowWhatsNew().then(setVisible).catch(() => setVisible(false));
  }, []);

  if (!visible) return null;

  return (
    <section className="ds-surface-panel rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[13px] font-medium" style={{ color: 'var(--ds-text)' }}>
          {t('sidepanel.whatsNew.title')}
        </h2>
        <button
          type="button"
          className="text-[11px] px-2 py-1 rounded-md"
          style={{ color: 'var(--ds-text-tertiary)', background: 'var(--ds-surface)' }}
          onClick={() => {
            setVisible(false);
            void dismissWhatsNew();
          }}
        >
          {t('common.close')}
        </button>
      </div>
      <ul className="space-y-1.5">
        {WHATS_NEW_ITEMS.map((item) => (
          <li key={item.id} className="text-xs leading-relaxed" style={{ color: 'var(--ds-text-secondary)' }}>
            {t(item.titleKey)}
          </li>
        ))}
      </ul>
    </section>
  );
}
