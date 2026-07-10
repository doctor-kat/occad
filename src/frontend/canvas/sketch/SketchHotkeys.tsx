import { Html } from '@react-three/drei';
import { SketchOperation } from '@/cad/types';

interface SketchHotkeysProps {
  activeOperation: SketchOperation | null;
  currentPointsCount: number;
  snapToGrid: boolean;
  showGrid: boolean;
}

const kbdStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  padding: '2px 8px',
  borderRadius: 5,
  border: '1px solid rgba(255, 255, 255, 0.25)',
  fontSize: '10px',
  fontWeight: 'bold' as const,
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.2)',
  color: '#fff',
};

export function SketchHotkeys({ activeOperation, currentPointsCount, snapToGrid, showGrid }: SketchHotkeysProps) {
  return (
    <Html
      position={[0, 0, 0]}
      // Anchor to the canvas's bottom-right corner regardless of where the
      // sketch-plane origin projects. Returning the canvas size (minus a 20px
      // margin) places drei's transformed wrapper at that corner; the box below
      // is then pulled fully inside via translate(-100%, -100%).
      calculatePosition={(_el, _camera, size) => [size.width - 20, size.height - 20]}
      style={{
        position: 'absolute',
        transform: 'translate(-100%, -100%)',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: '#ffffff',
          padding: '12px 16px',
          borderRadius: 10,
          fontSize: 12,
          fontFamily: 'monospace',
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 8, marginBottom: 4 }}>
            <span style={{ opacity: 0.8, fontWeight: 'bold' }}>Sketcher Hotkeys</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 80 }}>
              <kbd style={kbdStyle}>DEL</kbd>
            </div>
            <span style={{ opacity: 0.7 }}>Delete selected</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 80 }}>
              <kbd style={kbdStyle}>ESC</kbd>
            </div>
            <span style={{ opacity: 0.7 }}>Cancel / Clear</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 80 }}>
              <kbd style={kbdStyle}>G</kbd>
            </div>
            <span style={{ color: snapToGrid ? '#22c55e' : '#94a3b8' }}>Grid Snap: {snapToGrid ? 'ON' : 'OFF'}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 80 }}>
              <kbd style={kbdStyle}>H</kbd>
            </div>
            <span style={{ color: showGrid ? '#22c55e' : '#94a3b8' }}>Show Grid: {showGrid ? 'ON' : 'OFF'}</span>
          </div>

          {activeOperation === SketchOperation.POLYGON && currentPointsCount >= 3 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6, minWidth: 80 }}>
                <kbd style={kbdStyle}>ENTER</kbd>
              </div>
              <span style={{ opacity: 0.7 }}>Complete Polygon</span>
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}
