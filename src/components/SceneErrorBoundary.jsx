import { Component } from "react";

/**
 * Isolates 3D rendering failures.
 *
 * WebGL can be unavailable (unsupported browser, blocklisted GPU driver, lost
 * context). Without a boundary, one failed canvas unmounts the whole route.
 */
class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("3D scene failed to render:", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <p style={{ padding: "24px", opacity: 0.8 }}>
          The interactive 3D machine preview is unavailable in this browser.
          All sensor data and predictions remain fully functional.
        </p>
      );
    }

    return this.props.children;
  }
}

export default SceneErrorBoundary;
