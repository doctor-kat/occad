import { useState } from 'react';
import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { refLabel, SubShapeKind, type StableRef } from '@/cad/types';

interface SelectorRuleInputProps {
  kind: SubShapeKind;
  presets: { label: string; selector: string }[];
  onResolveSelector?: (kind: SubShapeKind, selector: string) => Promise<StableRef[]>;
  selected: string[];
  setSelected: (updater: (prev: string[]) => string[]) => void;
  /** The rule persisted on the feature (Phase 4: re-evaluated live every rebuild). */
  liveSelector: string | undefined;
  setLiveSelector: (selector: string | undefined) => void;
}

/**
 * Selector-rule input + preset chips, shared by fillet/chamfer (edges) and
 * shell (faces). Typing a rule and pressing Enter (or a preset chip) fills
 * the manual selection with the matched sub-shapes (ROADMAP §9.1 Phase 3/4).
 */
export function SelectorRuleInput({
  kind, presets, onResolveSelector, selected, setSelected, liveSelector, setLiveSelector,
}: SelectorRuleInputProps) {
  const [selectorText, setSelectorText] = useState(liveSelector ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'matched' | 'no-match' | 'error'>('idle');
  const [keepLive, setKeepLive] = useState(!!liveSelector);

  if (!onResolveSelector) return null;

  const applySelector = async (selector: string) => {
    if (!selector.trim()) return;
    setStatus('loading');
    try {
      const refs = await onResolveSelector(kind, selector);
      if (refs.length === 0) {
        setStatus('no-match');
        return;
      }
      const labels = refs.map(refLabel);
      setSelected((prev) => Array.from(new Set([...prev, ...labels])));
      setStatus('matched');
      if (keepLive) setLiveSelector(selector);
    } catch {
      setStatus('error');
    }
  };

  return (
    <Stack gap={4}>
      <TextInput
        label="Select by rule"
        placeholder={kind === SubShapeKind.Edge ? 'e.g. |Z (all vertical edges)' : 'e.g. >Z (top face)'}
        value={selectorText}
        onChange={(e) => { setSelectorText(e.currentTarget.value); setStatus('idle'); }}
        onKeyDown={(e) => { if (e.key === 'Enter') applySelector(selectorText); }}
        size="sm"
      />
      <Checkbox
        size="xs"
        label="Keep this rule live (re-applies on every rebuild)"
        checked={keepLive}
        onChange={(e) => {
          const checked = e.currentTarget.checked;
          setKeepLive(checked);
          setLiveSelector(checked ? selectorText || liveSelector : undefined);
        }}
      />
      <Group gap={4}>
        {presets.map((p) => (
          <Button
            key={p.selector}
            size="compact-xs"
            variant="light"
            onClick={() => { setSelectorText(p.selector); applySelector(p.selector); }}
          >
            {p.label}
          </Button>
        ))}
      </Group>
      {status === 'loading' && <Text size="xs" c="dimmed">Resolving…</Text>}
      {status === 'matched' && <Text size="xs" c="green">Matched — added to selection below.</Text>}
      {status === 'no-match' && <Text size="xs" c="yellow">No sub-shapes matched that rule.</Text>}
      {status === 'error' && <Text size="xs" c="red">Couldn't resolve that rule.</Text>}
    </Stack>
  );
}
