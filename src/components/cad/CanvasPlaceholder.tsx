import { Box } from 'lucide-react';

export function CanvasPlaceholder() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-cad-canvas">
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--cad-grid)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--cad-grid)) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      
      {/* Center origin indicator */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute h-24 w-px -translate-x-1/2 -translate-y-1/2 bg-destructive/50" />
        <div className="absolute h-px w-24 -translate-x-1/2 -translate-y-1/2 bg-accent/50" />
        <div className="h-2 w-2 rounded-full bg-primary" />
      </div>

      {/* Placeholder content */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-muted-foreground">
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 backdrop-blur-sm">
          <Box className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="text-center text-lg font-medium text-foreground">
            3D Model Viewport
          </h3>
          <p className="mt-2 max-w-xs text-center text-sm">
            This area is reserved for your 3D model implementation.
            Integrate your preferred 3D rendering library here.
          </p>
        </div>
      </div>

      {/* View cube indicator (decorative) */}
      <div className="absolute right-4 top-4 flex h-16 w-16 items-center justify-center rounded border border-border bg-card/80 text-xs text-muted-foreground backdrop-blur-sm">
        <div className="text-center">
          <div className="font-medium">FRONT</div>
        </div>
      </div>

      {/* Coordinate display (decorative) */}
      <div className="absolute bottom-4 left-4 rounded border border-border bg-card/80 px-3 py-1.5 text-xs backdrop-blur-sm">
        <span className="text-destructive">X: 0.00</span>
        <span className="mx-2 text-muted-foreground">|</span>
        <span className="text-accent">Y: 0.00</span>
        <span className="mx-2 text-muted-foreground">|</span>
        <span className="text-primary">Z: 0.00</span>
      </div>
    </div>
  );
}