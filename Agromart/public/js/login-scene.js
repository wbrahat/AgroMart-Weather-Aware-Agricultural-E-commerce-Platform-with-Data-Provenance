import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";

function createFarmer() {
  const group = new THREE.Group();

  const shirt = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.92, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x335d3f, roughness: 0.85 })
  );
  shirt.position.y = 2.0;

  const lungi = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 0.72, 10),
    new THREE.MeshStandardMaterial({ color: 0x6d8976, roughness: 0.9 })
  );
  lungi.position.y = 1.28;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x7c5a3b, roughness: 0.8 })
  );
  head.position.y = 2.72;

  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0xb99a64, roughness: 0.9 })
  );
  hat.position.set(0, 2.9, 0);
  hat.rotation.x = Math.PI;

  const armGeo = new THREE.CapsuleGeometry(0.07, 0.52, 3, 6);
  const legGeo = new THREE.CapsuleGeometry(0.08, 0.62, 3, 6);
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x7c5a3b, roughness: 0.82 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x2f573b, roughness: 0.88 });

  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.36, 2.28, 0);
  rightArmPivot.position.set(0.36, 2.28, 0);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.y = -0.34;
  rightArm.position.y = -0.34;
  leftArmPivot.add(leftArm);
  rightArmPivot.add(rightArm);

  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, 1.12, 0.02);
  rightLegPivot.position.set(0.14, 1.12, 0.02);
  const leftLeg = new THREE.Mesh(legGeo, clothMat);
  const rightLeg = new THREE.Mesh(legGeo, clothMat);
  leftLeg.position.y = -0.44;
  rightLeg.position.y = -0.44;
  leftLegPivot.add(leftLeg);
  rightLegPivot.add(rightLeg);

  group.add(shirt, lungi, head, hat, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot);
  group.userData = { leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot };
  group.castShadow = true;
  group.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return group;
}

function createCow() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xd8d3c3, roughness: 0.88 })
  );
  body.position.y = 1.05;

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.6, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xd8d3c3, roughness: 0.88 })
  );
  neck.position.set(0.9, 1.15, 0);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.42, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xcfcab9, roughness: 0.88 })
  );
  head.position.set(1.22, 1.2, 0);

  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a2, roughness: 0.9 });
  const leg1 = new THREE.Mesh(legGeo, legMat);
  const leg2 = leg1.clone();
  const leg3 = leg1.clone();
  const leg4 = leg1.clone();
  leg1.position.set(-0.55, 0.45, -0.22);
  leg2.position.set(-0.55, 0.45, 0.22);
  leg3.position.set(0.5, 0.45, -0.22);
  leg4.position.set(0.5, 0.45, 0.22);

  group.add(body, neck, head, leg1, leg2, leg3, leg4);
  group.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return group;
}

function createTree() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 1.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c3d25, roughness: 1 })
  );
  trunk.position.y = 0.95;

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x2e7b3d, roughness: 0.9 })
  );
  crown.position.y = 2.3;

  group.add(trunk, crown);
  group.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return group;
}

function createParticleSystem(count, size, color) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = Math.random() * 22 + 0.4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    speeds[i] = Math.random() * 0.18 + 0.04;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return {
    points: new THREE.Points(geometry, material),
    speeds,
    positions
  };
}

export function initAgroScene(options = {}) {
  const canvas = document.getElementById(options.canvasId || "three-canvas");
  if (!canvas) return null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 240);
  camera.position.set(0, 7.4, 24);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemiLight = new THREE.HemisphereLight(0x9ed9ff, 0x2e6a3e, 1);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff0b8, 1.1);
  sunLight.position.set(18, 28, 8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 120;
  sunLight.shadow.camera.left = -36;
  sunLight.shadow.camera.right = 36;
  sunLight.shadow.camera.top = 36;
  sunLight.shadow.camera.bottom = -36;
  scene.add(sunLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.34);
  scene.add(ambient);

  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3f9c4f, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const fieldMaterial = new THREE.MeshStandardMaterial({ color: 0x6dbb3b, roughness: 0.95, metalness: 0 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(68, 52), fieldMaterial);
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0.03, 8);
  field.receiveShadow = true;
  scene.add(field);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 56),
    new THREE.MeshStandardMaterial({ color: 0x8b6947, roughness: 0.96 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(-16, 0.045, 6);
  road.receiveShadow = true;
  scene.add(road);

  const canalGeometry = new THREE.PlaneGeometry(8, 56, 30, 140);
  const canal = new THREE.Mesh(
    canalGeometry,
    new THREE.MeshStandardMaterial({ color: 0x5ea8d8, transparent: true, opacity: 0.36, roughness: 0.18, metalness: 0.08 })
  );
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(15, 0.06, 6);
  scene.add(canal);
  const canalPos = canalGeometry.attributes.position;
  const canalBase = new Float32Array(canalPos.array);

  const cropGroup = new THREE.Group();
  const cropMaterial = new THREE.MeshStandardMaterial({ color: 0x8ccf3a, roughness: 0.92 });
  const cropGeo = new THREE.BoxGeometry(0.06, 1.05, 0.06);

  for (let i = 0; i < 450; i += 1) {
    const blade = new THREE.Mesh(cropGeo, cropMaterial);
    blade.position.set((Math.random() - 0.5) * 56, 0.55, Math.random() * 40 - 2);
    blade.rotation.z = (Math.random() - 0.5) * 0.25;
    blade.castShadow = true;
    cropGroup.add(blade);
  }
  scene.add(cropGroup);

  const houses = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const hut = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xb9a57a, roughness: 1 })
    );
    base.position.y = 0.75;

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.95, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x7a4e2d, roughness: 1 })
    );
    roof.position.y = 2.1;
    roof.rotation.y = Math.PI * 0.25;

    hut.add(base, roof);
    hut.position.set(-30 + i * 5.5, 0, -17 - (i % 2) * 3);
    hut.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    houses.add(hut);
  }
  scene.add(houses);

  const treeLine = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    const tree = createTree();
    tree.position.set(-34 + i * 6, 0, -22 + (Math.random() - 0.5) * 4);
    treeLine.add(tree);
  }
  scene.add(treeLine);

  const farmer = createFarmer();
  farmer.position.set(-12, 0, 6);
  scene.add(farmer);

  const cow = createCow();
  cow.position.set(8, 0, 3);
  cow.rotation.y = -0.4;
  scene.add(cow);

  const rain = createParticleSystem(1400, 0.08, 0xa4d8ff);
  scene.add(rain.points);

  const dust = createParticleSystem(550, 0.12, 0xd8c69a);
  scene.add(dust.points);

  const state = {
    skyR: 0.49,
    skyG: 0.74,
    skyB: 0.95,
    fogR: 0.54,
    fogG: 0.82,
    fogB: 0.95,
    sun: 1,
    rain: 0,
    dust: 0.16,
    cropL: 0.5,
    water: 0.36,
    cameraX: 0,
    cameraZ: 24,
    dayBlend: 1
  };

  const phases = [
    {
      name: "Morning - Clear Weather",
      to: { skyR: 0.49, skyG: 0.74, skyB: 0.95, fogR: 0.54, fogG: 0.82, fogB: 0.95, sun: 1.15, rain: 0, dust: 0.08, cropL: 0.5, water: 0.32, cameraX: -1.8, cameraZ: 23.5 }
    },
    {
      name: "Monsoon Start - Rice Planting",
      to: { skyR: 0.43, skyG: 0.65, skyB: 0.82, fogR: 0.56, fogG: 0.74, fogB: 0.84, sun: 0.72, rain: 0.28, dust: 0, cropL: 0.45, water: 0.46, cameraX: 0.6, cameraZ: 22.8 }
    },
    {
      name: "Heavy Rain - Deep Monsoon",
      storm: true,
      to: { skyR: 0.35, skyG: 0.5, skyB: 0.65, fogR: 0.45, fogG: 0.59, fogB: 0.7, sun: 0.42, rain: 0.92, dust: 0, cropL: 0.42, water: 0.58, cameraX: 1.4, cameraZ: 22.2 }
    },
    {
      name: "Flood Concern - Rising Water",
      storm: true,
      to: { skyR: 0.37, skyG: 0.53, skyB: 0.68, fogR: 0.5, fogG: 0.64, fogB: 0.74, sun: 0.46, rain: 0.56, dust: 0, cropL: 0.4, water: 0.74, cameraX: 2.2, cameraZ: 23 }
    },
    {
      name: "Sunny Harvest Season",
      to: { skyR: 0.57, skyG: 0.79, skyB: 0.95, fogR: 0.69, fogG: 0.84, fogB: 0.92, sun: 1.3, rain: 0, dust: 0.1, cropL: 0.62, water: 0.32, cameraX: -0.8, cameraZ: 24.3 }
    },
    {
      name: "Dry Season - Drought",
      to: { skyR: 0.77, skyG: 0.74, skyB: 0.6, fogR: 0.82, fogG: 0.77, fogB: 0.62, sun: 1.55, rain: 0, dust: 0.92, cropL: 0.35, water: 0.14, cameraX: -2.2, cameraZ: 24.6 }
    },
    {
      name: "Sunset Return - Loop",
      to: { skyR: 0.55, skyG: 0.58, skyB: 0.82, fogR: 0.72, fogG: 0.65, fogB: 0.61, sun: 0.78, rain: 0, dust: 0.26, cropL: 0.5, water: 0.28, cameraX: 0, cameraZ: 24 }
    }
  ];

  const timeline = gsap.timeline({ repeat: -1, defaults: { ease: "sine.inOut", duration: 4 } });
  phases.forEach((phase) => {
    timeline.to(state, {
      ...phase.to,
      onStart: () => {
        if (typeof options.onPhaseChange === "function") {
          options.onPhaseChange(phase.name);
        }
        if (typeof options.onStormChange === "function") {
          options.onStormChange(Boolean(phase.storm));
        }
      }
    });
  });

  function getDayTarget() {
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const angle = ((hour - 6) / 24) * Math.PI * 2;
    return THREE.MathUtils.clamp(0.52 + Math.sin(angle) * 0.48, 0.18, 1);
  }

  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const clock = new THREE.Clock();

  function animateParticles(system, strength, delta, fallDirection = -1) {
    const pos = system.points.geometry.attributes.position.array;
    const spread = 44;

    for (let i = 0; i < system.speeds.length; i += 1) {
      const i3 = i * 3;
      pos[i3 + 1] += system.speeds[i] * delta * 60 * fallDirection * Math.max(0.1, strength);

      if (fallDirection < 0 && pos[i3 + 1] < 0.2) {
        pos[i3] = (Math.random() - 0.5) * spread * 2;
        pos[i3 + 1] = Math.random() * 20 + 4;
        pos[i3 + 2] = (Math.random() - 0.5) * spread * 2;
      }

      if (fallDirection > 0 && pos[i3 + 1] > 16) {
        pos[i3] = (Math.random() - 0.5) * spread * 2;
        pos[i3 + 1] = Math.random() * 4 + 0.2;
        pos[i3 + 2] = (Math.random() - 0.5) * spread * 2;
      }
    }

    system.points.geometry.attributes.position.needsUpdate = true;
  }

  function render() {
    const elapsed = clock.getElapsedTime();
    const delta = clock.getDelta();

    const targetDay = getDayTarget();
    state.dayBlend += (targetDay - state.dayBlend) * Math.min(1, delta * 2.2);

    const nightMix = 0.35 + state.dayBlend * 0.65;
    skyColor.setRGB(state.skyR * nightMix, state.skyG * nightMix, state.skyB * (0.8 + state.dayBlend * 0.2));
    fogColor.setRGB(state.fogR * nightMix, state.fogG * nightMix, state.fogB * (0.84 + state.dayBlend * 0.16));
    scene.background = skyColor;
    scene.fog = new THREE.Fog(fogColor, 28, 130);

    hemiLight.intensity = (0.68 + state.sun * 0.22) * (0.46 + state.dayBlend * 0.54);
    sunLight.intensity = state.sun * (0.24 + state.dayBlend * 0.76);
    ambient.intensity = (0.16 + state.sun * 0.12) * (0.48 + state.dayBlend * 0.52);

    groundMaterial.color.setHSL(0.33, 0.46, 0.3 + state.cropL * 0.14);
    fieldMaterial.color.setHSL(0.24, 0.64, state.cropL);
    cropMaterial.color.setHSL(0.22, 0.72, state.cropL + 0.04);
    canal.material.opacity = 0.12 + state.water * 0.52;

    for (let i = 0; i < canalPos.count; i += 1) {
      const ix = i * 3;
      const x = canalBase[ix];
      const y = canalBase[ix + 1];
      const ripple = Math.sin(elapsed * (2.8 + state.rain * 2.4) + x * 1.5 + y * 0.8) * (0.03 + state.rain * 0.045);
      canalPos.array[ix + 2] = ripple;
    }
    canalPos.needsUpdate = true;

    farmer.position.x = ((elapsed * 1.4) % 28) - 14;
    farmer.position.z = 6 + Math.sin(elapsed * 0.5) * 1.5;
    farmer.rotation.y = 0.45 + Math.sin(elapsed * 0.45) * 0.12;
    const walk = Math.sin(elapsed * 4.2);
    if (farmer.userData.leftLegPivot) {
      farmer.userData.leftLegPivot.rotation.x = walk * 0.55;
      farmer.userData.rightLegPivot.rotation.x = -walk * 0.55;
      farmer.userData.leftArmPivot.rotation.x = -walk * 0.38;
      farmer.userData.rightArmPivot.rotation.x = walk * 0.38;
    }

    cow.position.x = 8 + Math.sin(elapsed * 0.32) * 2.1;
    cow.position.z = 3 + Math.cos(elapsed * 0.28) * 1.5;
    cow.rotation.y = -0.6 + Math.sin(elapsed * 0.4) * 0.2;

    cropGroup.rotation.z = Math.sin(elapsed * 0.9) * 0.015;

    camera.position.x = Math.sin(elapsed * 0.1) * 2.4 + state.cameraX;
    camera.position.z = state.cameraZ + Math.cos(elapsed * 0.08) * 1.2;
    camera.lookAt(0, 3.2, 4.8);

    rain.points.material.opacity = Math.min(0.9, state.rain);
    dust.points.material.opacity = Math.min(0.68, state.dust * 0.7);

    if (state.rain > 0.02) {
      animateParticles(rain, state.rain, delta, -1);
    }

    if (state.dust > 0.02) {
      animateParticles(dust, state.dust, delta, 1);
      dust.points.rotation.y += delta * 0.08;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  window.addEventListener("resize", handleResize);

  handleResize();
  render();

  return {
    scene,
    renderer,
    camera
  };
}
