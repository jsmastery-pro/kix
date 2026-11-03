// The product page's 3D view (plan 11): a React Three Fiber canvas showing the product's model from
// Wix Media, its parts colored by zone from the picked color's preset (plan 10's ProductModels).
// Loaded lazily by ProductGallery, only after a 3D press in the browser. Spin only: no zoom or pan,
// so the wheel keeps scrolling the page. Load errors throw to the gallery's error boundary.
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ElementRef, type KeyboardEvent } from 'react';
import { Box3, Color, MathUtils, NeutralToneMapping, PMREMGenerator, Vector3, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ProductModel, ZoneColors } from '../../wix/models/presets';

interface Props {
  url: string;
  parts: ProductModel['parts'];
  /** The preset's zone colors; null keeps the GLB's own colors. */
  zones: ZoneColors | null;
  /** The viewer's accessible name. */
  label: string;
  onReady: () => void;
  /** The first drag, to hide the hint. */
  onSpin: () => void;
  onContextLost: () => void;
}

// The side view the dev viewer uses, relative to the shoe's center (plan 10 turned every model toe-left).
const SIDE = new Vector3(0, 0.15, 1).normalize();
const KEY_STEP = Math.PI / 12;

type OrbitControlsImpl = ElementRef<typeof OrbitControls>;

// drei caches one parsed scene per URL for the page's life: clone each material once and keep its
// original color, so every recolor starts from the file's own colors.
const prepared = new WeakSet<Object3D>();
function meshesOf(scene: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  scene.traverse((o) => { if ((o as Mesh).isMesh) meshes.push(o as Mesh); });
  if (!prepared.has(scene)) {
    for (const mesh of meshes) {
      const material = (mesh.material as MeshStandardMaterial).clone();
      material.userData.original = material.color.clone();
      mesh.material = material;
    }
    prepared.add(scene);
  }
  return meshes;
}

function Lighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Frames the whole shoe side-on, then reports ready; refits when the canvas resizes. */
function Fit({ object, onFit }: { object: Object3D; onFit: () => void }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (!controls) return;
    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    const dims = box.getSize(new Vector3());
    const vfov = MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // The box fills a square frame edge to edge (the depth term leaves room to spin). A short, wide
    // frame (phones) gives the shoe more room and lifts the image (not the orbit pivot), so the pill
    // doesn't cover the sole.
    const wide = camera.aspect > 1;
    const margin = Math.max(1, Math.sqrt(camera.aspect));
    if (wide) camera.setViewOffset(size.width, size.height, 0, size.height * 0.08, size.width, size.height);
    else camera.clearViewOffset();
    const dist = margin * Math.max(dims.y / 2 / Math.tan(vfov / 2), dims.x / 2 / Math.tan(hfov / 2)) + dims.z / 2;
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(SIDE, dist);
    controls.update();
    invalidate();
    onFit();
  }, [object, camera, controls, size.width, size.height, invalidate, onFit]);
  return null;
}

function Shoe({ url, parts, zones, onReady }: Pick<Props, 'url' | 'parts' | 'zones' | 'onReady'>) {
  const { scene } = useGLTF(url, false);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const zoneOf = new Map(parts.map((p) => [p.node, p.zone]));
    for (const mesh of meshesOf(scene)) {
      const material = mesh.material as MeshStandardMaterial;
      material.color.copy(material.userData.original as Color);
      const zone = zoneOf.get(mesh.name);
      const hex = zone ? zones?.[zone] : undefined;
      if (hex) material.color.set(hex);
    }
    invalidate();
  }, [scene, parts, zones, invalidate]);

  return (
    <>
      <primitive object={scene} />
      <Fit object={scene} onFit={onReady} />
    </>
  );
}

/** Reports a lost WebGL context. Removed on unmount, before R3F force-loses the context itself. */
function ContextLoss({ onLost }: { onLost: () => void }) {
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [canvas, onLost]);
  return null;
}

export default function ShoeViewer({ url, parts, zones, label, onReady, onSpin, onContextLost }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [ready, setReady] = useState(false);
  const [reducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const handleReady = useCallback(() => {
    setReady(true);
    onReady();
  }, [onReady]);

  const onKeyDown = (event: KeyboardEvent) => {
    const controls = controlsRef.current;
    const step = event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : 0;
    if (!controls || !step) return;
    event.preventDefault();
    controls.setAzimuthalAngle(controls.getAzimuthalAngle() + step);
    onSpin();
  };

  return (
    <div className={`ui-gallery__stage${ready ? ' is-ready' : ''}`} role="group" aria-roledescription="3D viewer" aria-label={label} aria-hidden={!ready} tabIndex={ready ? 0 : -1} onKeyDown={onKeyDown}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, near: 0.01, far: 100 }} gl={{ alpha: true, toneMapping: NeutralToneMapping }}>
        <Lighting />
        <ContextLoss onLost={onContextLost} />
        <Shoe url={url} parts={parts} zones={zones} onReady={handleReady} />
        <OrbitControls ref={controlsRef} makeDefault enableZoom={false} enablePan={false} enableDamping={!reducedMotion} onStart={onSpin} />
      </Canvas>
    </div>
  );
}
