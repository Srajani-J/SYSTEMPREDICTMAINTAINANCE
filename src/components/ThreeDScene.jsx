import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Html } from "@react-three/drei";
import { useRef } from "react";


// =====================================================
// ROTATING MACHINE SHAFT
// =====================================================

function RotatingShaft() {
  const shaftRef = useRef();

  useFrame(() => {
    if (shaftRef.current) {
      shaftRef.current.rotation.x += 0.04;
    }
  });

  return (
    <mesh
      ref={shaftRef}
      position={[0, 0, 1.25]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <cylinderGeometry args={[0.55, 0.55, 0.35, 32]} />

      <meshStandardMaterial
        color="#00bfff"
        metalness={0.85}
        roughness={0.2}
        emissive="#00bfff"
        emissiveIntensity={1.5}
      />
    </mesh>
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
      Math.sin(clock.getElapsedTime() * 4) *
      0.2;

    if (sensorRef.current) {
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
      <sphereGeometry args={[0.14, 24, 24]} />

      <meshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        emissiveIntensity={5}
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
      speed={1.5}
      rotationIntensity={0.15}
      floatIntensity={0.5}
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
            metalness={0.85}
            roughness={0.25}
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
            metalness={0.75}
            roughness={0.2}
          />

        </mesh>


        {/* ==========================================
            AI CORE
        ========================================== */}

        <mesh position={[0, 0, 1.17]}>

          <sphereGeometry
            args={[0.48, 32, 32]}
          />

          <meshStandardMaterial
            color="#00bfff"
            emissive="#00bfff"
            emissiveIntensity={3}
            metalness={0.4}
            roughness={0.15}
          />

        </mesh>


        {/* ==========================================
            ROTATING SHAFT
        ========================================== */}

        <RotatingShaft />


        {/* ==========================================
            TOP SENSOR
        ========================================== */}

        <mesh position={[0, 1.35, 0]}>

          <cylinderGeometry
            args={[0.18, 0.18, 0.35, 32]}
          />

          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={3}
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
            MACHINE SUPPORT - LEFT
        ========================================== */}

        <mesh
          position={[-1.15, -1.25, 0]}
        >

          <boxGeometry
            args={[0.5, 0.5, 1.5]}
          />

          <meshStandardMaterial
            color="#082f49"
            metalness={0.9}
            roughness={0.3}
          />

        </mesh>


        {/* ==========================================
            MACHINE SUPPORT - RIGHT
        ========================================== */}

        <mesh
          position={[1.15, -1.25, 0]}
        >

          <boxGeometry
            args={[0.5, 0.5, 1.5]}
          />

          <meshStandardMaterial
            color="#082f49"
            metalness={0.9}
            roughness={0.3}
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
            metalness={0.95}
            roughness={0.25}
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
            emissiveIntensity={1.5}
          />

        </mesh>


        {/* ==========================================
            TOP COMPONENT
        ========================================== */}

        <mesh
          position={[0.8, 1.2, 0]}
        >

          <boxGeometry
            args={[0.35, 0.35, 0.35]}
          />

          <meshStandardMaterial
            color="#0ea5e9"
            metalness={0.7}
            roughness={0.2}
          />

        </mesh>


        {/* ==========================================
            LEFT TOP COMPONENT
        ========================================== */}

        <mesh
          position={[-0.8, 1.1, 0]}
        >

          <boxGeometry
            args={[0.3, 0.3, 0.3]}
          />

          <meshStandardMaterial
            color="#0ea5e9"
            metalness={0.7}
            roughness={0.2}
          />

        </mesh>


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
      >

        {/* ==========================================
            LIGHTING
        ========================================== */}

        <ambientLight
          intensity={1.5}
        />

        <pointLight
          position={[5, 5, 5]}
          intensity={100}
        />

        <pointLight
          position={[-5, 2, 3]}
          intensity={60}
        />

        <pointLight
          position={[0, -3, 4]}
          intensity={50}
        />


        {/* ==========================================
            INDUSTRIAL MACHINE
        ========================================== */}

        <Machine />


        {/* ==========================================
            CAMERA
        ========================================== */}

        <OrbitControls
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.8}
        />

      </Canvas>

    </div>
  );
}


export default ThreeDScene;