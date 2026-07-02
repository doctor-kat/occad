import { cloneElement, isValidElement } from 'react';
import { Button, Box, useMantineTheme } from '@mantine/core';
import { Operation } from '@/cad/types';

/** Icon size for the large (72×72) operation button — larger than the 16px
 *  used by the compact/icon-only variants to fill the roomier button. */
const LARGE_ICON_SIZE = 32;

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
  /** Override the corner radius (e.g. 0 when nested inside a button group). */
  radius?: number | string;
  'data-testid'?: string;
}

export function OperationButton({ icon, label, isActive, onClick, disabled = false, radius, 'data-testid': dataTestId }: OperationButtonProps) {
  const theme = useMantineTheme();

  // Enlarge the icon only for this large variant; the shared icon node from
  // OperationData ships at size 16 for the compact/icon-only buttons.
  const sizedIcon = isValidElement<{ size?: number }>(icon)
    ? cloneElement(icon, { size: LARGE_ICON_SIZE })
    : icon;

  return (
    <Button
      variant={isActive ? 'light' : 'subtle'}
      size="xs"
      radius={radius}
      disabled={disabled}
      onClick={onClick}
      data-testid={dataTestId}
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
        <Box style={{ lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sizedIcon}
        </Box>
        <Box component="span" style={{ fontSize: 10, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
          {label}
        </Box>
      </Box>
    </Button>
  );
}
