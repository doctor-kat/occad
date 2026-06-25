import { useState } from 'react';
import { Box, Button, Divider, Menu, useMantineTheme } from '@mantine/core';
import { CaretDown, Check } from '@phosphor-icons/react';
import { Operation } from '@/cad/types';
import { OperationButton } from './OperationButton';
import { CompactOperationButton } from './CompactOperationButton';
import { IconOperationButton } from './IconOperationButton';

export type OperationButtonVariant = 'full' | 'compact' | 'icon';

export interface OperationGroupOption {
  id: Operation;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

export interface OperationGroupButtonProps {
  options: OperationGroupOption[];
  variant?: OperationButtonVariant;
  activeOperation: Operation;
  onOperationSelect: (operation: Operation) => void;
  /** Which option is shown by default. Falls back to the first option. */
  defaultOptionId?: Operation;
}

/**
 * A "split button": the main body behaves like a normal operation button for the
 * currently-shown option, and an attached caret segment (a button-group cell with
 * its own divider + padding) opens a dropdown of the other options in the group.
 * Picking an option from the dropdown both changes the shown option and activates it.
 *
 * For the big `full` variant the caret segment sits along the bottom; for the short
 * `compact` / `icon` variants it sits along the right edge.
 */
export function OperationGroupButton({
  options,
  variant = 'compact',
  activeOperation,
  onOperationSelect,
  defaultOptionId,
}: OperationGroupButtonProps) {
  const theme = useMantineTheme();
  const [selectedId, setSelectedId] = useState<Operation>(
    defaultOptionId ?? options[0]?.id ?? null,
  );

  const current = options.find((o) => o.id === selectedId) ?? options[0];
  if (!current) return null;

  const handleSelect = (option: OperationGroupOption) => {
    if (option.disabled) return;
    setSelectedId(option.id);
    onOperationSelect(option.id);
  };

  const isActive = activeOperation === current.id;
  const isFull = variant === 'full';

  // radius 0 so the main button sits flush against the divider; the outlined,
  // overflow-hidden container clips the outer corners back to rounded.
  const mainButton =
    variant === 'full' ? (
      <OperationButton
        icon={current.icon}
        label={current.label}
        operationId={current.id}
        isActive={isActive}
        onClick={() => onOperationSelect(current.id)}
        disabled={current.disabled}
        radius={0}
      />
    ) : variant === 'icon' ? (
      <IconOperationButton
        icon={current.icon}
        label={current.label}
        operationId={current.id}
        isActive={isActive}
        onClick={() => onOperationSelect(current.id)}
        disabled={current.disabled}
        radius={0}
      />
    ) : (
      <CompactOperationButton
        icon={current.icon}
        label={current.label}
        operationId={current.id}
        isActive={isActive}
        onClick={() => onOperationSelect(current.id)}
        disabled={current.disabled}
        radius={0}
      />
    );

  return (
    <Box
      style={{
        display: 'inline-flex',
        flexDirection: isFull ? 'column' : 'row',
        alignItems: 'stretch',
        border: `1px solid ${theme.other.colors.border}`,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
      }}
    >
      {mainButton}
      <Divider orientation={isFull ? 'horizontal' : 'vertical'} color={theme.other.colors.border} />
      <Menu position={isFull ? 'bottom' : 'bottom-end'} withinPortal shadow="md" width={170}>
        <Menu.Target>
          <Button
            variant="subtle"
            color="gray"
            aria-label={`${current.label} options`}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: isFull ? '3px 0' : '0 6px',
              width: isFull ? '100%' : 24,
              height: isFull ? 18 : 'auto',
              minWidth: 0,
              borderRadius: 0,
              color: theme.colors.gray[5],
            }}
            styles={{ label: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
          >
            <CaretDown size={11} weight="bold" />
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {options.map((option) => (
            <Menu.Item
              key={option.id}
              disabled={option.disabled}
              leftSection={option.icon}
              rightSection={option.id === current.id ? <Check size={14} weight="bold" /> : null}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}
