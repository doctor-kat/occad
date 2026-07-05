import { Box, Group, Divider, Button, Text, useMantineTheme } from '@mantine/core';
import { MeasureIcon } from '@/frontend/shared/icons';
import type { MeasurementData } from '@/cad/types';

interface MeasurePanelProps {
  /** Latest measurement of the current body, or null if none has been computed. */
  measurement: MeasurementData | null;
  /** True while a body exists to measure; when false we prompt to build one. */
  hasBody: boolean;
}

/** Format a volume (mm³) with a sensible precision and thousands separators. */
function formatVolume(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm³`;
}

/** Format the bounding box as `X mm × Y mm × Z mm`. */
function formatBoundingBox(size: MeasurementData['boundingBox']['size']): string {
  const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${fmt(size.x)} mm × ${fmt(size.y)} mm × ${fmt(size.z)} mm`;
}

/**
 * Measurement / Analysis readout (ROADMAP §4). Compact row:
 *   Measure · divider · [Volume: …] [Bounding Box: X mm × Y mm × Z mm]
 */
export function MeasurePanel({ measurement, hasBody }: MeasurePanelProps) {
  const theme = useMantineTheme();

  return (
    <Box p={12}>
      <Group gap={10} wrap="wrap" align="center">
        <Group gap={6} wrap="nowrap">
          <MeasureIcon size={16} />
          <Text fw={600} fz={13}>Measure</Text>
        </Group>

        <Divider orientation="vertical" />

        {!hasBody ? (
          <Text fz={12} c={theme.other.colors.mutedForeground}>
            Build a feature to measure it.
          </Text>
        ) : !measurement ? (
          <Text fz={12} c={theme.other.colors.mutedForeground}>
            Measuring…
          </Text>
        ) : (
          <>
            <Button size="compact-xs" variant="light" radius="sm" style={{ cursor: 'default' }}>
              Volume: {formatVolume(measurement.volume)}
            </Button>
            <Button size="compact-xs" variant="light" radius="sm" style={{ cursor: 'default' }}>
              Bounding Box: {formatBoundingBox(measurement.boundingBox.size)}
            </Button>
          </>
        )}
      </Group>
    </Box>
  );
}
