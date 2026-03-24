export enum WorkerResponseType {
  READY = 'ready',
  PROGRESS = 'progress',
  ERROR = 'error',
  SKETCH_BUILT = 'sketchBuilt',
  FEATURE_BUILT = 'featureBuilt',
  REBUILD_COMPLETE = 'rebuildComplete',
  FACE_GEOMETRY = 'faceGeometry',
  SKETCH_SOLVED = 'sketchSolved', // Added for solved sketch response
}