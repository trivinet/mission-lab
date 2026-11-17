/**
 * The R3F canvas: Earth, trajectory segments, markers, axes and the camera. It draws the arrays
 * of a SceneGeometry as given and computes no physics. The only arithmetic is the sphere radius
 * (engine radius x s, in scene-geometry.ts), the illustrative Earth rotation angle and camera
 * motion.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AxesHelper,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineSegments,
  LineBasicMaterial,
  LineDashedMaterial,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SceneGeometry, SceneSegment } from './scene-geometry';
import {
  AXES_LENGTH,
  CAMERA_DISTANCE_LIMITS,
  COAST_DASH,
  INITIAL_CAMERA_POSITION,
  MARKER_SIZE_PX,
  SCENE_COLORS,
  STALE_OPACITY,
} from './scene-style';

export interface CameraSnapshot {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

function positionGeometry(vertices: Float32Array): BufferGeometry {
  // The array is handed to the GPU buffer by reference: what the hook shows is what is drawn.
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(vertices, 3));
  return geometry;
}

function TrajectoryLine({
  segment,
  stale,
  name,
}: {
  segment: SceneSegment;
  stale: boolean;
  name: string;
}) {
  const line = useMemo(() => {
    const geometry = positionGeometry(segment.vertices);
    const opacity = stale ? STALE_OPACITY : 1;
    if (segment.kind === 'coast') {
      const material = new LineDashedMaterial({
        color: SCENE_COLORS.coast,
        ...COAST_DASH,
        transparent: stale,
        opacity,
      });
      const dashed = new Line(geometry, material);
      // Display only: fills a separate attribute used by the dash shader; positions are untouched.
      dashed.computeLineDistances();
      return dashed;
    }
    return new Line(
      geometry,
      new LineBasicMaterial({ color: SCENE_COLORS.maneuver, transparent: stale, opacity }),
    );
  }, [segment, stale]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  return <primitive object={line} name={name} />;
}

function PointMarker({
  position,
  color,
  sizePx,
  name,
}: {
  position: Float32Array;
  color: string;
  sizePx: number;
  name: string;
}) {
  const geometry = useMemo(() => positionGeometry(position), [position]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return (
    <points geometry={geometry} name={name}>
      <pointsMaterial color={color} size={sizePx} sizeAttenuation={false} />
    </points>
  );
}

/** Great-circle half ring at longitude 0 in the Earth-fixed frame: the prime meridian. */
function primeMeridianPositions(radius: number): Float32Array {
  const steps = 64;
  const out = new Float32Array(3 * (steps + 1));
  for (let i = 0; i <= steps; i += 1) {
    const latitude = -Math.PI / 2 + (Math.PI * i) / steps;
    out[3 * i] = radius * Math.cos(latitude);
    out[3 * i + 1] = 0;
    out[3 * i + 2] = radius * Math.sin(latitude);
  }
  return out;
}

/** Latitude and longitude lines every 30 degrees, as line-segment pairs (display only). */
function graticulePositions(radius: number): Float32Array {
  const step = Math.PI / 6;
  const arc = 48;
  const points: number[] = [];
  const at = (lon: number, lat: number): number[] => [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
  ];
  for (let m = 0; m < 12; m += 1) {
    for (let i = 0; i < arc; i += 1) {
      const lat0 = -Math.PI / 2 + (Math.PI * i) / arc;
      const lat1 = -Math.PI / 2 + (Math.PI * (i + 1)) / arc;
      points.push(...at(m * step, lat0), ...at(m * step, lat1));
    }
  }
  for (let p = -2; p <= 2; p += 1) {
    for (let i = 0; i < arc; i += 1) {
      const lon0 = (2 * Math.PI * i) / arc;
      const lon1 = (2 * Math.PI * (i + 1)) / arc;
      points.push(...at(lon0, p * step), ...at(lon1, p * step));
    }
  }
  return Float32Array.from(points);
}

function Earth({ radius, rotationZ_rad }: { radius: number; rotationZ_rad: number }) {
  const graticule = useMemo(
    () =>
      new LineSegments(
        positionGeometry(graticulePositions(radius)),
        new LineBasicMaterial({ color: SCENE_COLORS.earthGrid }),
      ),
    [radius],
  );
  const meridian = useMemo(
    () =>
      new Line(
        positionGeometry(primeMeridianPositions(radius)),
        new LineBasicMaterial({ color: SCENE_COLORS.primeMeridian }),
      ),
    [radius],
  );
  return (
    // Rotation about inertial +Z by the illustrative ERA (ADR-004); the sphere's own poles are
    // turned onto Z by the inner mesh rotation.
    <group rotation={[0, 0, rotationZ_rad]} name="earth">
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[radius, 48, 24]} />
        <meshBasicMaterial
          color={SCENE_COLORS.earthFill}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <primitive object={graticule} name="graticule" />
      <primitive object={meridian} name="prime-meridian" />
    </group>
  );
}

const KEY_ROTATE_STEP_RAD = Math.PI / 36; // 5 degrees per key press
const KEY_ZOOM_FACTOR = 1.1;

/** Orbit controls plus keyboard operation and reset; reports the camera to the test hook. */
function CameraRig({
  resetNonce,
  cameraRef,
  label,
}: {
  resetNonce: number;
  cameraRef: { current: (() => CameraSnapshot) | null };
  label: string;
}) {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, domElement);
    c.enableDamping = false;
    c.minDistance = CAMERA_DISTANCE_LIMITS.min;
    c.maxDistance = CAMERA_DISTANCE_LIMITS.max;
    c.saveState();
    return c;
  }, [camera, domElement]);

  useEffect(() => {
    const onChange = () => {
      invalidate();
    };
    controls.addEventListener('change', onChange);
    cameraRef.current = () => ({
      position: camera.position.toArray(),
      target: controls.target.toArray(),
    });
    return () => {
      controls.removeEventListener('change', onChange);
      controls.dispose();
      cameraRef.current = null;
    };
  }, [controls, camera, invalidate, cameraRef]);

  useEffect(() => {
    // The canvas takes keyboard focus and has an accessible name (ML-UX-004).
    domElement.tabIndex = 0;
    domElement.setAttribute('role', 'img');
    domElement.setAttribute('aria-label', label);
  }, [domElement, label]);

  useEffect(() => {
    if (resetNonce > 0) {
      controls.reset();
    }
  }, [resetNonce, controls]);

  useEffect(() => {
    // Keyboard (ML-UX-004): arrows orbit, + and - zoom, Home resets, on the focused canvas.
    const up = new Vector3(0, 0, 1);
    const onKey = (event: KeyboardEvent) => {
      const offset = camera.position.clone().sub(controls.target);
      let handled = true;
      switch (event.key) {
        case 'ArrowLeft':
          offset.applyAxisAngle(up, KEY_ROTATE_STEP_RAD);
          break;
        case 'ArrowRight':
          offset.applyAxisAngle(up, -KEY_ROTATE_STEP_RAD);
          break;
        case 'ArrowUp':
        case 'ArrowDown': {
          const axis = new Vector3().crossVectors(up, offset).normalize();
          const next = offset
            .clone()
            .applyAxisAngle(
              axis,
              event.key === 'ArrowUp' ? -KEY_ROTATE_STEP_RAD : KEY_ROTATE_STEP_RAD,
            );
          const polar = next.angleTo(up);
          if (polar > 0.05 && polar < Math.PI - 0.05) {
            offset.copy(next);
          }
          break;
        }
        case '+':
        case '=':
          offset.multiplyScalar(1 / KEY_ZOOM_FACTOR);
          break;
        case '-':
          offset.multiplyScalar(KEY_ZOOM_FACTOR);
          break;
        case 'Home':
          controls.reset();
          event.preventDefault();
          return;
        default:
          handled = false;
      }
      if (!handled) {
        return;
      }
      event.preventDefault();
      const length = Math.min(
        Math.max(offset.length(), CAMERA_DISTANCE_LIMITS.min),
        CAMERA_DISTANCE_LIMITS.max,
      );
      offset.setLength(length);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      invalidate();
    };
    domElement.addEventListener('keydown', onKey);
    return () => {
      domElement.removeEventListener('keydown', onKey);
    };
  }, [camera, controls, domElement, invalidate]);

  return null;
}

export interface SceneCanvasProps {
  readonly geometry: SceneGeometry | null;
  readonly stale: boolean;
  readonly earthRadius_scene: number;
  readonly earthRotationZ_rad: number;
  readonly axesVisible: boolean;
  readonly spacecraftPosition: Float32Array | null;
  readonly resetNonce: number;
  readonly cameraRef: { current: (() => CameraSnapshot) | null };
  readonly label: string;
}

export function SceneCanvas(props: SceneCanvasProps) {
  const axes = useMemo(() => new AxesHelper(AXES_LENGTH), []);
  return (
    <Canvas
      frameloop="demand"
      camera={{
        position: [...INITIAL_CAMERA_POSITION],
        up: [0, 0, 1],
        fov: 45,
        near: 0.1,
        far: 2000,
      }}
      gl={{ antialias: true }}
      data-testid="scene-canvas"
      style={{ background: SCENE_COLORS.background }}
    >
      <color attach="background" args={[SCENE_COLORS.background]} />
      <Earth radius={props.earthRadius_scene} rotationZ_rad={props.earthRotationZ_rad} />
      {props.axesVisible && <primitive object={axes} name="inertial-axes" />}
      {props.geometry?.coastSegments.map((segment) => (
        <TrajectoryLine
          key={`coast-${String(segment.index)}`}
          segment={segment}
          stale={props.stale}
          name={`coast-segment-${String(segment.index)}`}
        />
      ))}
      {props.geometry?.segments.map((segment) => (
        <TrajectoryLine
          key={segment.index}
          segment={segment}
          stale={props.stale}
          name={`segment-${String(segment.index)}`}
        />
      ))}
      {props.geometry?.maneuverMarkers.map((marker) => (
        <PointMarker
          key={marker.maneuverId}
          position={marker.position}
          color={SCENE_COLORS.maneuverMarker}
          sizePx={MARKER_SIZE_PX.maneuver}
          name={`maneuver-marker-${marker.maneuverId}`}
        />
      ))}
      {props.spacecraftPosition !== null && (
        <PointMarker
          position={props.spacecraftPosition}
          color={SCENE_COLORS.spacecraft}
          sizePx={MARKER_SIZE_PX.spacecraft}
          name="spacecraft-marker"
        />
      )}
      <CameraRig resetNonce={props.resetNonce} cameraRef={props.cameraRef} label={props.label} />
    </Canvas>
  );
}
