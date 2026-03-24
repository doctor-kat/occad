export enum WorkerRequestType {
  INIT = 'init',
  BUILD_SKETCH = 'buildSketch',
  EXTRUDE_SKETCH = 'extrudeSketch',
  REVOLVE_SKETCH = 'revolveSketch',
  DELETE_SHAPE = 'deleteShape',
  REBUILD = 'rebuild',
  GET_FACE_GEOMETRY = 'getFaceGeometry',
  CREATE_PRIMITIVE = 'createPrimitive', // Add new primitive creation type
}