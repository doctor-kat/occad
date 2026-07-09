import {
  Cube,
  FolderOpen,
  FloppyDisk,
  DownloadSimple,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  FrameCorners,
  GridFour,
  Eye,
  FilePlus,
  GearSix,
  Check
} from '@phosphor-icons/react';
import { Button, Tooltip, Divider, Group, Box, Text, Menu, useMantineTheme } from '@mantine/core';
import { TESSELLATION_PRESETS, TessellationLevel } from '@/cad/types';

interface ToolbarProps {
  projectName: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  tessellationLevel: TessellationLevel;
  onTessellationLevelChange: (level: TessellationLevel) => void;
}

const TESSELLATION_ORDER: TessellationLevel[] = [
  TessellationLevel.Draft,
  TessellationLevel.Standard,
  TessellationLevel.Fine,
  TessellationLevel.Ultra,
];

const iconButtonStyle = {
  height: 32,
  width: 32,
  padding: 0,
};

const fileButtonStyle = {
  height: 32,
  paddingLeft: 12,
  paddingRight: 12,
};

const headerLabelStyle = { label: { fontSize: 12 } };

export function Toolbar({ projectName, onNew, onOpen, onSave, onExport, onUndo, onRedo, canUndo, canRedo, tessellationLevel, onTessellationLevelChange }: ToolbarProps) {
  const theme = useMantineTheme();

  return (
    <Box
      component="header"
      h={56}
      pos="relative"
      bg={theme.other.colors.cadHeader}
      style={{
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Gradient border at bottom */}
      <Box
        pos="absolute"
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: theme.other.gradients.border,
        }}
      />

      {/* Fixed Logo Section */}
      <Box
        px={16}
        bg={theme.other.colors.cadHeader}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <Group gap={10} align="center">
          <Box
            style={{
              display: 'flex',
              height: 32,
              width: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.lg,
              background: theme.other.gradients.background,
              boxShadow: `0 4px 12px ${theme.colors.cyan[5]}33`,
            }}
          >
            <Cube size={18} weight="regular" color="white" />
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column' }}>
            <Text
              variant="gradient"
              size="sm"
              fw={700}
              style={{ letterSpacing: '-0.02em' }}
            >
              OCCAD
            </Text>
            <Text
              size="10px"
              c={theme.other.colors.mutedForeground}
              style={{ lineHeight: 1 }}
            >
              {projectName}
            </Text>
          </Box>
        </Group>
      </Box>

      {/* Scrollable Menu Section */}
      <Box
        className="cad-header-scroll"
        pr={16}
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: `${theme.other.colors.border} transparent`,
        }}
      >
        <Group gap={16} align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Divider orientation="vertical" h={24} />

          {/* File operations */}
          <Group gap={4} align="center" wrap="nowrap">
          <Tooltip label="New Project" position="bottom">
            <Button
              variant="subtle"
              size="sm"
              onClick={onNew}
              leftSection={<FilePlus size={16} weight="regular" />}
              style={{ ...fileButtonStyle, color: theme.other.colors.cadHeaderForeground }}
              styles={headerLabelStyle}
            >
              <Box component="span" hiddenFrom="sm">
                New
              </Box>
            </Button>
          </Tooltip>

          <Tooltip label="Open Project" position="bottom">
            <Button
              variant="subtle"
              size="sm"
              onClick={onOpen}
              leftSection={<FolderOpen size={16} weight="regular" />}
              style={{ ...fileButtonStyle, color: theme.other.colors.cadHeaderForeground }}
              styles={headerLabelStyle}
            >
              <Box component="span" hiddenFrom="sm">
                Open
              </Box>
            </Button>
          </Tooltip>

          <Tooltip label="Save Project" position="bottom">
            <Button
              variant="subtle"
              size="sm"
              onClick={onSave}
              leftSection={<FloppyDisk size={16} weight="regular" />}
              style={{ ...fileButtonStyle, color: theme.other.colors.cadHeaderForeground }}
              styles={headerLabelStyle}
            >
              <Box component="span" hiddenFrom="sm">
                Save
              </Box>
            </Button>
          </Tooltip>

          <Tooltip label="Export as JSON" position="bottom">
            <Button
              variant="subtle"
              size="sm"
              onClick={onExport}
              leftSection={<DownloadSimple size={16} weight="regular" />}
              style={{ ...fileButtonStyle, color: theme.other.colors.cadHeaderForeground }}
              styles={headerLabelStyle}
            >
              <Box component="span" hiddenFrom="sm">
                Export
              </Box>
            </Button>
          </Tooltip>
          </Group>

          <Divider orientation="vertical" h={24} />

          {/* View controls */}
          <Group gap={2} align="center" wrap="nowrap">
          <Tooltip label="Undo" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <ArrowCounterClockwise size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Tooltip label="Redo" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <ArrowClockwise size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Divider orientation="vertical" h={16} mx={4} />

          <Tooltip label="Zoom Out" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <MagnifyingGlassMinus size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Tooltip label="Zoom In" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <MagnifyingGlassPlus size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Tooltip label="Fit to View" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <FrameCorners size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Divider orientation="vertical" h={16} mx={4} />

          <Tooltip label="Toggle Grid" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <GridFour size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Tooltip label="View Options" position="bottom">
            <Button
              variant="subtle"
              size="xs"
              style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
            >
              <Eye size={16} weight="regular" />
            </Button>
          </Tooltip>

          <Divider orientation="vertical" h={16} mx={4} />

          {/* Settings */}
          <Menu position="bottom-end" width={260} withinPortal>
            <Menu.Target>
              <Tooltip label="Settings" position="bottom">
                <Button
                  variant="subtle"
                  size="xs"
                  aria-label="Settings"
                  style={{ ...iconButtonStyle, color: theme.other.colors.cadHeaderForeground }}
                >
                  <GearSix size={16} weight="regular" />
                </Button>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Tessellation quality</Menu.Label>
              <Text size="10px" c={theme.other.colors.mutedForeground} px="sm" pb={4}>
                Faces used to mesh curved surfaces.
              </Text>
              {TESSELLATION_ORDER.map((level) => {
                const preset = TESSELLATION_PRESETS[level];
                const active = level === tessellationLevel;
                return (
                  <Menu.Item
                    key={level}
                    onClick={() => onTessellationLevelChange(level)}
                    leftSection={<Check size={14} weight="bold" style={{ visibility: active ? 'visible' : 'hidden' }} />}
                  >
                    <Text size="sm" fw={active ? 600 : 400}>{preset.label}</Text>
                    <Text size="10px" c={theme.other.colors.mutedForeground}>{preset.description}</Text>
                  </Menu.Item>
                );
              })}
            </Menu.Dropdown>
          </Menu>
          </Group>
        </Group>
      </Box>
    </Box>
  );
}
