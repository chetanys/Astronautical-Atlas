const canvas = document.querySelector("#roverCanvas");
const fallback = document.querySelector("#roverModelFallback");
const schematic = document.querySelector(".schematic-rover");

let roverGroup = null;
let renderer = null;
let autoRotate = false;
let dragging = false;
let lastPointer = null;
let fallbackRotation = 0;
let fallbackTilt = 0;

function updateFallbackView(action, value) {
  if (action === "rotate") fallbackRotation += value * 45;
  if (action === "top") fallbackTilt = -18;
  if (action === "reset") {
    fallbackRotation = 0;
    fallbackTilt = 0;
  }
  schematic.style.transform =
    `perspective(700px) rotateX(${fallbackTilt}deg) rotateY(${fallbackRotation}deg)`;
}

document.addEventListener("rover-view", event => {
  const { action, value } = event.detail;
  if (roverGroup) {
    if (action === "rotate") roverGroup.rotation.y += value;
    if (action === "top") roverGroup.rotation.x = -0.5;
    if (action === "reset") {
      roverGroup.rotation.set(0, 0.6, 0);
    }
    if (action === "autoRotate") autoRotate = value;
  } else {
    updateFallbackView(action, value);
  }
});

function createRover(THREE, scene) {
  const rover = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xc98d36, metalness: 0.38, roughness: 0.48
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x253442, metalness: 0.65, roughness: 0.4
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x256284, metalness: 0.48, roughness: 0.28
  });
  const brightMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9d7e8, metalness: 0.72, roughness: 0.24
  });

  function box(width, height, depth, material, position, parent = rover) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinderBetween(start, end, radius, material) {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(to, from);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 12),
      material
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );
    mesh.castShadow = true;
    rover.add(mesh);
  }

  box(2.2, 0.35, 1.25, darkMaterial, [0, 1.15, 0]);
  box(2.35, 0.14, 1.35, bodyMaterial, [0, 1.4, 0]);
  box(0.85, 0.06, 1.1, panelMaterial, [-0.62, 1.51, 0]);
  box(0.85, 0.06, 1.1, panelMaterial, [0.62, 1.51, 0]);

  for (const side of [-1, 1]) {
    for (const z of [-0.9, 0, 0.9]) {
      const x = side * (z === 0 ? 1.48 : 1.2);
      cylinderBetween([side * 0.92, 0.9, z * 0.72], [x, 0.52, z], 0.075, brightMaterial);
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.25, 20, 1),
        darkMaterial
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.48, z);
      wheel.castShadow = true;
      rover.add(wheel);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.27, 16),
        bodyMaterial
      );
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      rover.add(hub);
    }
  }

  box(0.18, 0.95, 0.18, darkMaterial, [0, 2.0, 0.08]);
  box(0.72, 0.35, 0.42, bodyMaterial, [0, 2.58, 0.08]);
  for (const x of [-0.2, 0.2]) {
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16),
      panelMaterial
    );
    lens.rotation.z = Math.PI / 2;
    lens.position.set(x, 2.58, 0.31);
    rover.add(lens);
  }
  cylinderBetween([0.72, 1.53, -0.3], [1.05, 2.15, -0.3], 0.04, brightMaterial);
  const antenna = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    brightMaterial
  );
  antenna.position.set(1.05, 2.25, -0.3);
  antenna.rotation.x = Math.PI;
  rover.add(antenna);
  scene.add(rover);
  return rover;
}

function resizeRenderer(THREE, camera) {
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

async function initializeRover() {
  try {
    const THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"
    );
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(5.2, 4.1, 6.7);
    camera.lookAt(0, 1.25, 0);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    resizeRenderer(THREE, camera);

    scene.add(new THREE.HemisphereLight(0xcde6ff, 0x4d3827, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x55bde2, 1.2);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);
    const ground = new THREE.GridHelper(12, 24, 0x31516a, 0x1b2c3b);
    ground.position.y = -0.03;
    scene.add(ground);
    roverGroup = createRover(THREE, scene);
    roverGroup.rotation.y = 0.6;
    fallback.classList.add("hidden");

    const resizeObserver = new ResizeObserver(() => resizeRenderer(THREE, camera));
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointerdown", event => {
      dragging = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (!dragging || !lastPointer) return;
      roverGroup.rotation.y += (event.clientX - lastPointer.x) * 0.008;
      roverGroup.rotation.x += (event.clientY - lastPointer.y) * 0.006;
      roverGroup.rotation.x = Math.max(-0.9, Math.min(0.9, roverGroup.rotation.x));
      lastPointer = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointerup", () => {
      dragging = false;
      lastPointer = null;
    });
    canvas.addEventListener("pointercancel", () => {
      dragging = false;
      lastPointer = null;
    });

    const render = () => {
      if (autoRotate && !dragging) roverGroup.rotation.y += 0.003;
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();
  } catch (error) {
    console.error("Could not initialize the code-built rover renderer.", error);
    fallback.classList.remove("hidden");
  }
}

initializeRover();
