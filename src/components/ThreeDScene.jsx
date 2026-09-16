import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Float,
  Html,
  Sparkles,
} from "@react-three/drei";
import { useRef } from "react";

// =====================================================
// ROTATING MACHINE SHAFT
// =====================================================

function RotatingShaft() {
  const shaftRef = useRef();

  useFrame(() => {
    if (shaftRef.current) {
      shaftRef.current.rotation.z += 0.045;
    }
  });

  return (
    <group position={[0, 0, 1.28]}>
      <mesh ref={shaftRef}>
        <cylinderGeometry args={[0.55, 0.55, 0.28, 32]} />

        <meshStandardMaterial
          color="#00bfff"
          metalness={0.9}
          roughness={0.18}
          emissive="#00bfff"
          emissiveIntensity={2}
        />
      </mesh>

      {/* Inner shaft */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.45, 32]} />

        <meshStandardMaterial
          color="#e0f7ff"
          metalness={0.9}
          roughness={0.15}
          emissive="#00bfff"
          emissiveIntensity={1}
        />
      </mesh>
    </group>
  );
}

// =====================================================
// AI ENERGY RINGS
// =====================================================

function EnergyRings() {
  const ring1 = useRef();
  const ring2 = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (ring1.current) {
      ring1.current.rotation.z = t * 0.8;
      ring1.current.rotation.x = Math.sin(t) * 0.2;
    }

    if (ring2.current) {
      ring2.current.rotation.z = -t * 0.6;
      ring2.current.rotation.y = Math.cos(t) * 0.2;
    }
  });

  return (
    <group position={[0, 0, 1.3]}>

      <mesh ref={ring1}>
        <torusGeometry args={[0.72, 0.035, 16, 64]} />

        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={4}
          metalness={0.5}
          roughness={0.1}
        />
      </mesh>

      <mesh
        ref={ring2}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.85, 0.025, 16, 64]} />

        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0ea5e9"
          emissiveIntensity={3}
          metalness={0.5}
          roughness={0.1}
        />
      </mesh>

    </group>
  );
}

// =====================================================
// SENSOR INDICATOR
// =====================================================

function SensorIndicator({
  position,
  title,
  value,
  status,
}) {
  return (
    <Html
      position={position}
      distanceFactor={6}
      center
    >
      <div className="sensor-label-card">

        <div className="sensor-name">
          {title}
        </div>

        <div className="sensor-number">
          {value}
        </div>

        <div className="sensor-live">
          ● {status}
        </div>

      </div>
    </Html>
  );
}

// =====================================================
// GLOWING SENSOR
// =====================================================

function GlowingSensor({ position }) {
  const sensorRef = useRef();

  useFrame(({ clock }) => {
    const pulse =
      1 +
      Math.sin(clock.getElapsedTime() * 4) * 0.25;

    if (sensorRef.current) {
      sensorRef.current.scale.set(
        pulse,
        pulse,
        pulse
      );
    }
  });

  return (
    <group position={position}>

      <mesh ref={sensorRef}>
        <sphereGeometry args={[0.14, 24, 24]} />

        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={6}
        />
      </mesh>

      {/* Sensor glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.025, 12, 32]} />

        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={4}
        />
      </mesh>

    </group>
  );
}

// =====================================================
// MACHINE PANEL
// =====================================================

function MachinePanel({ position, rotation }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[0.55, 0.75, 0.08]} />

      <meshStandardMaterial
        color="#0b2940"
        metalness={0.85}
        roughness={0.2}
        emissive="#063b5c"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

// =====================================================
// INDUSTRIAL MACHINE
// =====================================================

function Machine() {
  return (
    <Float
      speed={1.2}
      rotationIntensity={0.12}
      floatIntensity={0.35}
    >

      <group>

        {/* ==========================================
            MAIN MACHINE BODY
        ========================================== */}

        <mesh position={[0, 0, 0]}>

          <boxGeometry
            args={[3.2, 2, 2]}
          />

          <meshStandardMaterial
            color="#075985"
            metalness={0.9}
            roughness={0.22}
          />

        </mesh>


        {/* ==========================================
            TOP METAL PANEL
        ========================================== */}

        <mesh position={[0, 1.02, 0]}>

          <boxGeometry
            args={[2.9, 0.12, 1.8]}
          />

          <meshStandardMaterial
            color="#0c4a6e"
            metalness={0.95}
            roughness={0.18}
          />

        </mesh>


        {/* ==========================================
            FRONT PANEL
        ========================================== */}

        <mesh position={[0, 0, 1.05]}>

          <boxGeometry
            args={[2.5, 1.45, 0.15]}
          />

          <meshStandardMaterial
            color="#02182d"
            metalness={0.85}
            roughness={0.16}
          />

        </mesh>


        {/* ==========================================
            FRONT PANEL FRAME
        ========================================== */}

        <mesh position={[0, 0, 1.15]}>

          <boxGeometry
            args={[2.15, 1.12, 0.04]}
          />

          <meshStandardMaterial
            color="#0c334d"
            metalness={0.7}
            roughness={0.25}
          />

        </mesh>


        {/* ==========================================
            AI CORE
        ========================================== */}

        <mesh position={[0, 0, 1.23]}>

          <sphereGeometry
            args={[0.45, 40, 40]}
          />

          <meshStandardMaterial
            color="#00bfff"
            emissive="#00bfff"
            emissiveIntensity={4}
            metalness={0.5}
            roughness={0.12}
          />

        </mesh>


        {/* ==========================================
            AI CORE RINGS
        ========================================== */}

        <EnergyRings />


        {/* ==========================================
            ROTATING SHAFT
        ========================================== */}

        <RotatingShaft />


        {/* ==========================================
            TOP SENSOR HOUSING
        ========================================== */}

        <mesh position={[0, 1.35, 0]}>

          <cylinderGeometry
            args={[0.18, 0.18, 0.35, 32]}
          />

          <meshStandardMaterial
            color="#0ea5e9"
            metalness={0.8}
            roughness={0.2}
            emissive="#00ffff"
            emissiveIntensity={2}
          />

        </mesh>


        <GlowingSensor
          position={[0, 1.58, 0]}
        />


        {/* ==========================================
            LEFT SENSOR
        ========================================== */}

        <GlowingSensor
          position={[-1.75, 0.45, 0]}
        />


        {/* ==========================================
            RIGHT SENSOR
        ========================================== */}

        <GlowingSensor
          position={[1.75, 0.45, 0]}
        />


        {/* ==========================================
            MACHINE SIDE PANELS
        ========================================== */}

        <MachinePanel
          position={[-1.63, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />

        <MachinePanel
          position={[1.63, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />


        {/* ==========================================
            LEFT SUPPORT
        ========================================== */}

        <mesh
          position={[-1.15, -1.25, 0]}
        >

          <boxGeometry
            args={[0.5, 0.5, 1.5]}
          />

          <meshStandardMaterial
            color="#082f49"
            metalness={0.95}
            roughness={0.25}
          />

        </mesh>


        {/* ==========================================
            RIGHT SUPPORT
        ========================================== */}

        <mesh
          position={[1.15, -1.25, 0]}
        >

          <boxGeometry
            args={[0.5, 0.5, 1.5]}
          />

          <meshStandardMaterial
            color="#082f49"
            metalness={0.95}
            roughness={0.25}
          />

        </mesh>


        {/* ==========================================
            MACHINE BASE
        ========================================== */}

        <mesh
          position={[0, -1.55, 0]}
        >

          <boxGeometry
            args={[4.2, 0.3, 2.6]}
          />

          <meshStandardMaterial
            color="#031525"
            metalness={0.98}
            roughness={0.2}
          />

        </mesh>


        {/* ==========================================
            BASE GLOW
        ========================================== */}

        <mesh
          position={[0, -1.35, 0]}
        >

          <boxGeometry
            args={[3.6, 0.08, 2.1]}
          />

          <meshStandardMaterial
            color="#00bfff"
            emissive="#00bfff"
            emissiveIntensity={2.5}
          />

        </mesh>


        {/* ==========================================
            TOP COMPONENTS
        ========================================== */}

        <mesh
          position={[0.8, 1.2, 0]}
        >

          <boxGeometry
            args={[0.35, 0.35, 0.35]}
          />

          <meshStandardMaterial
            color="#0ea5e9"
            metalness={0.8}
            roughness={0.18}
            emissive="#0369a1"
            emissiveIntensity={1}
          />

        </mesh>


        <mesh
          position={[-0.8, 1.1, 0]}
        >

          <boxGeometry
            args={[0.3, 0.3, 0.3]}
          />

          <meshStandardMaterial
            color="#0ea5e9"
            metalness={0.8}
            roughness={0.18}
            emissive="#0369a1"
            emissiveIntensity={1}
          />

        </mesh>


        {/* ==========================================
            FRONT STATUS LIGHTS
        ========================================== */}

        <GlowingSensor
          position={[-0.8, -0.55, 1.2]}
        />

        <GlowingSensor
          position={[0.8, -0.55, 1.2]}
        />


        {/* ==========================================
            SENSOR INFORMATION
        ========================================== */}

        <SensorIndicator
          position={[1.45, 1.25, 1]}
          title="TEMPERATURE"
          value="72°C"
          status="LIVE"
        />


        <SensorIndicator
          position={[-2.15, 0.8, 0.5]}
          title="VIBRATION"
          value="1.8 mm/s"
          status="NORMAL"
        />


        <SensorIndicator
          position={[1.9, -0.8, 0.5]}
          title="MOTOR HEALTH"
          value="98%"
          status="HEALTHY"
        />

      </group>

    </Float>
  );
}

// =====================================================
// MAIN 3D SCENE
// =====================================================

function ThreeDScene() {

  return (
    <div className="three-d-container">

      <Canvas
        camera={{
          position: [5, 3, 6],
          fov: 45,
        }}
        dpr={[1, 2]}
      >

        {/* ==========================================
            LIGHTING
        ========================================== */}

        <ambientLight
          intensity={1.2}
        />

        <pointLight
          position={[5, 5, 5]}
          intensity={120}
        />

        <pointLight
          position={[-5, 2, 3]}
          intensity={80}
        />

        <pointLight
          position={[0, -3, 4]}
          intensity={60}
        />

        <pointLight
          position={[0, 4, -3]}
          intensity={50}
        />


        {/* ==========================================
            FLOATING AI PARTICLES
        ========================================== */}

        <Sparkles
          count={80}
          scale={[8, 6, 6]}
          size={2}
          speed={0.35}
        />


        {/* ==========================================
            INDUSTRIAL MACHINE
        ========================================== */}

        <Machine />


        {/* ==========================================
            CAMERA CONTROLS
        ========================================== */}

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.7}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />

      </Canvas>

    </div>
  );
}

export default ThreeDScene;