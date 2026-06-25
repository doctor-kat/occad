import { Button, Box, Tooltip, useMantineTheme } from '@mantine/core';
import { Operation } from '@/cad/types';

const iconButtonInternalStyles = {
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

export interface IconOperationButtonProps {
  icon: React.ReactNode;
  label: string;
  operationId: Operation;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Override the corner radius (e.g. 0 when nested inside a button group). */
  radius?: number | string;
}

export function IconOperationButton({ icon, label, isActive, onClick, disabled = false, radius }: IconOperationButtonProps) {
  const theme = useMantineTheme();

  return (
    <Tooltip label={label} disabled={disabled} openDelay={400} withinPortal>
      <Button
        variant={isActive ? 'light' : 'subtle'}
        size="xs"
        radius={radius}
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        style={{
          height: 34,
          width: 34,
          minWidth: 34,
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
          ...iconButtonInternalStyles,
        }}
      >
        <Box
          style={{
            fontSize: 16,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
          }}
        >
          {icon}
        </Box>
      </Button>
    </Tooltip>
  );
}
