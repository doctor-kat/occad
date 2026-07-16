import { describe, it, expect } from "vitest";
import { exportShapeToString, importShapeFromString } from "@/cad/solid/io";
import type { WorkerContext } from "@/cad/solid/workerContext";

/**
 * Fake OpenCascade context for exercising import/export control flow without the
 * WASM kernel (loaded only in the browser). As with the other engine tests, real
 * geometric validity is covered by the e2e/browser pass; here we verify each
 * format drives the expected OCCT translator, funnels bytes through `oc.FS`, and
 * propagates failure. ⚠️ This cannot catch a wrong OCC constructor/method name
 * (a runtime-only failure) — confirm real translation in the browser.
 */

const RET_DONE = { done: true };
const RET_FAIL = { fail: true };

/** Minimal in-memory stand-in for the Emscripten FS. */
function makeFS(seed: Record<string, string> = {}) {
  const files: Record<string, string> = { ...seed };
  return {
    files,
    mkdir: (_p: string) => {},
    unlink: (p: string) => { delete files[p]; },
    writeFile: (p: string, data: string) => { files[p] = data; },
    readFile: (p: string, _opts: any) => {
      if (!(p in files)) throw new Error(`ENOENT: ${p}`);
      return files[p];
    },
  };
}

function mockCtx(rec: any = {}, opts: { transferOk?: boolean; writeOk?: boolean; readOk?: boolean; nbShapes?: number } = {}) {
  const { transferOk = true, writeOk = true, readOk = true, nbShapes = 1 } = opts;
  const fs = makeFS(rec.seed);
  rec.fs = fs;

  // Writers stage their output on the FS so readFile can return it.
  const oc: any = {
    FS: fs,
    IFSelect_ReturnStatus: { IFSelect_RetDone: RET_DONE },
    STEPControl_StepModelType: { STEPControl_AsIs: "AsIs" },
    Message_ProgressRange_1: class { delete() {} },

    STEPControl_Writer_1: class {
      Transfer(shape: any, mode: any, _cg: boolean, _p: any) {
        rec.stepTransfer = { shape, mode };
        return transferOk ? RET_DONE : RET_FAIL;
      }
      Write(path: string) { fs.writeFile(path, "STEP-DATA"); return writeOk ? RET_DONE : RET_FAIL; }
      delete() {}
    },
    IGESControl_Writer_1: class {
      AddShape(shape: any, _p: any) { rec.igesShape = shape; return writeOk; }
      ComputeModel() { rec.igesComputed = true; }
      Write_2(path: string, _fnes: boolean) { fs.writeFile(path, "IGES-DATA"); return writeOk; }
      delete() {}
    },
    BRepMesh_IncrementalMesh_2: class {
      constructor(shape: any) { rec.meshed = shape; }
      Perform(_p: any) { rec.meshPerformed = true; }
      delete() {}
    },
    StlAPI_Writer: class {
      Write(shape: any, path: string, _p: any) { rec.stlShape = shape; fs.writeFile(path, "STL-DATA"); return writeOk; }
      delete() {}
    },

    STEPControl_Reader_1: class {
      ReadFile(path: string) { rec.stepReadPath = path; return readOk ? RET_DONE : RET_FAIL; }
      TransferRoots(_p: any) { rec.stepTransferred = true; return nbShapes; }
      NbShapes() { return nbShapes; }
      OneShape() { return { __kind: "SOLID", from: "step" }; }
      delete() {}
    },
    IGESControl_Reader_1: class {
      ReadFile(path: string) { rec.igesReadPath = path; return readOk ? RET_DONE : RET_FAIL; }
      TransferRoots(_p: any) { rec.igesTransferred = true; return nbShapes; }
      NbShapes() { return nbShapes; }
      OneShape() { return { __kind: "SOLID", from: "iges" }; }
      delete() {}
    },

    TCollection_ExtendedString_2: class { constructor(_s: string, _m: boolean) {} delete() {} },
    TCollection_AsciiString_2: class { constructor(public str: string) {} delete() {} },
    TDocStd_Document: class { delete() {} },
    Handle_TDocStd_Document_2: class { constructor(public doc: any) {} },
    RWObj_CafReader: class {
      SetDocument(h: any) { rec.objDoc = h; }
      Perform(path: any, _p: any) { rec.objReadPath = path?.str ?? path; return readOk; }
      SingleShape() { return { __kind: "MESH", from: "obj", IsNull: () => nbShapes < 1 }; }
      delete() {}
    },
  };
  return { oc, shapeStorage: new Map() } as unknown as WorkerContext;
}

const shape = () => ({ __kind: "SOLID", ShapeType: () => "SOLID" });

describe("exportShapeToString", () => {
  it("writes STEP via STEPControl_Writer and returns the file text", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const out = exportShapeToString(ctx, shape(), "step");
    expect(rec.stepTransfer.mode).toBe("AsIs");
    expect(out).toBe("STEP-DATA");
  });

  it("writes IGES via IGESControl_Writer (AddShape → ComputeModel → Write)", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const out = exportShapeToString(ctx, shape(), "iges");
    expect(rec.igesComputed).toBe(true);
    expect(out).toBe("IGES-DATA");
  });

  it("meshes the shape before writing STL", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const out = exportShapeToString(ctx, shape(), "stl");
    expect(rec.meshPerformed).toBe(true);
    expect(out).toBe("STL-DATA");
  });

  it("cleans up the scratch file after export", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    exportShapeToString(ctx, shape(), "step");
    expect(Object.keys(rec.fs.files)).toHaveLength(0);
  });

  it("throws when the STEP transfer fails", () => {
    const ctx = mockCtx({}, { transferOk: false });
    expect(() => exportShapeToString(ctx, shape(), "step")).toThrow(/STEP transfer failed/);
  });
});

describe("importShapeFromString", () => {
  it("reads STEP via STEPControl_Reader and returns OneShape", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const result = importShapeFromString(ctx, "step", "STEP-CONTENT");
    expect(rec.stepTransferred).toBe(true);
    expect(result).toMatchObject({ from: "step" });
  });

  it("reads IGES via IGESControl_Reader", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const result = importShapeFromString(ctx, "iges", "IGES-CONTENT");
    expect(result).toMatchObject({ from: "iges" });
  });

  it("reads OBJ via RWObj_CafReader.SingleShape", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const result = importShapeFromString(ctx, "obj", "o cube\nv 0 0 0\n");
    expect(rec.objReadPath).toContain(".obj");
    expect(result).toMatchObject({ from: "obj" });
  });

  it("stages the file content on the FS then cleans it up", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    importShapeFromString(ctx, "step", "STEP-CONTENT");
    expect(Object.keys(rec.fs.files)).toHaveLength(0);
  });

  it("throws when the reader reports no shapes", () => {
    const ctx = mockCtx({}, { nbShapes: 0 });
    expect(() => importShapeFromString(ctx, "step", "bad")).toThrow(/no shapes/);
  });

  it("throws when the STEP read fails", () => {
    const ctx = mockCtx({}, { readOk: false });
    expect(() => importShapeFromString(ctx, "step", "bad")).toThrow(/Failed to read STEP/);
  });
});
