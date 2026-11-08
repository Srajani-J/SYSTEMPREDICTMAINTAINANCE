
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Float,
  Html,
  Sparkles,
} from "@react-three/drei";

/* ROTATING SHAFT */
function RotatingShaft() {
  const shaftRef = useRef();

  useFrame(() => {
    if (shaftRef.current) {
      shaftRef.current.rotation.z += 0.025;
    }
  });

  return (
    <mesh
      ref={shaftRef}
      position={[0, 0, 1.08]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <cylinderGeometry args={[0.32, 0.32, 1.5, 32]} />
      <meshStandardMaterial
        color="#42d9ff"
        emissive="#008fc4"
        emissiveIntensity={0.8}
        metalness={0.9}
        roughness={0.18}
      />
    </mesh>
  );
}

/* ANIMATED AI CORE */
function AICore() {
  const coreRef = useRef();

  useFrame((state) => {
    if (coreRef.current) {
      const pulse =
        1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.07;

      coreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={coreRef} position={[0, 0, 1.56]}>
      <sphereGeometry args={[0.42, 32, 32]} />
      <meshStandardMaterial
        color="#32d9ff"
        emissive="#00bfff"
        emissiveIntensity={2.2}
        metalness={0.35}
        roughness={0.15}
      />
    </mesh>
  );
}

/* ANIMATED ENERGY RINGS */
function EnergyRings() {
  const ring1Ref = useRef();
  const ring2Ref = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = time * 0.45;
      ring1Ref.current.rotation.y = time * 0.3;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -time * 0.35;
      ring2Ref.current.rotation.y = time * 0.4;
    }
  });

  return (
    <group position={[0, 0, 1.56]}>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[0.68, 0.025, 16, 64]} />
        <meshStandardMaterial
          color="#00d9ff"
          emissive="#00bfff"
          emissiveIntensity={2}
        />
      </mesh>

      <mesh
        ref={ring2Ref}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.82, 0.02, 16, 64]} />
        <meshStandardMaterial
          color="#008cff"
          emissive="#008cff"
          emissiveIntensity={1.7}
        />
      </mesh>
    </group>
  );
}

/* GLOWING SENSOR LIGHT */
function GlowingSensor({ position }) {
  const sensorRef = useRef();

  useFrame((state) => {
    if (sensorRef.current) {
      const pulse =
        1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;

      sensorRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={sensorRef} position={position}>
      <sphereGeometry args={[0.075, 20, 20]} />
      <meshStandardMaterial
        color="#42f5b3"
        emissive="#36e0a0"
        emissiveIntensity={2.5}
      />
    </mesh>
  );
}

/* 3D PARAMETER DISPLAY */
function ParameterIndicator({
  position,
  title,
  value,
  unit,
}) {
  return (
    <Html
      position={position}
      center
      distanceFactor={5}
      style={{ pointerEvents: "none" }}
    >
      <div className="sensor-label-card">
        <div
          style={{
            color: "#00cfff",
            fontSize: "9px",
            fontWeight: "700",
            letterSpacing: "1px",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#ffffff",
            fontSize: "17px",
            fontWeight: "800",
            marginTop: "3px",
            whiteSpace: "nowrap",
          }}
        >
          {value != null ? `${value} ${unit}` : "N/A"}
        </div>

        <div
          style={{
            color: "#36e0a0",
            fontSize: "9px",
            marginTop: "3px",
            fontWeight: "700",
            whiteSpace: "nowrap",
          }}
        >
          ● PROFILE VALUE
        </div>
      </div>
    </Html>
  );
}

/* INDUSTRIAL MACHINE MODEL */
function Machine({ machine }) {
  const temperature = machine?.temperature;
  const rpm = machine?.rpm ?? machine?.speed;
  const torque = machine?.torque;

  const formatValue = (value, digits = 1) =>
    value != null && Number.isFinite(Number(value))
      ? Number(value).toFixed(digits)
      : null;

  return (
    <group position={[0, -0.2, 0]}>
      {/* MAIN MACHINE BODY */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.4, 1.9, 2]} />
        <meshStandardMaterial
          color="#10466a"
          metalness={0.82}
          roughness={0.25}
        />
      </mesh>

      {/* FRONT PANEL */}
      <mesh position={[0, 0, 1.05]}>
        <boxGeometry args={[1.95, 1.45, 0.12]} />
        <meshStandardMaterial
          color="#082943"
          metalness={0.82}
          roughness={0.22}
        />
      </mesh>

      {/* CYAN PANEL */}
      <mesh position={[0, 0, 1.12]}>
        <boxGeometry args={[1.6, 1.08, 0.025]} />
        <meshStandardMaterial
          color="#08739b"
          emissive="#006f9c"
          emissiveIntensity={0.65}
          metalness={0.7}
          roughness={0.22}
        />
      </mesh>

      {/* INNER AI PANEL */}
      <mesh position={[0, 0, 1.145]}>
        <boxGeometry args={[1.35, 0.85, 0.018]} />
        <meshStandardMaterial
          color="#06243b"
          emissive="#003e5a"
          emissiveIntensity={0.35}
          metalness={0.65}
          roughness={0.2}
        />
      </mesh>

      <AICore />
      <EnergyRings />
      <RotatingShaft />

      {/* TOP PANEL */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[2.25, 0.16, 1.8]} />
        <meshStandardMaterial
          color="#155074"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* TOP GLOW STRIP */}
      <mesh position={[0, 1.145, 0]}>
        <boxGeometry args={[1.75, 0.025, 1.35]} />
        <meshStandardMaterial
          color="#087ea8"
          emissive="#00bfff"
          emissiveIntensity={0.7}
        />
      </mesh>

      <GlowingSensor position={[0, 1.2, 0]} />

      {/* SIDE PANELS */}
      <mesh position={[-1.28, 0, 0]}>
        <boxGeometry args={[0.12, 1.6, 1.65]} />
        <meshStandardMaterial
          color="#0d3b5c"
          metalness={0.85}
          roughness={0.27}
        />
      </mesh>

      <mesh position={[1.28, 0, 0]}>
        <boxGeometry args={[0.12, 1.6, 1.65]} />
        <meshStandardMaterial
          color="#0d3b5c"
          metalness={0.85}
          roughness={0.27}
        />
      </mesh>

      {/* MACHINE SUPPORTS */}
      <mesh position={[-0.9, -1.2, 0]}>
        <boxGeometry args={[0.22, 0.55, 1.45]} />
        <meshStandardMaterial color="#0a304b" metalness={0.88} />
      </mesh>

      <mesh position={[0.9, -1.2, 0]}>
        <boxGeometry args={[0.22, 0.55, 1.45]} />
        <meshStandardMaterial color="#0a304b" metalness={0.88} />
      </mesh>

      {/* MACHINE BASE */}
      <mesh position={[0, -1.48, 0]}>
        <boxGeometry args={[3, 0.2, 2.3]} />
        <meshStandardMaterial
          color="#0b2c45"
          metalness={0.92}
          roughness={0.25}
        />
      </mesh>

      {/* BASE GLOW */}
      <mesh position={[0, -1.37, 0]}>
        <boxGeometry args={[2.35, 0.025, 1.7]} />
        <meshStandardMaterial
          color="#008bb8"
          emissive="#00bfff"
          emissiveIntensity={1}
        />
      </mesh>

      {/* SENSOR LIGHTS */}
      <GlowingSensor position={[-0.88, 0.72, 1.15]} />
      <GlowingSensor position={[0.88, 0.72, 1.15]} />
      <GlowingSensor position={[-0.88, -0.65, 1.15]} />

      {/* AVAILABLE OPERATING PARAMETERS ONLY */}
      <ParameterIndicator
        position={[-1.65, 0.9, 0.8]}
        title="AIR TEMPERATURE"
        value={formatValue(temperature, 2)}
        unit="°C"
      />

      <ParameterIndicator
        position={[1.65, 0.55, 0.9]}
        title="ROTATIONAL SPEED"
        value={formatValue(rpm, 0)}
        unit="RPM"
      />

      <ParameterIndicator
        position={[-1.65, -0.75, 0.9]}
        title="TORQUE"
        value={formatValue(torque, 2)}
        unit="Nm"
      />
    </group>
  );
}

/* MAIN 3D SCENE */
function ThreeDScene({ machine }) {
  return (
    <div className="hero-3d">
      <Canvas
        camera={{
          position: [4.5, 2.5, 6.5],
          fov: 42,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={1.15} />

        <directionalLight
          position={[5, 6, 6]}
          intensity={2.4}
        />

        <pointLight
          position={[3, 2, 4]}
          color="#00bfff"
          intensity={11}
          distance={10}
        />

        <pointLight
          position={[-3, 1, 2]}
          color="#087fff"
          intensity={8}
          distance={8}
        />

        <pointLight
          position={[0, -3, 2]}
          color="#00bfff"
          intensity={5}
          distance={7}
        />

        <Sparkles
          count={75}
          scale={[6, 5, 6]}
          size={1.5}
          speed={0.25}
        />

        <Float
          speed={1}
          rotationIntensity={0.08}
          floatIntensity={0.2}
        >
          <Machine machine={machine} />
        </Float>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.35}
          minPolarAngle={Math.PI / 2.7}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}

export default ThreeDScene;
