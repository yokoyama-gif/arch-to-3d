export type Rotation = 0 | 90 | 180 | 270;
export type Severity = 'ok' | 'warning' | 'ng';
export type ObjectCategory =
  | 'desk'
  | 'meeting'
  | 'storage'
  | 'support'
  | 'reception'
  | 'lounge'
  | 'structure';

export type LocalSide = 'top' | 'right' | 'bottom' | 'left';
export type WallSide = LocalSide;
export type ZoneType =
  | 'work'
  | 'meeting'
  | 'reception'
  | 'support'
  | 'lounge'
  | 'circulation'
  | 'focus'
  | 'custom';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OverlayKind =
  | 'corridor'
  | 'chair'
  | 'door'
  | 'reception'
  | 'copy'
  | 'meeting';

export interface PlanOverlay {
  id: string;
  kind: OverlayKind;
  label: string;
  rect: Rect;
  severity: Severity;
  objectIds: string[];
}

export interface OverlayVisibility {
  corridor: boolean;
  chair: boolean;
  door: boolean;
  reception: boolean;
  copy: boolean;
  meeting: boolean;
}

export interface RoomDoor {
  id: string;
  name: string;
  wall: WallSide;
  offset: number;
  width: number;
  swing: 'inward' | 'outward';
}

export interface ProjectSettings {
  unit: 'mm';
  gridSize: number;
  snapToGrid: boolean;
  minCorridorWidth: number;
  chairClearance: number;
  wallSnapThreshold: number;
  doorClearance: number;
  meetingEntryClearance: number;
  receptionServiceDistance: number;
  commonAreaClearance: number;
  autoLayoutGap: number;
}

export interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  wallThickness: number;
  doors: RoomDoor[];
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  color: string;
  rect: Rect;
}

export interface LayoutObjectMetadata {
  localCorridorSides?: LocalSide[];
  localChairSides?: LocalSide[];
  meetingEntrySides?: LocalSide[];
  frontOperationSide?: LocalSide;
  frontOperationDepth?: number;
  waitingAreaSide?: LocalSide;
  waitingAreaDepth?: number;
  preferredZoneTypes?: ZoneType[];
  keepNearWall?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

export interface LayoutObject {
  id: string;
  libraryItemId: string;
  type: string;
  name: string;
  category: ObjectCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;
  seatCount: number;
  fill: string;
  stroke: string;
  metadata: LayoutObjectMetadata;
}

export interface LibraryItem {
  id: string;
  type: string;
  name: string;
  category: ObjectCategory;
  width: number;
  height: number;
  seatCount: number;
  fill: string;
  stroke: string;
  metadata: LayoutObjectMetadata;
  origin?: 'preset' | 'custom';
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  room: Omit<Room, 'id'>;
  zones: Array<Omit<Zone, 'id'>>;
  objects: Array<{
    libraryItemId: string;
    name?: string;
    x: number;
    y: number;
    rotation?: Rotation;
    width?: number;
    height?: number;
  }>;
}

export interface Issue {
  id: string;
  severity: Severity;
  code:
    | 'OUT_OF_ROOM'
    | 'OVERLAP'
    | 'CORRIDOR'
    | 'CHAIR_CLEARANCE'
    | 'DOOR_BLOCKED'
    | 'RECEPTION_WAITING'
    | 'COPY_OPERATION'
    | 'MEETING_ENTRY'
    | 'PRESSURE'
    | 'VISITOR_FLOW'
    | 'ZONE_BALANCE'
    | 'COMMON_USABILITY';
  title: string;
  description: string;
  objectIds: string[];
}

export interface EvaluationMetrics {
  totalSeats: number;
  meetingSeats: number;
  occupiedAreaRatio: number;
  minCorridorWidth: number;
  warningCount: number;
  ngCount: number;
  score: number;
  zoneCount: number;
  sharedAreaRatio: number;
  pressureIndex: number;
}

export interface EvaluationResult {
  issues: Issue[];
  metrics: EvaluationMetrics;
}

export interface LayoutPlan {
  id: string;
  name: string;
  room: Room;
  zones: Zone[];
  objects: LayoutObject[];
  evaluation: EvaluationResult;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  customLibrary: LibraryItem[];
  plans: LayoutPlan[];
}
