import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  MeshStandardMaterial,
  PlaneGeometry,
  SpotLight,
  Vector3,
} from "three";

import { batchStatic } from "@/lib/three/static-batch";

import { type DockBackdrop } from "./dock-backdrop";
import { createDampMask, DRAINS, withDamp } from "./dock-damp";
import { createWetFloor } from "./dock-wet-floor";
import { createForklift } from "./dock-forklift";
import { createBayInterior } from "./dock-interior";
import { createDockHardware, createLampColumns, createYardEnvirons } from "./dock-hardware";
import {
  createCladdingMaps,
  createDistantLights,
  createFalloffTexture,
  createGlowTexture,
  createGroundGlints,
  createHazardStripeTexture,
  createSlatTexture,
  type GlintSource,
  valueNoise,
} from "./world-details";

/*
 * ⚠ DEVELOPMENT-ONLY PLACEHOLDER WORLDS — NOT PRODUCTION ART.
 *
 * Just enough geometry to validate camera space, safe zones, truck framing,
 * light positions, the departure path, the trailer wipe and the road flow.
 * The dock and road layouts follow the approved styleframes, but their
 * geometry is still blocking. The dock is an anonymous
 * customer-side loading facility: no signage, nothing identifying it as BSR's.
 */

export interface DockWorld {
  group: Group;
  /** Placeholder geometry (hidden when a production dock kit is loaded). */
  blocking: Group;
  ambient: HemisphereLight;
  dockLight: SpotLight;
  doorGlow: MeshStandardMaterial;
  /** Yard and canopy lamp heads (emissive only — no extra real-time lights). */
  lampGlow: MeshStandardMaterial;
  /** Direction of the pre-dawn glow (world space, for the sky dome). */
  sunDirection: Vector3;
  /** Direction of the lit bay from the parked truck (for the environment map). */
  bayDirection: Vector3;
  /** Distant relief material (tinted from the sky horizon by the runtime). */
  ridge: MeshBasicMaterial;
  /** Authored forklift motion for the Preparation/Ready beats (story progress 0–1). */
  update(progress: number): void;
  /** The camera jumped (snap, world switch, resize): re-render the floor reflection now. */
  refreshReflection(): void;
}

/*
 * Layout (Styleframes 01/02): an anonymous customer-side facility whose
 * façade runs parallel to the parked truck on its far (+X) side, loading doors
 * facing the truck, one bay lit and open just behind the cab. The building
 * ends a few metres past the cab front, leaving the exit road and the camera's
 * return move around the cab clear. The yard opens towards the camera (−X).
 */
const FACADE_X = 9;
const BUILDING_Z: readonly [number, number] = [-56, 0];
const BUILDING_HEIGHT = 11.5;
const DOOR_Z = [-48, -40, -32, -24, -16, -8] as const;
/**
 * The open, lit bay: from the Styleframe 01 camera, only façade points between
 * z ≈ −10.5 (behind the cab-front corner) and z ≈ −5.6 (frame edge) appear to
 * the right of the cab, so the bay sits there.
 */
const LIT_DOOR_Z = -8;
/** Open, lit bays: the one beside the cab and the next one along. */
const LIT_DOORS = [-8, -16] as const;
const SLAB = 6;

export function createDockWorld(
  backdrop: DockBackdrop = { group: [], update: () => {} },
): DockWorld {
  const group = new Group();
  group.name = "DockWorld";

  // Slightly damp industrial concrete: slab-to-slab tone variation and a few
  // dew patches (lower roughness), never a mirror.
  const dampMask = createDampMask();
  const concreteMaps = createConcreteMaps();
  const concrete = new MeshStandardMaterial({
    color: "#a3a49f",
    roughness: 1,
    map: concreteMaps.color,
    roughnessMap: concreteMaps.roughness,
  });
  withDamp(concrete, dampMask);
  const ground = new Mesh(new PlaneGeometry(264, 264), concrete);
  ground.name = "Dock_Apron";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-2, 0, -20);
  ground.receiveShadow = true;

  // Slab joints: thin dark strips on a 6 m grid (the concrete's construction language).
  const jointMaterial = new MeshStandardMaterial({ color: "#2e302e", roughness: 0.8 });
  const jointsPerAxis = 21;
  const joints = new InstancedMesh(new BoxGeometry(1, 0.004, 1), jointMaterial, jointsPerAxis * 2);
  joints.name = "Dock_Slab_Joints";
  const matrix = new Matrix4();
  for (let i = 0; i < jointsPerAxis; i++) {
    const offset = (i - (jointsPerAxis - 1) / 2) * SLAB;
    joints.setMatrixAt(i, matrix.makeScale(0.03, 1, 126).setPosition(offset - 2, 0.003, -20));
    joints.setMatrixAt(
      jointsPerAxis + i,
      matrix.makeScale(126, 1, 0.03).setPosition(-2, 0.003, offset - 20),
    );
  }
  joints.receiveShadow = true;

  // Insulated-panel cladding: neutral painted industrial metal (not blue) — the blue-hour
  // read comes from the sky/ambient light on it, not the material's own colour.
  const claddingMaps = createCladdingMaps();
  const cladding = new MeshStandardMaterial({
    color: "#9a9c98",
    roughness: 0.65,
    roughnessMap: claddingMaps.roughness,
    metalness: 0.08,
    map: claddingMaps.color,
  });
  const buildingLength = BUILDING_Z[1] - BUILDING_Z[0];
  // The volume is split around the open bay (sill 1.2 m, opening 3.4 × 3.2 m).
  const DEPTH = 24;
  // Wall segments in front of the hall are thin skins (0.5 m) so the interior can exist
  // behind the openings; the rest of the building stays a solid volume.
  const HALL: readonly [number, number] = [-24.5, 0.5];
  const volume = (name: string, z0: number, z1: number, y0: number, y1: number) => {
    const skin = z0 >= HALL[0] && z1 <= HALL[1];
    const depth = skin ? 0.5 : DEPTH;
    const mesh = new Mesh(new BoxGeometry(depth, y1 - y0, z1 - z0), cladding);
    mesh.name = name;
    mesh.position.set(FACADE_X + depth / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    worldScaledUv(mesh, 6);
    mesh.receiveShadow = true;
    return mesh;
  };
  const building = new Group();
  building.name = "Dock_Building";
  const edges = [...LIT_DOORS].sort((a, b) => a - b);
  let cursor = BUILDING_Z[0];
  building.add(volume("Dock_Building_WallFar", cursor, HALL[0], 0, BUILDING_HEIGHT));
  cursor = HALL[0];
  edges.forEach((zc, k) => {
    const z0 = zc - 1.6;
    const z1 = zc + 1.6;
    building.add(
      volume(`Dock_Building_Wall${k}`, cursor, z0, 0, BUILDING_HEIGHT),
      volume(`Dock_Building_Lintel${k}`, z0, z1, 4.6, BUILDING_HEIGHT),
      volume(`Dock_Building_Sill${k}`, z0, z1, 0, 1.2),
    );
    cursor = z1;
  });
  building.add(volume("Dock_Building_WallEnd", cursor, BUILDING_Z[1], 0, BUILDING_HEIGHT));

  // Doors at dock height (sill ≈ 1.2 m), with a leveller plate in front of each.
  const doorMaterial = new MeshStandardMaterial({
    color: "#59616a",
    roughness: 0.5,
    metalness: 0.4,
    map: createSlatTexture(),
  });
  // Lit bay interior: warm, brightest under its ceiling lamps (falloff towards the floor).
  const falloff = createFalloffTexture();
  const doorGlow = new MeshStandardMaterial({
    color: "#1d201f",
    emissive: "#ffc98f",
    emissiveIntensity: 1.2,
    emissiveMap: falloff,
  });
  const levellerMaterial = new MeshStandardMaterial({
    color: "#4b4d4a",
    roughness: 0.5,
    metalness: 0.6,
  });
  const shelterMaterial = new MeshStandardMaterial({ color: "#121416", roughness: 0.9 });
  const rubberMaterial = new MeshStandardMaterial({ color: "#0c0c0d", roughness: 0.85 });
  const doors: Object3D[] = [];
  for (const z of DOOR_Z) {
    const lit = (LIT_DOORS as readonly number[]).includes(z);
    if (lit) {
      // The open bay: a real hall behind the opening (racking, loads, trusses, fixtures).
      const interior = createBayInterior({
        facadeX: FACADE_X,
        z,
        floorY: 1.2,
        seed: 5 + Math.abs(z),
      });
      const raisedDoor = new Mesh(new BoxGeometry(0.3, 0.5, 3.2), doorMaterial);
      raisedDoor.name = "Dock_Door_Raised";
      raisedDoor.position.set(FACADE_X + 0.1, 1.2 + 3.15, z);
      doors.push(interior, raisedDoor);
      // Restrained load staged just inside the door.
      const palletMaterial = new MeshStandardMaterial({ color: "#d9d2c3", roughness: 0.55 });
      for (const [dz, h] of [
        [-0.65, 1.3],
        [0.65, 1.0],
      ] as const) {
        const pallet = new Mesh(new BoxGeometry(1.2, h, 1.0), palletMaterial);
        pallet.name = "Dock_Pallet";
        pallet.position.set(FACADE_X + 1.1, 1.2 + h / 2, z + dz);
        pallet.castShadow = pallet.receiveShadow = true;
        doors.push(pallet);
      }
    } else {
      const door = new Mesh(new BoxGeometry(0.2, 3.2, 3.0), doorMaterial);
      door.name = "Dock_Door";
      door.position.set(FACADE_X - 0.05, 1.2 + 1.6, z);
      doors.push(door);
    }
    // Dock shelter: dark curtains framing each door.
    for (const dz of [-1.75, 1.75]) {
      const side = new Mesh(new BoxGeometry(0.7, 3.8, 0.35), shelterMaterial);
      side.name = "Dock_Shelter";
      side.position.set(FACADE_X - 0.35, 1.2 + 1.9, z + dz);
      doors.push(side);
    }
    const head = new Mesh(new BoxGeometry(0.7, 0.45, 3.85), shelterMaterial);
    head.name = "Dock_Shelter";
    head.position.set(FACADE_X - 0.35, 1.2 + 3.6, z);
    const leveller = new Mesh(new BoxGeometry(1.2, 1.2, 3.2), levellerMaterial);
    leveller.name = "Dock_Leveller";
    leveller.position.set(FACADE_X - 0.6, 0.6, z);
    leveller.castShadow = leveller.receiveShadow = true;
    doors.push(head, leveller);
    // Rubber dock bumpers, flanking every door at trailer-strike height.
    for (const dz of [-1.55, 1.55]) {
      const bumper = new Mesh(new BoxGeometry(0.14, 0.5, 0.18), rubberMaterial);
      bumper.name = "Dock_Bumper";
      bumper.position.set(FACADE_X - 0.07, 0.95, z + dz);
      bumper.castShadow = bumper.receiveShadow = true;
      doors.push(bumper);
    }
  }

  // Safety floor marking: a yellow hazard stripe on the apron in front of the
  // lit bay, and a "keep clear" outline framing the threshold.
  const safetyMaterial = new MeshStandardMaterial({
    color: "#e8b923",
    roughness: 0.6,
    map: createHazardStripeTexture(),
  });
  const hazardStripe = new Mesh(new PlaneGeometry(4.4, 0.35), safetyMaterial);
  hazardStripe.name = "Dock_Safety_Stripe";
  hazardStripe.rotation.x = -Math.PI / 2;
  hazardStripe.position.set(FACADE_X - 2.6, 0.006, LIT_DOOR_Z);
  hazardStripe.rotation.z = Math.PI / 2;
  const keepClearMaterial = new MeshStandardMaterial({ color: "#e8b923", roughness: 0.6 });
  const keepClear = new Group();
  keepClear.name = "Dock_Keep_Clear";
  for (const dz of [-1.9, 1.9]) {
    const line = new Mesh(new PlaneGeometry(4.2, 0.06), keepClearMaterial);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.PI / 2;
    line.position.set(FACADE_X - 2.5, 0.006, LIT_DOOR_Z + dz);
    keepClear.add(line);
  }
  {
    const line = new Mesh(new PlaneGeometry(3.8, 0.06), keepClearMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(FACADE_X - 4.5, 0.006, LIT_DOOR_Z);
    keepClear.add(line);
  }
  doors.push(hazardStripe);

  // Roof plant: turbine ventilators along the ridge (rooftop technical detail).
  const ventMaterial = new MeshStandardMaterial({
    color: "#7a7d7a",
    roughness: 0.4,
    metalness: 0.7,
  });
  const roofVents: Mesh[] = [];
  for (let z = BUILDING_Z[0] + 6; z < BUILDING_Z[1] - 4; z += 11) {
    if (Math.abs(z - LIT_DOOR_Z) < 3) continue; // clear of the lit bay's canopy
    const base = new Mesh(new CylinderGeometry(0.35, 0.4, 0.5, 12), ventMaterial);
    base.position.set(FACADE_X + 8, BUILDING_HEIGHT + 0.25, z);
    const cap = new Mesh(new CylinderGeometry(0.42, 0.3, 0.3, 12), ventMaterial);
    cap.position.set(FACADE_X + 8, BUILDING_HEIGHT + 0.6, z);
    base.castShadow = base.receiveShadow = cap.castShadow = true;
    roofVents.push(base, cap);
  }

  // Façade scale: vertical panel joints every 6 m and a concrete plinth.
  const panelJoints = new InstancedMesh(
    new BoxGeometry(0.05, BUILDING_HEIGHT - 1.2, 0.05),
    jointMaterial,
    Math.floor(buildingLength / 6),
  );
  panelJoints.name = "Dock_Panel_Joints";
  for (let i = 0; i < panelJoints.count; i++) {
    panelJoints.setMatrixAt(
      i,
      matrix.makeTranslation(
        FACADE_X - 0.03,
        1.2 + (BUILDING_HEIGHT - 1.2) / 2,
        BUILDING_Z[0] + 3 + i * 6,
      ),
    );
  }
  const plinth = new Mesh(
    new BoxGeometry(0.1, 1.2, buildingLength),
    new MeshStandardMaterial({ color: "#6d6e6a", roughness: 0.85 }),
  );
  plinth.name = "Dock_Plinth";
  plinth.position.set(FACADE_X - 0.05, 0.6, (BUILDING_Z[0] + BUILDING_Z[1]) / 2);

  // Depth in the yard: two parked trailers far out on the open side.
  const trailerMaterial = new MeshStandardMaterial({ color: "#b9bab4", roughness: 0.7 });
  const parked = new InstancedMesh(new BoxGeometry(2.55, 2.8, 13.6), trailerMaterial, 4);
  parked.name = "Yard_Parked_Trailers";
  // Two behind the camera side of the yard, two far back (small, low depth
  // cues on the horizon behind the copy, as in Styleframe 01).
  parked.setMatrixAt(0, matrix.makeRotationY(0.1).setPosition(-48, 2.6, 30));
  parked.setMatrixAt(1, matrix.makeRotationY(0.1).setPosition(-56, 2.6, 34));
  parked.setMatrixAt(2, matrix.makeRotationY(1.45).setPosition(-34, 2.6, -118));
  parked.setMatrixAt(3, matrix.makeRotationY(1.5).setPosition(-52, 2.6, -121));
  parked.castShadow = true;

  // Distant relief (a depth cue behind the yard; kept low and quiet behind the copy).
  const ridge = createRidge(380, 18, 5);

  // Canopy over the lit bay; its lamp is the dock light's visible source.
  const canopy = new Mesh(new BoxGeometry(2.2, 0.25, 4.5), cladding);
  canopy.name = "Dock_Canopy";
  canopy.position.set(FACADE_X - 1.1, 5.2, LIT_DOOR_Z);
  const lampGlow = new MeshStandardMaterial({
    color: "#1d201f",
    emissive: "#ffd39a",
    emissiveIntensity: 3,
  });
  const canopyLamp = new Mesh(new BoxGeometry(0.9, 0.06, 0.5), lampGlow);
  canopyLamp.name = "Dock_Canopy_Lamp";
  canopyLamp.position.set(FACADE_X - 1.4, 5.05, LIT_DOOR_Z);

  // Safety bollards along the façade (yellow is environmental safety colour).
  const bollardMaterial = new MeshStandardMaterial({ color: "#b58a1c", roughness: 0.55 });
  const bollards = new InstancedMesh(
    new CylinderGeometry(0.14, 0.14, 1.1, 12),
    bollardMaterial,
    DOOR_Z.length * 2,
  );
  bollards.name = "Dock_Bollards";
  DOOR_Z.forEach((z, index) => {
    bollards.setMatrixAt(index * 2, matrix.makeTranslation(FACADE_X - 1.5, 0.55, z - 1.9));
    bollards.setMatrixAt(index * 2 + 1, matrix.makeTranslation(FACADE_X - 1.5, 0.55, z + 1.9));
  });
  bollards.castShadow = true;

  // Yard lamp posts on the open side: emissive heads only (distance cues, no lights).
  const poleMaterial = new MeshStandardMaterial({ color: "#3d4240", roughness: 0.6 });
  // Yard lamps stand outside the opening/reveal frames: the copy zone stays clean.
  // The far row (z ≈ −95 … −170) reads as small warm points on the horizon
  // behind the copy — distance, not detail.
  const lampPositions: Array<[number, number]> = [
    [-60, 10],
    [-40, 40],
    [-80, -20],
    [-30, 60],
    [8.5, 14],
    [-22, -112],
    [-44, -104],
    [-68, -96],
    [-12, -150],
    [-92, -84],
    [-38, -165],
  ];
  const posts = new InstancedMesh(
    new CylinderGeometry(0.1, 0.14, 10, 8),
    poleMaterial,
    lampPositions.length,
  );
  posts.name = "Yard_Lamp_Posts";
  const heads = new InstancedMesh(new BoxGeometry(1.1, 0.3, 0.6), lampGlow, lampPositions.length);
  heads.name = "Yard_Lamp_Heads";
  lampPositions.forEach(([x, z], index) => {
    posts.setMatrixAt(index, matrix.makeTranslation(x, 5, z));
    heads.setMatrixAt(index, matrix.makeTranslation(x, 10, z));
  });

  const exitRoad = new Mesh(
    new PlaneGeometry(8, 90),
    new MeshStandardMaterial({ color: "#3a3c3a", roughness: 0.7 }),
  );
  exitRoad.name = "Dock_Exit_Road";
  exitRoad.rotation.x = -Math.PI / 2;
  exitRoad.position.set(0, 0.005, 50);
  exitRoad.receiveShadow = true;

  // Exit road markings: solid white edge lines and a dashed centre line (Italian spec:
  // 4.5 m dash / 7.5 m gap would be motorway; estate road uses 3 m / 6 m), worn.
  const paint = new MeshStandardMaterial({ color: "#d9d9d0", roughness: 0.55 });
  const markings = new Group();
  markings.name = "Dock_Exit_Markings";
  for (const x of [-3.6, 3.6]) {
    const edge = new Mesh(new PlaneGeometry(0.15, 90), paint);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.012, 50);
    markings.add(edge);
  }
  for (let z = 8; z < 95; z += 9) {
    const dash = new Mesh(new PlaneGeometry(0.15, 3), paint);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.012, z);
    markings.add(dash);
  }
  // Perimeter fence: posts plus top and bottom rails.
  const fenceMaterial = new MeshStandardMaterial({ color: "#4a4f4d", roughness: 0.6 });
  const fence = new InstancedMesh(new BoxGeometry(0.08, 2, 0.08), fenceMaterial, 40);
  fence.name = "Dock_Fence";
  for (let i = 0; i < 40; i++) {
    fence.setMatrixAt(i, matrix.makeTranslation(-70 + i * 4, 1, -140));
  }
  const rails = new InstancedMesh(new BoxGeometry(160, 0.05, 0.05), fenceMaterial, 2);
  rails.name = "Dock_Fence_Rails";
  rails.setMatrixAt(0, matrix.makeTranslation(8, 1.95, -140));
  rails.setMatrixAt(1, matrix.makeTranslation(8, 0.15, -140));

  // Canopy strip along the loading doors with a pair of warm downlights per
  // door: the façade's rhythm of light (emissive only — no real-time lights).
  const canopyStrip = new Mesh(
    new BoxGeometry(1.6, 0.28, BUILDING_Z[1] - BUILDING_Z[0] - 4),
    cladding,
  );
  canopyStrip.name = "Dock_Canopy_Strip";
  canopyStrip.position.set(FACADE_X - 0.8, 5.35, (BUILDING_Z[0] + BUILDING_Z[1]) / 2);
  worldScaledUv(canopyStrip, 6);
  const fixtures = new InstancedMesh(new BoxGeometry(0.5, 0.05, 0.9), lampGlow, DOOR_Z.length * 2);
  fixtures.name = "Dock_Downlights";
  DOOR_Z.forEach((z, index) => {
    fixtures.setMatrixAt(index * 2, matrix.makeTranslation(FACADE_X - 0.9, 5.19, z - 1.1));
    fixtures.setMatrixAt(index * 2 + 1, matrix.makeTranslation(FACADE_X - 0.9, 5.19, z + 1.1));
  });

  // Light the downlights throw: a warm wash down each closed door and a pool
  // on the damp apron in front of every bay (additive cards, dock-light driven).
  const washMaterial = new MeshBasicMaterial({
    color: new Color("#ffb877").multiplyScalar(0.55),
    map: falloff,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const closedDoors = DOOR_Z.filter((z) => !(LIT_DOORS as readonly number[]).includes(z));
  const washes = new InstancedMesh(
    new PlaneGeometry(4.6, 3.9).rotateY(-Math.PI / 2),
    washMaterial,
    closedDoors.length,
  );
  washes.name = "Dock_Wall_Wash";
  closedDoors.forEach((z, index) => {
    washes.setMatrixAt(index, matrix.makeTranslation(FACADE_X - 0.18, 1.2 + 1.95, z));
  });
  const poolMaterial = new MeshBasicMaterial({
    color: new Color("#ffb877").multiplyScalar(0.42),
    map: createGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const pools = new InstancedMesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    poolMaterial,
    DOOR_Z.length,
  );
  pools.name = "Dock_Light_Pools";
  DOOR_Z.forEach((z, index) => {
    const lit = z === LIT_DOOR_Z;
    pools.setMatrixAt(
      index,
      matrix.makeScale(lit ? 11 : 8, 1, lit ? 9 : 7).setPosition(FACADE_X - 3.2, 0.01, z),
    );
  });
  const dockLevel = () => lampGlow.emissiveIntensity / 3;
  for (const card of [washes, pools]) {
    card.renderOrder = 2;
    card.onBeforeRender = () => {
      washMaterial.opacity = poolMaterial.opacity = dockLevel();
    };
  }

  // Damp-ground glints under every bright source (they stretch towards the camera).
  const glintSources: GlintSource[] = [
    ...closedDoors.map((z) => ({
      x: FACADE_X - 1.4,
      z,
      length: 24,
      width: 1.6,
      color: "#ffb877",
      strength: 0.35,
    })),
    { x: FACADE_X - 0.6, z: LIT_DOOR_Z, length: 30, width: 2, color: "#ffc98f", strength: 0.4 },
    { x: 8.5, z: 14, length: 22, width: 1.3, color: "#ffc27a", strength: 0.45 },
    ...lampPositions.slice(5).map(([x, z]) => ({
      x,
      z,
      length: 60,
      width: 1.1,
      color: "#ffc27a",
      strength: 0.35,
    })),
  ];
  const glints = createGroundGlints(glintSources, "Dock_Ground_Glints", dockLevel);

  // Distant settlements on the plain behind the yard (screen-sized warm points).
  const city = createDistantLights({
    name: "Backdrop_City_Lights",
    count: 420,
    radius: [240, 340],
    sector: [2.55, 3.95],
    height: [0.4, 7],
    size: 4,
    seed: 3,
  });

  // Blue-hour sky fill (interim; the production dock uses an environment map).
  const ambient = new HemisphereLight("#8a9cbc", "#2b2825", 1);
  ambient.name = "Dock_Ambient";
  // Cool sky fill from the open (−X) side: it grades the facade from lit top edge to dark
  // base like a real wall under a blue-hour sky, instead of flat ambient (no shadow cost).
  const skyFill = new DirectionalLight("#8fb0e6", 1.9);
  skyFill.name = "Dock_Sky_Fill";
  skyFill.position.set(-40, 30, -8);
  skyFill.target.position.set(FACADE_X, 4, -20);
  group.add(skyFill, skyFill.target);

  // ONE controlled warm source: the flood under the lit bay's canopy, grazing
  // the cab front and the ground around it. The only shadow caster here.
  const dockLight = new SpotLight("#ffcf98", 600, 45, Math.PI / 4.2, 0.65, 1.6);
  dockLight.name = "Dock_Flood";
  // A floodlight mast just ahead of the building corner (the fifth yard lamp):
  // warm light across the cab front, ahead-right as in Styleframe 01, and onto
  // the apron. It must stand ahead of the cab-front plane (z ≈ 5) to reach it.
  dockLight.position.set(8.5, 9.6, 14);
  dockLight.target.position.set(-1, 0.6, 8);
  dockLight.shadow.bias = -0.0005;

  // Blocking geometry: replaced as a whole by a production dock kit; the lights stay.
  // Drains: a steel-grated trench along the bay frontage and cast-iron yard grates.
  const drainMat = new MeshStandardMaterial({ color: "#1a1c1d", roughness: 0.6, metalness: 0.6 });
  const drains = new Group();
  drains.name = "Dock_Drains";
  const trench = new Mesh(
    new BoxGeometry(0.32, 0.02, DRAINS.trench.z1 - DRAINS.trench.z0),
    drainMat,
  );
  trench.position.set(DRAINS.trench.x, 0.012, (DRAINS.trench.z0 + DRAINS.trench.z1) / 2);
  drains.add(trench);
  for (const [gx, gz] of DRAINS.grates) {
    const g = new Mesh(new BoxGeometry(0.6, 0.02, 0.6), drainMat);
    g.position.set(gx, 0.012, gz);
    drains.add(g);
  }
  const wetFloor = createWetFloor(dampMask);
  wetFloor.mesh.position.set(-2, 0.012, -20);

  const blocking = new Group();
  blocking.name = "Dock_Blocking";
  blocking.add(
    ground,
    wetFloor.mesh,
    drains,
    joints,
    building,
    ...doors,
    keepClear,
    ...roofVents,
    canopy,
    canopyLamp,
    createDockHardware({
      facadeX: FACADE_X,
      buildingZ: BUILDING_Z,
      buildingHeight: BUILDING_HEIGHT,
      doorZ: DOOR_Z,
      litDoorZ: LIT_DOOR_Z,
      lampGlow,
    }),
    createLampColumns(lampPositions, lampGlow),
    createYardEnvirons(cladding, lampGlow),
    posts,
    exitRoad,
    markings,
    fence,
    rails,
    panelJoints,
    plinth,
    parked,
    ridge,
    canopyStrip,
    fixtures,
    washes,
    pools,
    glints.mesh,
    city.points,
  );
  // ---------------------------------------------------------------- forklift (Preparation/Ready)
  // One lightweight realtime forklift, authored (not simulated): it carries a
  // wrapped pallet out to the threshold, pauses, then reverses back inside as
  // loading finishes and the truck becomes the hero (reference 02 → 03).
  const {
    group: forklift,
    beaconMaterial: forkliftBeacon,
    wheels: forkWheels,
    rearSteer: forkSteer,
  } = createForklift();
  group.add(blocking, ambient, dockLight, dockLight.target, forklift, ...backdrop.group);
  // Draw-call batching (same image): the blocking is static, so it merges per material;
  // the forklift's wheels roll and steer, so they are skinned to their own nodes. Materials
  // the runtime drives (lamp/door emissive, ridge tint, beacon strobe) are left as they are.
  batchStatic(blocking, { keep: [lampGlow, doorGlow, ridge.material as MeshBasicMaterial] });
  batchStatic(forklift, { bones: forkWheels, keep: [forkliftBeacon] });
  // Pre-dawn glow low behind the trailer (left of frame in Styleframe 01).
  const sunDirection = new Vector3(-0.25, 0, -1).normalize();
  const bayDirection = new Vector3(FACADE_X, 0, LIT_DOOR_Z).normalize();

  // Path: deep inside the bay → threshold (pause) → back inside, all on the apron.
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  return {
    group,
    blocking,
    ambient,
    dockLight,
    doorGlow,
    lampGlow,
    sunDirection,
    bayDirection,
    ridge: ridge.material as MeshBasicMaterial,
    refreshReflection: wetFloor.refresh,
    update(progress) {
      // Preparation (0–0.12): approaches the threshold. Ready (0.12–0.24):
      // pauses, then reverses back inside as the warehouse settles.
      // Two staging beats: bay −8 in Preparation/Ready, bay −16 in Loading (0.40–0.60):
      // the forklift brings a wrapped pallet to the threshold and pauses there (it never
      // drives into the trailer).
      const loading = progress >= 0.38 && progress < 0.62;
      const bayZ = LIT_DOORS[0];
      const outT = loading ? smoothstep(0.4, 0.475, progress) : smoothstep(0.0, 0.09, progress);
      const backT = loading ? smoothstep(0.54, 0.6, progress) : smoothstep(0.14, 0.24, progress);
      const t = outT - backT * outT; // 0 → 1 → 0
      const inside: [number, number] = [FACADE_X + 5.5, bayZ + 0.4];
      const threshold: [number, number] = [FACADE_X - 1.9, bayZ - 0.3];
      const x = inside[0] + (threshold[0] - inside[0]) * t;
      const z = inside[1] + (threshold[1] - inside[1]) * t;
      forklift.position.set(x, 0, z);
      forklift.rotation.y = -Math.PI / 2; // forks lead towards −X (the yard side), load first
      forklift.visible = progress < 0.26 || loading;
      forklift.position.y = Math.sin(progress * 240) * 0.006 * (t > 0.98 ? 1 : 0);
      // Rolling wheels follow the travelled path; the beacon strobes (~2 Hz); the body dips
      // slightly as it brakes to the pause at the threshold.
      const travelled = Math.hypot(x - inside[0], z - inside[1]);
      // Rear-wheel steering: the tail swings to line the load up with the bay (yaw follows
      // the lateral offset still to be closed, straightening as it arrives).
      const lateral = (z - bayZ) * (1 - t) * 0.6 + (z - threshold[1]);
      forkSteer.forEach((pv) => (pv.rotation.y = Math.max(-0.6, Math.min(0.6, lateral * 0.5))));
      forkWheels.forEach((w, i) => (w.rotation.x = -travelled / (i < 2 ? 0.32 : 0.25)));
      forkliftBeacon.emissiveIntensity = Math.sin(progress * 900) > 0.2 ? 4 : 0.6;
      const settling = Math.min(t, 1 - t) * 4;
      forklift.rotation.x = -0.012 * Math.max(0, 1 - Math.abs(settling - 1));
      // The first-light glow swings ahead of the truck as it leaves (sunrise over the road).
      const swing = smoothstep(0.4, 0.5, progress);
      sunDirection.set(-0.25 + 0.6 * swing, 0, -1 + 2 * swing).normalize();
      backdrop.update(progress);
    },
  };
}

/**
 * Planar, world-scaled UVs for a box placed in the world (one texture tile =
 * `tile` metres on every face), so façade panels keep their size across volumes.
 */
function worldScaledUv(mesh: Mesh, tile: number): void {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position!;
  const normal = geometry.attributes.normal!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + mesh.position.x;
    const y = position.getY(i) + mesh.position.y;
    const z = position.getZ(i) + mesh.position.z;
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    if (nx >= ny && nx >= nz) uv.setXY(i, z / tile, y / tile);
    else if (nz >= ny) uv.setXY(i, x / tile, y / tile);
    else uv.setXY(i, x / tile, z / tile);
  }
  uv.needsUpdate = true;
}

/**
 * Procedural concrete (no image asset, no DOM): one 48 m tile of 8 × 8 slabs.
 * Colour: per-slab tone and fine grain. Roughness (green channel): dry ≈ 0.72,
 * a few soft dew patches down to ≈ 0.38 — damp, never a mirror.
 */
function createConcreteMaps(size = 256): { color: DataTexture; roughness: DataTexture } {
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const slabs = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const slab = Math.floor(u * slabs) * 31 + Math.floor(v * slabs) * 17;
      const slabTone = 0.9 + ((0.12 * (((Math.sin(slab * 12.9898) * 43758.5453) % 1) + 1)) % 1);
      const grain =
        0.55 * valueNoise(u * 64, v * 64, 64, 1) + 0.45 * valueNoise(u * 16, v * 16, 16, 2);
      const tone = slabTone * (0.9 + 0.14 * grain);
      const damp = Math.min(1, Math.max(0, valueNoise(u * 6, v * 6, 6, 3) - 0.42) / 0.4);
      const dampTone = tone * (1 - 0.18 * damp);
      const i = (y * size + x) * 4;
      const c = Math.min(255, Math.round(dampTone * 200));
      color[i] = c;
      color[i + 1] = c;
      color[i + 2] = Math.min(255, Math.round(c * 0.97));
      color[i + 3] = 255;
      const r = 0.42 + 0.08 * (grain - 0.5) - 0.24 * damp;
      roughness[i] = roughness[i + 2] = 0;
      roughness[i + 1] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      roughness[i + 3] = 255;
    }
  }
  const texture = (data: Uint8Array, srgb: boolean) => {
    const t = new DataTexture(data, size, size);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(264 / 48, 264 / 48);
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { color: texture(color, true), roughness: texture(roughness, false) };
}

/**
 * Distant relief: a low ridgeline ring (flat colour, tinted from the sky's
 * horizon by the runtime so it always sits in the atmosphere). Kept low: it is
 * depth, not scenery.
 */
export function createRidge(radius: number, height: number, seed: number): Mesh {
  const segments = 180;
  const positions: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const h =
      height *
      (0.2 +
        0.6 * valueNoise(i / 9, 0.5, segments / 9, seed) ** 2 +
        0.2 * valueNoise(i / 2.5, 0.5, segments / 2.5, seed + 1));
    const x = Math.sin(a) * radius;
    const z = Math.cos(a) * radius;
    positions.push(x, -2, z, x, h, z);
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    index.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({ color: "#1b2438", fog: false, side: DoubleSide }),
  );
  mesh.name = "Backdrop_Ridge";
  mesh.frustumCulled = false;
  return mesh;
}
