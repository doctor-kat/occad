import { Box, useMantineTheme } from "@mantine/core";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { BoxMode } from "@/cad/sketch/interaction";

/**
 * Rubber-band overlay for sketch box/crossing selection (screen-space px).
 * Solid cyan = window (drag right, fully enclosed); dashed green = crossing
 * (drag left, touching). Non-interactive so it never steals pointer events.
 */
export function SketchSelectionBox() {
  const theme = useMantineTheme();
  const sketchSelectionBox = useViewportStore((state) => state.sketchSelectionBox);

  if (!sketchSelectionBox) return null;

  const isWindow = sketchSelectionBox.mode === BoxMode.Window;

  return (
    <Box
      pos="absolute"
      style={{
        left: sketchSelectionBox.x,
        top: sketchSelectionBox.y,
        width: sketchSelectionBox.w,
        height: sketchSelectionBox.h,
        zIndex: 20,
        pointerEvents: 'none',
        border: isWindow
          ? `1px solid ${theme.colors.cyan[4]}`
          : `1px dashed ${theme.colors.green[4]}`,
        backgroundColor: isWindow
          ? `${theme.colors.cyan[4]}1a`
          : `${theme.colors.green[4]}1a`,
      }}
    />
  );
}
