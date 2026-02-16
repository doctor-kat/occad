import { describe, it, expect } from 'vitest';

describe('sketchBuilders module', () => {
  it('should export sketch builder functions', async () => {
    const module = await import('./sketchBuilders');

    // Verify all builder functions are exported
    expect(module.buildLineEdge).toBeDefined();
    expect(module.buildCircleEdge).toBeDefined();
    expect(module.buildArcEdge).toBeDefined();
    expect(module.buildRectangleWire).toBeDefined();
    expect(module.buildPolygonWire).toBeDefined();
    expect(module.buildEllipseEdge).toBeDefined();
    expect(module.buildSplineEdge).toBeDefined();
    expect(module.buildSketchWire).toBeDefined();
    expect(module.sketchPointTo3D).toBeDefined();
    expect(module.getSketchPlaneNormal).toBeDefined();
  });

  it('should export helper functions', async () => {
    const module = await import('./helpers');

    expect(module.getTransferables).toBeDefined();
    expect(module.findSketchShape).toBeDefined();
    expect(module.ensureFace).toBeDefined();
  });

  it('should export operation handlers', async () => {
    const module = await import('./operations');

    expect(module.handleBuildSketch).toBeDefined();
    expect(module.handleExtrudeSketch).toBeDefined();
    expect(module.handleRevolveSketch).toBeDefined();
    expect(module.handleRebuild).toBeDefined();
    expect(module.handleGetFaceGeometry).toBeDefined();
    expect(module.performBooleanOperation).toBeDefined();
  });
});
