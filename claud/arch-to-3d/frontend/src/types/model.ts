export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface WallSegment {
  start: Point3D;
  end: Point3D;
  height: number;
  thickness: number;
  is_exterior: boolean;
}

export interface DoorData {
  position: Point3D;
  width: number;
  height: number;
  wall_index: number;
  offset_along_wall: number;
}

export interface WindowData {
  position: Point3D;
  width: number;
  height: number;
  sill_height: number;
  wall_index: number;
  offset_along_wall: number;
}

export interface FloorData {
  outline: Point2D[];
  elevation: number;
  floor_number: number;
}

export interface RoofData {
  type: "flat" | "gable" | "hip";
  ridge_height: number;
  outline: Point2D[];
  base_elevation: number;
}

export interface Building3DModel {
  walls: WallSegment[];
  doors: DoorData[];
  windows: WindowData[];
  floors: FloorData[];
  roof: RoofData | null;
  scale_factor: number;
  bounding_box: { min: Point3D; max: Point3D };
}
