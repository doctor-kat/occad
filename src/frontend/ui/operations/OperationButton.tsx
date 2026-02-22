import { Button, Box, useMantineTheme } from '@mantine/core';
import { Operation } from '@/cad/types';

const operationButtonInternalStyles = {
  inner: {
    display: 'block !important',
    height: '100%',
    width: '100%',
  },
  label: {
    display: 'block !important',
    height: '100%',
  },
};

export interface OperationButtonProps {
  icon: React.ReactNode;
  label: string;
  operationId: Operation;
  isActive: boolean;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

export function OperationButton({ icon, label, isActive, onClick, disabled = false }: OperationButtonProps) {
  const theme = useMantineTheme();

  return (
    <Button
      variant={isActive ? 'light' : 'subtle'}
      size="xs"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 72,
        width: 72,
        minWidth: 72,
        padding: 0,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 200ms',
      }}
      styles={{
        root: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '--button-bg': isActive ? `${theme.colors.blue[5]}15` : undefined,
          '--button-bd': isActive ? `1px solid ${theme.colors.blue[5]}30` : undefined,
        },
        ...operationButtonInternalStyles,
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 4,
        }}
      >
        <Box style={{ fontSize: 24, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Box component="span" style={{ fontSize: 10, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
          {label}
        </Box>
      </Box>
    </Button>
  );
}
