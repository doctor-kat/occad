import 'opencascade.js';

declare module "opencascade.js" {
  // By importing 'opencascade.js' above, this becomes a module augmentation
  // instead of an ambient module declaration that shadows the original.
  // The original types from node_modules/opencascade.js/dist/index.d.ts
  // (which include OpenCascadeInstance and TopoDS_Shape) are now preserved.

  /**
   * The default export is the initialization function.
   * We augment it here to ensure the return type is correctly recognized.
   */
  export default function initOpenCascade(options?: {
    mainJS?: any;
    mainWasm?: string;
    worker?: string;
    libs?: string[];
    module?: any;
  }): Promise<import("opencascade.js/dist/opencascade.full").OpenCascadeInstance>;
}

/**
 * Support for Vite's ?url imports for the WASM binary.
 * This is useful for passing the WASM URL to initOpenCascade.
 */
declare module "*.wasm?url" {
  const content: string;
  export default content;
}

declare module "opencascade.js/dist/opencascade.wasm?url" {
  const content: string;
  export default content;
}

declare module "opencascade.js/dist/opencascade.wasm" {
  const content: string;
  export default content;
}
