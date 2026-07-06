import { Box, Group, Divider, Button, Text, useMantineTheme } from '@mantine/core';
import { MeasureIcon } from '@/frontend/shared/icons';
import type { MeasurementData, MeasureBetweenData, MeasureSelection } from '@/cad/types';

interface MeasurePanelProps {
  /** Latest measurement of the current body, or null if none has been computed. */
  measurement: MeasurementData | null;
  /** True while a body exists to measure; when false we prompt to build one. */
  hasBody: boolean;
  /** Sub-shapes picked so far for a distance/angle measurement (0–2). */
  picks: MeasureSelection[];
  /** Distance/angle result once two sub-shapes are picked, else null. */
  between: MeasureBetweenData | null;
  /** Clear the current two-slot pick set. */
  onClearPicks: () => void;
}

/** Format a volume (mm³) with a sensible precision and thousands separators. */
function formatVolume(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm³`;
}

/** Round to 2 decimals with thousands separators. */
function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Format the bounding box as `X mm × Y mm × Z mm`. */
function formatBoundingBox(size: MeasurementData['boundingBox']['size']): string {
  return `${fmt(size.x)} mm × ${fmt(size.y)} mm × ${fmt(size.z)} mm`;
}

/** Human label for a picked sub-shape, e.g. `Face 3`. */
function pickLabel(p: MeasureSelection): string {
  const kind = p.kind.charAt(0).toUpperCase() + p.kind.slice(1);
  return `${kind} ${p.index + 1}`;
}

/**
 * Measurement / Analysis readout (ROADMAP §4). Two rows:
 *   Measure · [Volume: …] [Bounding Box: X × Y × Z]
 *   Between · picked entities · [Distance: …] [Angle: …]
 */
export function MeasurePanel({ measurement, hasBody, picks, between, onClearPicks }: MeasurePanelProps) {
  const theme = useMantineTheme();
  const muted = theme.other.colors.mutedForeground;

  return (
    <Box p={12}>
      <Group gap={10} wrap="wrap" align="center">
        <Group gap={6} wrap="nowrap">
          <MeasureIcon size={16} />
          <Text fw={600} fz={13}>Measure</Text>
        </Group>

        <Divider orientation="vertical" />

        {!hasBody ? (
          <Text fz={12} c={muted}>
            Build a feature to measure it.
          </Text>
        ) : !measurement ? (
          <Text fz={12} c={muted}>
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

      {hasBody && (
        <>
          <Divider my={10} />
          <Group gap={10} wrap="wrap" align="center">
            <Text fw={600} fz={13}>Between</Text>
            <Divider orientation="vertical" />

            {picks.length === 0 ? (
              <Text fz={12} c={muted}>
                Click two faces, edges, or vertices in the viewport.
              </Text>
            ) : (
              <>
                {picks.map((p, i) => (
                  <Button key={i} size="compact-xs" variant="default" radius="sm" style={{ cursor: 'default' }}>
                    {pickLabel(p)}
                  </Button>
                ))}
                {picks.length === 1 && (
                  <Text fz={12} c={muted}>Pick one more…</Text>
                )}
                {between && (
                  <>
                    <Button size="compact-xs" variant="light" radius="sm" style={{ cursor: 'default' }}>
                      Distance: {fmt(between.distance)} mm
                    </Button>
                    {between.angle !== undefined && (
                      <Button size="compact-xs" variant="light" radius="sm" style={{ cursor: 'default' }}>
                        Angle: {fmt(between.angle)}°
                      </Button>
                    )}
                  </>
                )}
                <Button size="compact-xs" variant="subtle" radius="sm" onClick={onClearPicks}>
                  Clear
                </Button>
              </>
            )}
          </Group>
        </>
      )}
    </Box>
  );
}
