import { Tabs } from '@mantine/core';

export interface CADTabProps {
  value: string;
  label: string;
  isActive: boolean;
  theme: any;
}

export function CADTab({ value, label, isActive, theme }: CADTabProps) {
  return (
    <Tabs.Tab
      value={value}
      style={{
        borderRadius: 0,
        borderBottom: isActive ? `2px solid ${theme.colors.blue[5]}` : '2px solid transparent',
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 8,
        paddingBottom: 8,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: isActive ? theme.colors.blue[5] : theme.other.colors.mutedForeground,
        backgroundColor: isActive ? `${theme.colors.blue[5]}15` : 'transparent',
        transition: 'color 200ms, background-color 200ms',
      }}
    >
      {label}
    </Tabs.Tab>
  );
}
