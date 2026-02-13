// opencascade.js@beta ships its own types, but the WASM URL import
// and default export may need augmentation depending on bundler config.

declare module "opencascade.js" {
  /**
   * Initialises the OpenCascade WASM module and returns the OC runtime object.
   * All OCC classes are accessible as properties on the returned object.
   */
  function initOpenCascade(options?: {
    mainJS?: string;
    mainWasm?: string;
    worker?: string;
    libs?: any[];
  }): Promise<any>;

  export default initOpenCascade;
}
