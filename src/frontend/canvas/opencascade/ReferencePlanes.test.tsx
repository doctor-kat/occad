import { isPlaneVisible, buildReferenceVisibilityMap } from './ReferencePlanes';

describe('buildReferenceVisibilityMap', () => {
  it('maps each reference id to its isVisible flag', () => {
    const map = buildReferenceVisibilityMap([
      { id: 'front-plane', isVisible: true },
      { id: 'top-plane', isVisible: false },
      { id: 'right-plane', isVisible: true },
      { id: 'origin', isVisible: false },
    ]);
    expect(map).toEqual({
      'front-plane': true,
      'top-plane': false,
      'right-plane': true,
      origin: false,
    });
  });

  it('treats a missing/undefined isVisible as not visible', () => {
    const map = buildReferenceVisibilityMap([{ id: 'front-plane' } as any]);
    expect(map['front-plane']).toBe(false);
  });

  it('returns an empty map for undefined input', () => {
    expect(buildReferenceVisibilityMap(undefined)).toEqual({});
  });
});

describe('isPlaneVisible', () => {
  const base = { selectedPlaneId: null, hoveredPlaneId: null, visibilityMap: {} };

  it('shows a plane whose visibility is toggled on', () => {
    expect(
      isPlaneVisible('front-plane', { ...base, visibilityMap: { 'front-plane': true } })
    ).toBe(true);
  });

  it('hides a plane whose visibility is toggled off', () => {
    expect(
      isPlaneVisible('front-plane', { ...base, visibilityMap: { 'front-plane': false } })
    ).toBe(false);
  });

  it('hides a plane absent from the visibility map and not selected/hovered', () => {
    expect(isPlaneVisible('top-plane', base)).toBe(false);
  });

  it('shows a selected plane even when not toggled visible', () => {
    expect(isPlaneVisible('right-plane', { ...base, selectedPlaneId: 'right-plane' })).toBe(true);
  });

  it('shows a hovered plane even when not toggled visible', () => {
    expect(isPlaneVisible('right-plane', { ...base, hoveredPlaneId: 'right-plane' })).toBe(true);
  });

  it('does not show other planes when a different plane is selected', () => {
    expect(isPlaneVisible('front-plane', { ...base, selectedPlaneId: 'top-plane' })).toBe(false);
  });

  it('keeps each plane independent in the visibility map', () => {
    const visibilityMap = { 'front-plane': true, 'top-plane': false, 'right-plane': true };
    expect(isPlaneVisible('front-plane', { ...base, visibilityMap })).toBe(true);
    expect(isPlaneVisible('top-plane', { ...base, visibilityMap })).toBe(false);
    expect(isPlaneVisible('right-plane', { ...base, visibilityMap })).toBe(true);
  });
});
