import { Box } from 'lucide-react';

export function CanvasPlaceholder() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-cad-canvas">
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--cad-grid)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--cad-grid)) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Center origin indicator */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute h-32 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-destructive/60 to-transparent" />
        <div className="absolute h-0.5 w-32 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-success/60 to-transparent" />
        <div className="h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50 ring-2 ring-primary/30" />
      </div>

      {/* Placeholder content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="rounded-xl border border-border/50 bg-card/60 p-10 backdrop-blur-md shadow-2xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/20">
            <Box className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-center text-xl font-bold text-foreground">
            3D Model Viewport
          </h3>
          <p className="mt-3 max-w-sm text-center text-sm text-muted-foreground leading-relaxed">
            This area is reserved for your 3D model implementation.
            Integrate your preferred rendering library here.
          </p>
        </div>
      </div>

      {/* View cube indicator */}
      <div className="absolute right-4 top-4 flex h-16 w-16 items-center justify-center rounded-lg border border-border/50 bg-card/60 backdrop-blur-md shadow-lg">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Front</div>
        </div>
      </div>

      {/* Coordinate display */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 px-4 py-2 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-xs font-mono font-medium text-destructive">X: 0.00</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-xs font-mono font-medium text-success">Y: 0.00</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-mono font-medium text-primary">Z: 0.00</span>
        </div>
      </div>

      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-accent/[0.02]" />
    </div>
  );
}