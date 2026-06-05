import { useState } from 'react';
import SkillPage from './SkillPage';
import McpPage from './McpPage';
import ToolsPage from './ToolsPage';

type SubTab = 'skill' | 'mcp' | 'tools';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'skill', label: 'Skill' },
  { key: 'mcp', label: 'MCP' },
  { key: 'tools', label: '工具' },
];

export default function CapabilitiesPage() {
  const [sub, setSub] = useState<SubTab>('skill');

  return (
    <div className="flex flex-col h-full">
      <nav className="sub-tabs" aria-label="能力子导航">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSub(t.key)}
            className={`sub-tab${sub === t.key ? ' sub-tab-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {sub === 'skill' && <SkillPage />}
        {sub === 'mcp' && <McpPage />}
        {sub === 'tools' && <ToolsPage />}
      </div>
    </div>
  );
}
