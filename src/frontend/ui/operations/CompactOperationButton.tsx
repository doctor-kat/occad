import { Button, Box, useMantineTheme } from '@mantine/core';
import { Operation } from '@/cad/types';

const compactButtonInternalStyles = {
  inner: {
    display: 'block !important',
    height: '100%',
    width: '100%',
  },
  label: {
    display: 'block !important',
    height: '100%',
    width: '100%',
  },
};

export interface CompactOperationButtonProps {
  icon: React.ReactNode;
  label: string;
  operationId: Operation;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Override the corner radius (e.g. 0 when nested inside a button group). */
  radius?: number | string;
}

export function CompactOperationButton({ icon, label, isActive, onClick, disabled = false, radius }: CompactOperationButtonProps) {
  const theme = useMantineTheme();

  return (
    <Button
      variant={isActive ? 'light' : 'subtle'}
      size="xs"
      radius={radius}
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 34,
        width: 116,
        minWidth: 116,
        padding: '0 8px',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 200ms',
      }}
      styles={{
        root: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          '--button-bg': isActive ? `${theme.colors.blue[5]}15` : undefined,
          '--button-bd': isActive ? `1px solid ${theme.colors.blue[5]}30` : undefined,
        },
        ...compactButtonInternalStyles,
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '100%',
          width: '100%',
          gap: 8,
        }}
      >
        <Box style={{ fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box component="span" style={{ fontSize: 12, fontWeight: 500, textAlign: 'left', lineHeight: 1.2 }}>
          {label}
        </Box>
      </Box>
    </Button>
  );
}
