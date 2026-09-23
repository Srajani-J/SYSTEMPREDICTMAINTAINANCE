import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Float,
  Html,
  Sparkles,
} from "@react-three/drei";
import { useRef } from "react";


/* =========================================================
   ROTATING SHAFT
========================================================= */

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


/* =========================================================
   AI CORE
========================================================= */

function AICore() {
  const coreRef = useRef();

  useFrame((state) => {
    if (coreRef.current) {
      const pulse =
        1 +
        Math.sin(state.clock.elapsedTime * 2.2) * 0.07;

      coreRef.current.scale.set(
        pulse,
        pulse,
        pulse
      );
    }
  });

  return (
    <mesh
      ref={coreRef}
      position={[0, 0, 1.56]}
    >
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


/* =========================================================
   AI ENERGY RINGS
========================================================= */

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
        <torusGeometry
          args={[0.68, 0.025, 16, 64]}
        />

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
        <torusGeometry
          args={[0.82, 0.02, 16, 64]}
        />

        <meshStandardMaterial
          color="#008cff"
          emissive="#008cff"
          emissiveIntensity={1.7}
        />
      </mesh>

    </group>
  );
}


/* =========================================================
   GLOWING SENSOR
========================================================= */

function GlowingSensor({ position }) {
  const sensorRef = useRef();

  useFrame((state) => {
    if (sensorRef.current) {
      const pulse =
        1 +
        Math.sin(state.clock.elapsedTime * 3) * 0.1;

      sensorRef.current.scale.set(
        pulse,
        pulse,
        pulse
      );
    }
  });

  return (
    <mesh
      ref={sensorRef}
      position={position}
    >
      <sphereGeometry args={[0.075, 20, 20]} />

      <meshStandardMaterial
        color="#42f5b3"
        emissive="#36e0a0"
        emissiveIntensity={2.5}
      />
    </mesh>
  );
}


/* =========================================================
   SENSOR HUD
========================================================= */

function SensorIndicator({
  position,
  title,
  value,
  status,
}) {
  return (
    <Html
      position={position}
      center
      distanceFactor={5}
      style={{
        pointerEvents: "none",
      }}
    >
      <div className="sensor-label-card">

        <div
          style={{
            color: "#00cfff",
            fontSize: "9px",
            fontWeight: "700",
            letterSpacing: "1px",
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
          {value}
        </div>

        <div
          style={{
            color: "#36e0a0",
            fontSize: "9px",
            marginTop: "3px",
            fontWeight: "700",
          }}
        >
          ● {status}
        </div>

      </div>
    </Html>
  );
}


/* =========================================================
   INDUSTRIAL MACHINE
========================================================= */

function Machine() {
  return (
    <group
      scale={[1, 1, 1]}
      position={[0, -0.2, 0]}
    >

      {/* MAIN MACHINE BODY */}

      <mesh position={[0, 0, 0]}>
        <boxGeometry
          args={[2.4, 1.9, 2]}
        />

        <meshStandardMaterial
          color="#10466a"
          metalness={0.82}
          roughness={0.25}
        />
      </mesh>


      {/* MAIN BODY FRONT */}

      <mesh
        position={[0, 0, 1.05]}
      >
        <boxGeometry
          args={[1.95, 1.45, 0.12]}
        />

        <meshStandardMaterial
          color="#082943"
          metalness={0.82}
          roughness={0.22}
        />
      </mesh>


      {/* FRONT CYAN PANEL */}

      <mesh
        position={[0, 0, 1.12]}
      >
        <boxGeometry
          args={[1.6, 1.08, 0.025]}
        />

        <meshStandardMaterial
          color="#08739b"
          emissive="#006f9c"
          emissiveIntensity={0.65}
          metalness={0.7}
          roughness={0.22}
        />
      </mesh>


      {/* INNER AI PANEL */}

      <mesh
        position={[0, 0, 1.145]}
      >
        <boxGeometry
          args={[1.35, 0.85, 0.018]}
        />

        <meshStandardMaterial
          color="#06243b"
          emissive="#003e5a"
          emissiveIntensity={0.35}
          metalness={0.65}
          roughness={0.2}
        />
      </mesh>


      {/* AI CORE */}

      <AICore />

      <EnergyRings />


      {/* ROTATING SHAFT */}

      <RotatingShaft />


      {/* TOP PANEL */}

      <mesh
        position={[0, 1.05, 0]}
      >
        <boxGeometry
          args={[2.25, 0.16, 1.8]}
        />

        <meshStandardMaterial
          color="#155074"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>


      {/* TOP CYAN STRIP */}

      <mesh
        position={[0, 1.145, 0]}
      >
        <boxGeometry
          args={[1.75, 0.025, 1.35]}
        />

        <meshStandardMaterial
          color="#087ea8"
          emissive="#00bfff"
          emissiveIntensity={0.7}
        />
      </mesh>


      {/* TOP SENSOR */}

      <GlowingSensor
        position={[0, 1.2, 0]}
      />


      {/* LEFT SIDE PANEL */}

      <mesh
        position={[-1.28, 0, 0]}
      >
        <boxGeometry
          args={[0.12, 1.6, 1.65]}
        />

        <meshStandardMaterial
          color="#0d3b5c"
          metalness={0.85}
          roughness={0.27}
        />
      </mesh>


      {/* RIGHT SIDE PANEL */}

      <mesh
        position={[1.28, 0, 0]}
      >
        <boxGeometry
          args={[0.12, 1.6, 1.65]}
        />

        <meshStandardMaterial
          color="#0d3b5c"
          metalness={0.85}
          roughness={0.27}
        />
      </mesh>


      {/* LEFT SUPPORT */}

      <mesh
        position={[-0.9, -1.2, 0]}
      >
        <boxGeometry
          args={[0.22, 0.55, 1.45]}
        />

        <meshStandardMaterial
          color="#0a304b"
          metalness={0.88}
          roughness={0.27}
        />
      </mesh>


      {/* RIGHT SUPPORT */}

      <mesh
        position={[0.9, -1.2, 0]}
      >
        <boxGeometry
          args={[0.22, 0.55, 1.45]}
        />

        <meshStandardMaterial
          color="#0a304b"
          metalness={0.88}
          roughness={0.27}
        />
      </mesh>


      {/* MACHINE BASE */}

      <mesh
        position={[0, -1.48, 0]}
      >
        <boxGeometry
          args={[3, 0.2, 2.3]}
        />

        <meshStandardMaterial
          color="#0b2c45"
          metalness={0.92}
          roughness={0.25}
        />
      </mesh>


      {/* BASE GLOW */}

      <mesh
        position={[0, -1.37, 0]}
      >
        <boxGeometry
          args={[2.35, 0.025, 1.7]}
        />

        <meshStandardMaterial
          color="#008bb8"
          emissive="#00bfff"
          emissiveIntensity={1}
        />
      </mesh>


      {/* SENSOR LIGHTS */}

      <GlowingSensor
        position={[-0.88, 0.72, 1.15]}
      />

      <GlowingSensor
        position={[0.88, 0.72, 1.15]}
      />

      <GlowingSensor
        position={[-0.88, -0.65, 1.15]}
      />


      {/* TEMPERATURE HUD */}

      <SensorIndicator
        position={[-1.65, 0.9, 0.8]}
        title="TEMPERATURE"
        value="72°C"
        status="LIVE"
      />


      {/* VIBRATION HUD */}

      <SensorIndicator
        position={[1.65, 0.55, 0.9]}
        title="VIBRATION"
        value="1.8 mm/s"
        status="NORMAL"
      />


      {/* MOTOR HEALTH HUD */}

      <SensorIndicator
        position={[-1.65, -0.75, 0.9]}
        title="MOTOR HEALTH"
        value="98%"
        status="HEALTHY"
      />

    </group>
  );
}


/* =========================================================
   MAIN 3D SCENE
========================================================= */

function ThreeDScene() {
  return (
    <div className="hero-3d">

      <Canvas
        camera={{
          position: [4.5, 2.5, 6.5],
          fov: 42,
        }}

        dpr={[1, 2]}

        gl={{
          antialias: true,
        }}
      >

        {/* AMBIENT LIGHT */}

        <ambientLight
          intensity={1.15}
        />


        {/* MAIN WHITE LIGHT */}

        <directionalLight
          position={[5, 6, 6]}
          intensity={2.4}
        />


        {/* CYAN LIGHT */}

        <pointLight
          position={[3, 2, 4]}
          color="#00bfff"
          intensity={11}
          distance={10}
        />


        {/* BLUE SIDE LIGHT */}

        <pointLight
          position={[-3, 1, 2]}
          color="#087fff"
          intensity={8}
          distance={8}
        />


        {/* FLOOR LIGHT */}

        <pointLight
          position={[0, -3, 2]}
          color="#00bfff"
          intensity={5}
          distance={7}
        />


        {/* FLOATING PARTICLES */}

        <Sparkles
          count={75}
          scale={[6, 5, 6]}
          size={1.5}
          speed={0.25}
        />


        {/* FLOATING MACHINE */}

        <Float
          speed={1}
          rotationIntensity={0.08}
          floatIntensity={0.2}
        >
          <Machine />
        </Float>


        {/* CAMERA */}

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={true}
          autoRotateSpeed={0.35}
          minPolarAngle={Math.PI / 2.7}
          maxPolarAngle={Math.PI / 1.9}
        />

      </Canvas>

    </div>
  );
}


export default ThreeDScene;