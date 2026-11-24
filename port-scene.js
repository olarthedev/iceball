(function () {
  if (customElements.get('port-scene')) return;
  const THREE_LOCAL = new URL('three.module.js', document.baseURI).href;
  const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MX = 2600;
  const VIEWS = {
    home: { orbit: true, target: [-10, 0, 20], radius: 360, height: 150, shift: -0.16 },
    route: { pos: [-40, 520, 420], target: [-10, 0, 60], shift: 0.12 },
    s1: { pos: [-62, 24, -238], target: [-126, 4, -150], shift: -0.12 },
    s2: { pos: [-226, 46, -36], target: [-180, 2, -92], shift: -0.12 },
    s3: { pos: [140, 62, 270], target: [-14.6, 22, 135], shift: -0.17 },
    s4: { pos: [MX + 170, 80, 440], target: [MX - 90, 6, 140], shift: -0.12 },
    s5: { pos: [MX + 310, 95, 200], target: [MX + 110, 2, 70], shift: -0.12 },
    s6: { pos: [MX + 238, 20, 74], target: [MX + 200, 2, 36], shift: -0.12 },
    s7: { pos: [MX + 252, 34, 30], target: [MX + 192, 2, 10], shift: -0.16 },
    s8: { pos: [MX + 210, 130, 330], target: [MX - 14.6, 0, 90], shift: -0.14 }
  };
  const MU = [MX - 14.6, 0, 118, 0], MZ = [MX + 196, 0, 26, 0, Math.PI / 2];
  const UNIT = {
    home: [-129, 0, -172, 0], route: [-129, 0, -172, 0], s1: [-129, 0, -172, 0], s2: [-178, 0, -92, 0],
    s3: [-14.6, 0, 124, 0], s4: MU, s5: MZ, s6: MZ, s7: MZ, s8: [MX + 262, 0, -238, 0, Math.PI / 2]
  };

  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  class PortScene extends HTMLElement {
    static get observedAttributes() { return ['view', 'motion', 'inspect', 'quality']; }
    constructor() { super(); this._view = 'home'; this._motion = true; }
    set view(v) { if (v && v !== this._view) { this._view = v; this._applyView(); } }
    get view() { return this._view; }
    set inspect(v) { this._inspect = v === true || v === 'on' || v === 'true'; }
    set motion(v) { this._motion = !(v === false || v === 'off' || v === 'false'); }
    attributeChangedCallback(n, o, v) { if (n === 'quality') { this._quality = v || 'auto'; this._perf && this._applyQuality(); } if (n === 'inspect') this.inspect = v; if (n === 'view') this.view = v; if (n === 'motion') this.motion = v; }

    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      Object.assign(this.style, { display: 'block', position: 'absolute', inset: '0', overflow: 'hidden', background: '#0b1a2a' });
      this._overlay = document.createElement('div');
      this._fade = document.createElement('div');
      Object.assign(this._fade.style, { position: 'absolute', inset: '0', background: '#0b1a2a', opacity: '0', transition: 'opacity .45s ease', pointerEvents: 'none', zIndex: '1' });
      this.appendChild(this._fade);
      Object.assign(this._overlay.style, {
        position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px',
        font: '500 13px/1.4 "IBM Plex Mono", monospace', letterSpacing: '0.12em', color: '#B9C2CC', textTransform: 'uppercase',
        transition: 'opacity .8s ease', zIndex: '1', pointerEvents: 'none', background: '#0b1a2a'
      });
      this._overlay.textContent = 'Cargando escena del puerto…';
      this.appendChild(this._overlay);
      this._boot();
    }
    disconnectedCallback() { this._teardown(); this._booted = false; this.innerHTML = ''; }

    _teardown() {
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._renderer) {
        this._scene && this._scene.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map && m.map.dispose(); m.bumpMap && m.bumpMap.dispose(); m.dispose(); }); });
        this._renderer.dispose();
        this._renderer.domElement.remove();
      }
      this._renderer = null;
    }

    _fail(msg, retry) {
      const o = this._overlay;
      o.style.opacity = '1'; o.style.pointerEvents = 'auto';
      o.innerHTML = '';
      const t = document.createElement('div'); t.textContent = msg; t.style.maxWidth = '420px'; t.style.textAlign = 'center'; t.style.textTransform = 'none'; t.style.letterSpacing = '0.02em'; t.style.color = '#F2ECE2';
      const s = document.createElement('div'); s.textContent = 'La información académica sigue disponible en los paneles.'; s.style.textTransform = 'none'; s.style.letterSpacing = '0.02em';
      o.append(t, s);
      if (retry) {
        const b = document.createElement('button'); b.textContent = 'Reintentar';
        Object.assign(b.style, { font: '500 12px "IBM Plex Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F2ECE2', background: 'transparent', border: '1px solid rgba(242,236,226,.35)', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' });
        b.onclick = () => { o.textContent = 'Cargando escena del puerto…'; o.style.pointerEvents = 'none'; this._boot(); };
        o.append(b);
      }
    }

    async _boot() {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) { this._fail('Este equipo o navegador no puede mostrar la escena 3D (WebGL no disponible).', false); return; }
      let THREE;
      try { THREE = await import(THREE_LOCAL); } catch (e0) { try { THREE = await import(THREE_URL); } catch (e) { THREE = null; } }
      if (!THREE) { this._fail('No se pudo cargar el motor 3D. Revisa la conexión a internet.', true); return; }
      if (!this.isConnected) return;
      try { this._build(THREE); } catch (e) { console.error(e); this._teardown(); this._fail('Ocurrió un error al construir la escena.', true); return; }
      this._overlay.style.opacity = '0';
    }

    _build(THREE) {
      this.T = THREE;
      const w = this.clientWidth || 1280, h = this.clientHeight || 720;
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, h);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' });
      this.insertBefore(renderer.domElement, this._overlay);
      this._renderer = renderer;

      const scene = new THREE.Scene();
      this._scene = scene;
      const FOG = new THREE.Color('#9aa4ab');
      scene.fog = new THREE.Fog(FOG, 380, 1700);

      const sunDir = new THREE.Vector3(-0.62, 0.30, -0.72).normalize();
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color('#1f3a57') }, mid: { value: new THREE.Color('#6d879f') }, hor: { value: FOG.clone() }, warm: { value: new THREE.Color('#e7b98a') }, sun: { value: sunDir } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 warm; uniform vec3 sun; varying vec3 vD; void main(){ float h = max(vD.y,0.0); vec3 c = mix(hor, mid, smoothstep(0.0,0.18,h)); c = mix(c, top, smoothstep(0.18,0.7,h)); float g = pow(max(dot(vD,sun),0.0), 6.0); c = mix(c, warm, g*0.75*(1.0-smoothstep(0.0,0.5,h))); if(vD.y<0.0) c = hor; gl_FragColor = vec4(c,1.0); }'
      });
      const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat); this._sky = sky;
      scene.add(sky);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;

      const camera = new THREE.PerspectiveCamera(36, w / h, 1, 5000);
      this._camera = camera;

      const sun = new THREE.DirectionalLight('#ffdcb0', 2.6);
      sun.position.copy(sunDir).multiplyScalar(600);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -280, right: 280, top: 280, bottom: -280, near: 10, far: 1400 });
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
      scene.add(sun, sun.target);
      scene.add(new THREE.HemisphereLight('#c3d3e2', '#4a4840', 0.9));

      const std = (color, r = 0.85, m = 0, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: r, metalness: m, envMapIntensity: 0.55 }, extra));
      const box = (wx, hy, dz, mat, x, y, z, parent = scene, cast = true) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(wx, hy, dz), mat);
        m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
      };

      // Water with scrolling ripple bump
      const nc = document.createElement('canvas'); nc.width = nc.height = 256;
      const nx = nc.getContext('2d'); nx.fillStyle = '#808080'; nx.fillRect(0, 0, 256, 256);
      const r0 = rng(7);
      for (let i = 0; i < 900; i++) { const x = r0() * 256, y = r0() * 256, rr = 2 + r0() * 9; const v = Math.floor(90 + r0() * 90); nx.fillStyle = `rgba(${v},${v},${v},0.35)`; nx.beginPath(); nx.ellipse(x, y, rr * 2.2, rr, 0, 0, Math.PI * 2); nx.fill(); }
      const ripple = new THREE.CanvasTexture(nc); ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping; ripple.repeat.set(90, 90);
      this._ripple = ripple;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), std('#123c52', 0.16, 0.0, { bumpMap: ripple, bumpScale: 0.5, envMapIntensity: 0.9 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -2.2; water.receiveShadow = true; scene.add(water);
      this._water = water; this._sun = sun; this._sunDir = sunDir;

      // Land behind terminal
      const land = new THREE.Mesh(new THREE.PlaneGeometry(3200, 1500), std('#4a5246', 1));
      land.rotation.x = -Math.PI / 2; land.position.set(0, -0.08, -890); land.receiveShadow = true; scene.add(land);

      // Terminal yard
      const concrete = std('#8e8f8a', 0.95), asphalt = std('#565a5d', 0.92), paint = std('#d9d4c8', 0.8);
      const yard = box(470, 4, 284, asphalt, 0, -2, -2, scene, false);
      box(470, 4.4, 14, concrete, 0, -2, 134, scene, false);
      box(470, 1.4, 1.2, std('#26292b', 0.9), 0, -2.6, 141.2, scene, false);
      for (let x = -225; x <= 225; x += 18) box(1.6, 2.2, 0.9, std('#202224', 0.9), x, -1.6, 141.8, scene, false);
      [112, 136].forEach(z => box(470, 0.25, 0.5, std('#6c6f72', 0.4, 0.7), 0, 0.12, z, scene, false));
      for (let x = -220; x <= 220; x += 9) box(4.5, 0.06, 0.4, paint, x, 0.04, -100, scene, false);
      for (let x = -220; x <= 220; x += 9) box(4.5, 0.06, 0.4, paint, x, 0.04, 92, scene, false);

      // Container texture (corrugation)
      const cc = document.createElement('canvas'); cc.width = 256; cc.height = 64;
      const cx = cc.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, 256, 64);
      for (let i = 0; i < 256; i += 6) { cx.fillStyle = 'rgba(0,0,0,0.16)'; cx.fillRect(i, 0, 2, 64); cx.fillStyle = 'rgba(255,255,255,0.6)'; cx.fillRect(i + 3, 0, 1, 64); }
      cx.strokeStyle = 'rgba(0,0,0,0.35)'; cx.lineWidth = 4; cx.strokeRect(2, 2, 252, 60);
      const cTex = new THREE.CanvasTexture(cc); cTex.colorSpace = THREE.SRGBColorSpace; cTex.anisotropy = 4;
      const cGeo = new THREE.BoxGeometry(12.2, 2.6, 2.45);
      const cMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.7, metalness: 0.25, envMapIntensity: 0.5 });
      const PAL = ['#8a3b2e', '#3c5a73', '#7d8489', '#3e5a4a', '#b9ad96', '#26364a', '#a0603a', '#5d6b78', '#9b2f2a', '#c7c3b8'].map(c => new THREE.Color(c));

      const r = rng(42);
      const slots = [];
      for (let bx = -196; bx <= 170; bx += 46) for (const bz of [-66, -26, 14, 54]) {
        const maxH = 2 + Math.floor(r() * 3);
        for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 6; iz++) {
          const hgt = Math.max(1, maxH - Math.floor(r() * 2.2));
          for (let k = 0; k < hgt; k++) slots.push([bx + ix * 12.7, 1.3 + k * 2.62, bz + iz * 2.75]);
        }
      }
      // ship containers
      const ship = new THREE.Group(); ship.position.set(-10, 0, 172); scene.add(ship);
      const shipSlots = [];
      for (let bx = -82; bx <= 72; bx += 12.9) {
        const base = 3 + Math.floor(r() * 3);
        for (let iz = 0; iz < 11; iz++) { const hgt = base - (iz === 0 || iz === 10 ? 1 : 0) - (r() < 0.12 ? 1 : 0); for (let k = 0; k < hgt; k++) if (!(Math.abs(bx + 4.6) < 0.5 && k >= 2)) shipSlots.push([bx, 8.3 + k * 2.62, -12.6 + iz * 2.52]); }
      }
      const mkInst = (list, parent) => {
        const im = new THREE.InstancedMesh(cGeo, cMat, list.length);
        const m4 = new THREE.Matrix4(), col = new THREE.Color();
        list.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); col.copy(PAL[Math.floor(r() * PAL.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.06); im.setColorAt(i, col); });
        im.castShadow = true; im.receiveShadow = true; parent.add(im); return im;
      };
      mkInst(slots, scene);
      mkInst(shipSlots, ship);

      // Ship hull
      const hs = new THREE.Shape();
      hs.moveTo(-112, -15); hs.lineTo(84, -15); hs.quadraticCurveTo(108, -13, 120, 0); hs.quadraticCurveTo(108, 13, 84, 15); hs.lineTo(-112, 15); hs.quadraticCurveTo(-116, 0, -112, -15);
      const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 16, bevelEnabled: false }), std('#1d2b3b', 0.6, 0.2));
      hull.rotation.x = -Math.PI / 2; hull.position.y = -8; hull.castShadow = true; hull.receiveShadow = true; ship.add(hull);
      const anti = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 6.6, bevelEnabled: false }), std('#7a2f26', 0.7));
      anti.rotation.x = -Math.PI / 2; anti.position.y = -8.2; anti.scale.set(1.004, 1.02, 1); ship.add(anti);
      const white = std('#e6e3dc', 0.7);
      box(16, 22, 26, white, -100, 19, 0, ship);
      box(18, 2.2, 34, white, -98, 30.5, 0, ship);
      box(16.4, 2.2, 26.4, std('#22313f', 0.3, 0.3), -100, 27, 0, ship, false);
      box(6, 10, 6, std('#2a2f35', 0.7), -108, 34, 0, ship);
      box(2, 1, 30, std('#3b4249', 0.6), 116, 9, 0, ship);
      this._ship = ship;
      const wc = document.createElement('canvas'); wc.width = 256; wc.height = 64; const wx2 = wc.getContext('2d');
      const g1 = wx2.createLinearGradient(0, 0, 256, 0); g1.addColorStop(0, 'rgba(255,255,255,0)'); g1.addColorStop(1, 'rgba(255,255,255,0.95)'); wx2.fillStyle = g1; wx2.fillRect(0, 0, 256, 64);
      wx2.globalCompositeOperation = 'destination-in'; const g2 = wx2.createLinearGradient(0, 0, 0, 64); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.5, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); wx2.fillStyle = g2; wx2.fillRect(0, 0, 256, 64);
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(240, 34), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(wc), transparent: true, opacity: 0, depthWrite: false }));
      wake.rotation.x = -Math.PI / 2; wake.position.set(-232, -2.0, 0); ship.add(wake); this._wake = wake;

      // STS cranes
      const steel = std('#c9ccc7', 0.55, 0.45);
      const darkSteel = std('#5b6167', 0.6, 0.5);
      this._trolleys = [];
      const mkCrane = (x, ci, steel) => {
        const g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g);
        for (const dx of [-9, 9]) for (const z of [112, 136]) box(1.8, 46, 1.8, steel, dx, 23, z, g);
        for (const z of [112, 136]) box(20, 2.2, 2.2, steel, 0, 44, z, g);
        for (const dx of [-9, 9]) { box(2.2, 2.2, 26, steel, dx, 44, 124, g); box(2.4, 1.2, 28, darkSteel, dx, 0.6, 124, g); }
        for (const dx of [-4.5, 4.5]) box(1.6, 2.4, 140, steel, dx, 50, 150, g);
        box(9, 0.8, 140, steel, 0, 51.6, 150, g);
        box(12, 7, 14, std('#e8e5de', 0.7), 0, 55, 96, g);
        for (const dx of [-4.5, 4.5]) {
          const a = box(1.2, 30, 1.2, steel, dx, 66, 118, g); a.rotation.x = -0.45;
          const b = box(1.2, 26, 1.2, steel, dx, 64, 102, g); b.rotation.x = 0.55;
        }
        const tr = new THREE.Group(); g.add(tr);
        box(8, 3, 6, darkSteel, 0, 47.8, 0, tr);
        const cable = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1, 0.25), darkSteel); tr.add(cable);
        const spreader = box(12.6, 0.8, 2.6, std('#c48a2b', 0.6, 0.3), 0, 0, 0, tr);
        let held = null;
        if (ci !== 1) { held = new THREE.Mesh(cGeo, cMat.clone()); held.material.color.copy(PAL[(ci * 3) % PAL.length]); held.castShadow = true; tr.add(held); }
        this._trolleys.push({ tr, cable, spreader, held, phase: ci * 2.1 });
      };
      [-80, -14.6, 62].forEach((x, ci) => mkCrane(x, ci, steel));

      // Gate complex (reception)
      box(56, 1, 22, std('#e2ded5', 0.7), -122, 9, -128);
      for (const dx of [-26, 26]) for (const dz of [-10, 10]) box(1, 9, 1, std('#7b8086', 0.6, 0.4), -122 + dx, 4.5, -128 + dz);
      for (let i = 0; i < 4; i++) box(1.6, 3, 3, std('#cfcac0', 0.8), -142 + i * 13, 1.5, -128);
      for (let i = 0; i < 5; i++) box(0.3, 1.1, 18, paint, -148.5 + i * 13, 0.05, -128, scene, false);
      for (let x = -230; x <= 230; x += 6) { if (x > -152 && x < -92) continue; box(0.25, 3.2, 0.25, std('#7b8086', 0.6, 0.5), x, 1.6, -142, scene, false); }
      box(460, 0.12, 0.12, std('#7b8086', 0.6, 0.5), 0, 3, -142, scene, false);

      // Access road to gate
      box(58, 0.3, 260, asphalt, -122, 0.05, -272, scene, false);
      for (let z = -150; z > -400; z -= 10) box(0.4, 0.06, 5, paint, -122, 0.22, z, scene, false);
      // Inspection shed (zona de control)
      const shed = std('#a9aca7', 0.85), frame = std('#6e757b', 0.6, 0.4);
      box(44, 0.2, 24, std('#a3a29c', 0.95), -184, 0.1, -92, scene, false);
      box(20, 12, 0.6, shed, -196, 6, -104);
      box(4, 12, 0.6, shed, -164, 6, -104);
      box(20, 3.5, 0.6, shed, -176, 10.25, -104);
      for (const x of [-206, -162]) box(0.6, 12, 24, shed, x, 6, -92);
      box(44, 1.4, 0.6, shed, -184, 0.7, -80);
      box(44, 0.6, 0.6, frame, -184, 12, -80, scene, false);
      for (let x = -202; x <= -166; x += 9) box(0.4, 0.6, 24, frame, x, 12, -92, scene, false);
      for (const x of [-196, -164]) box(2.4, 0.3, 1.2, std('#f2ece2', 0.4, 0, { emissive: '#f2ece2', emissiveIntensity: 0.6 }), x, 11.6, -92, scene, false);
      // Inspection table with coffee sacks
      box(4, 0.9, 1.6, std('#6b5a48', 0.8), -194, 0.65, -86);
      const sack = std('#b49a72', 0.95);
      [[-195.2, -86.2], [-194, -85.7], [-192.8, -86.3]].forEach(([x, z]) => box(0.9, 0.45, 0.6, sack, x, 1.32, z));
      [[-185, -99], [-185.9, -99.6], [-185.4, -98.2]].forEach(([x, z], i) => box(0.9, 0.45, 0.6, sack, x, 0.42 + (i === 2 ? 0.45 : 0), z));
      // Figures: inspection staff
      const skin = std('#a57a5a', 0.8), vest = std('#d9a43a', 0.7), pants = std('#2b3540', 0.85), hat = std('#f2ece2', 0.5);
      const mkPerson = (x, z, rotY, hatMat, clip, body = vest) => {
        const p = new THREE.Group(); p.position.set(x, 0.2, z); p.rotation.y = rotY; p.scale.setScalar(1.25);
        for (const dx of [-0.13, 0.13]) box(0.2, 0.85, 0.24, pants, dx, 0.43, 0, p);
        box(0.56, 0.68, 0.32, body, 0, 1.2, 0, p);
        for (const dx of [-0.36, 0.36]) box(0.14, 0.6, 0.16, body, dx, 1.2, 0.04, p);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), skin); head.position.y = 1.7; head.castShadow = true; p.add(head);
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat); helm.position.y = 1.74; helm.castShadow = true; p.add(helm);
        if (clip) { const c = box(0.3, 0.4, 0.04, std('#e8e4dc', 0.7), 0, 1.25, 0.3, p); c.rotation.x = -0.6; }
        scene.add(p); return p;
      };
      this._people = [
        mkPerson(-174.6, -93, -Math.PI / 2, hat, true),
        mkPerson(-181.4, -89.5, Math.PI / 2, std('#3c5a73', 0.5), false),
        mkPerson(-178, -101.2, 0, hat, false),
        mkPerson(-194, -84.2, Math.PI, std('#3c5a73', 0.5), true)
      ];

      // Warehouses / admin
      box(70, 14, 36, std('#b8b6ae', 0.85), 180, 7, -112);
      box(72, 1, 38, std('#7c8288', 0.7, 0.3), 180, 14.5, -112);
      box(26, 18, 18, std('#d8d4cb', 0.75), 120, 9, -120);
      box(26.4, 2.4, 18.4, std('#2b3a48', 0.25, 0.4), 120, 13, -120, scene, false);

      // Light towers
      for (const [x, z] of [[-210, -40], [-210, 60], [200, -40], [200, 60], [-30, -110], [60, -110], [-30, 100]]) {
        box(1, 36, 1, std('#8a9097', 0.5, 0.5), x, 18, z);
        box(5, 1.6, 2, std('#d8d6cf', 0.6), x, 36.5, z);
      }

      // Trucks
      const mkTruck = (cabColor, withBox, boxColor) => {
        const t = new THREE.Group();
        box(2.6, 3.2, 2.5, std(cabColor, 0.55, 0.2), 7.6, 2.4, 0, t);
        box(14.4, 0.6, 2.3, std('#2a2d30', 0.8, 0.3), 0.4, 1.1, 0, t);
        for (const wx of [-5, -3.6, 4.5, 7.6]) box(1, 1.1, 2.6, std('#151617', 0.9), wx, 0.55, 0, t, false);
        if (withBox) { const c = new THREE.Mesh(cGeo, cMat.clone()); c.material.color.set(boxColor); c.position.set(-0.6, 2.75, 0); c.castShadow = true; c.receiveShadow = true; t.add(c); }
        scene.add(t); return t;
      };
      [[-148, -128], [-109, -128], [-96, -128]].forEach(([x, z], i) => { const t = mkTruck(['#c8c4ba', '#3d5a74', '#8a3b2e'][i], i !== 2, PAL[(i * 4 + 1) % PAL.length]); t.position.set(x, 0, z); t.rotation.y = Math.PI / 2; });
      this._movers = [];
      for (let i = 0; i < 3; i++) { const t = mkTruck(['#d8d4cb', '#5d6b78', '#9a5b36'][i], true, PAL[(i * 3 + 2) % PAL.length]); this._movers.push({ t, off: i * 160, z: i % 2 ? 96 : -96, dir: i % 2 ? 1 : -1, min: i % 2 ? -230 : -145, max: 230 }); }

      // Coffee unit: truck + highlighted container
      const unit = new THREE.Group(); scene.add(unit);
      const ut = new THREE.Group(); unit.add(ut);
      box(2.6, 3.2, 2.5, std('#e9e4da', 0.5, 0.2), 7.6, 2.4, 0, ut);
      box(14.4, 0.6, 2.3, std('#2a2d30', 0.8, 0.3), 0.4, 1.1, 0, ut);
      for (const wx of [-5, -3.6, 4.5, 7.6]) box(1, 1.1, 2.6, std('#151617', 0.9), wx, 0.55, 0, ut, false);
      const coffeeMat = new THREE.MeshStandardMaterial({ map: cTex, color: '#7b4f2f', roughness: 0.6, metalness: 0.3, envMapIntensity: 0.6 });
      const coffee = new THREE.Mesh(cGeo, coffeeMat); coffee.castShadow = true; coffee.receiveShadow = true; scene.add(coffee); const mk = new THREE.Group(); scene.add(mk);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#f2ece2', transparent: true, opacity: 0.55, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10.2, 64), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; unit.add(ring);
      const beamMat = new THREE.MeshBasicMaterial({ color: '#f2ece2', transparent: true, opacity: 0.5, depthWrite: false });
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 6), beamMat); pin.position.set(0, 8.45, 0); mk.add(pin);
      const pinHead = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: '#f2ece2' })); pinHead.position.set(0, 16.05, 0); mk.add(pinHead);
      this._unit = { g: unit, truck: ut, coffee, ring, pinHead, mk, from: null, to: null, t0: 0 };
      const u0 = UNIT[this._view] || UNIT.home; unit.position.set(u0[0], u0[1], u0[2]); unit.rotation.y = -Math.PI / 2; ut.visible = !u0[3];

      // Distant skyline across the bay
      const sky1 = std('#8d9aa6', 0.9), sky2 = std('#a7b1ba', 0.9);
      const rs = rng(11);
      for (let i = 0; i < 46; i++) { const hgt = 20 + rs() * 90; box(12 + rs() * 14, hgt, 12 + rs() * 14, rs() > 0.5 ? sky1 : sky2, -820 + i * 26 + rs() * 8, hgt / 2 - 2, 900 + rs() * 80, scene, false); }
      box(1800, 3, 160, std('#6f7a6f', 1), -300, -1, 980, scene, false);
      for (let i = 0; i < 14; i++) { const hgt = 8 + rs() * 22; box(20 + rs() * 30, hgt, 16 + rs() * 20, sky2, 360 + i * 38, hgt / 2, -260 - rs() * 120, scene, false); }

      // ===== Scene C: Miami terminal =====
      const rm = rng(91);
      box(470, 4, 284, asphalt, MX, -2, -2, scene, false);
      box(470, 4.4, 14, concrete, MX, -2, 134, scene, false);
      box(470, 1.4, 1.2, std('#26292b', 0.9), MX, -2.6, 141.2, scene, false);
      for (let x = -225; x <= 225; x += 18) box(1.6, 2.2, 0.9, std('#202224', 0.9), MX + x, -1.6, 141.8, scene, false);
      [112, 136].forEach(z => box(470, 0.25, 0.5, std('#6c6f72', 0.4, 0.7), MX, 0.12, z, scene, false));
      for (let x = -220; x <= 220; x += 9) { box(4.5, 0.06, 0.4, paint, MX + x, 0.04, -100, scene, false); box(4.5, 0.06, 0.4, paint, MX + x, 0.04, 92, scene, false); }
      const mSlots = [];
      for (let bx = -196; bx <= 170; bx += 46) for (const bz of [-66, -26, 14, 54]) {
        const maxH = 1 + Math.floor(rm() * 4);
        for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 6; iz++) { const hgt = Math.max(1, maxH - Math.floor(rm() * 2.2)); for (let k = 0; k < hgt; k++) if (bx + ix * 12.7 < 160) mSlots.push([MX + bx + ix * 12.7, 1.3 + k * 2.62, bz + iz * 2.75]); }
      }
      mkInst(mSlots, scene);
      const miaSteel = std('#8aa2b6', 0.5, 0.45);
      [MX - 80, MX - 14.6, MX + 62].forEach((x, ci) => mkCrane(x, ci, miaSteel));
      const mland = std('#59614f', 1);
      const ml1 = new THREE.Mesh(new THREE.PlaneGeometry(1400, 200), mland); ml1.rotation.x = -Math.PI / 2; ml1.position.set(MX, -0.08, -240); ml1.receiveShadow = true; scene.add(ml1);
      const ml2 = new THREE.Mesh(new THREE.PlaneGeometry(2200, 800), mland); ml2.rotation.x = -Math.PI / 2; ml2.position.set(MX - 200, -0.08, -880); scene.add(ml2);
      box(70, 14, 36, std('#c9c6bd', 0.85), MX + 175, 7, -112);
      box(72, 1, 38, std('#7c8288', 0.7, 0.3), MX + 175, 14.5, -112);
      box(90, 12, 30, std('#bdbab2', 0.85), MX - 160, 6, -118);
      box(30, 20, 18, std('#e4e1d9', 0.75), MX + 100, 10, -122);
      box(30.4, 2.4, 18.4, std('#2b3a48', 0.25, 0.4), MX + 100, 15, -122, scene, false);
      for (const [x, z] of [[-210, -40], [-210, 60], [200, -40], [200, 60], [-30, -110], [60, -110]]) { box(1, 36, 1, std('#8a9097', 0.5, 0.5), MX + x, 18, z); box(5, 1.6, 2, std('#d8d6cf', 0.6), MX + x, 36.5, z); }
      // causeway bridge to downtown
      box(14, 1.6, 200, std('#cfccc4', 0.8), MX - 260, 9, -380);
      for (let z = -300; z >= -460; z -= 32) box(3, 10, 3, std('#b5b2aa', 0.85), MX - 260, 4, z);
      // downtown skyline across the bay
      const glass = std('#8fa6b8', 0.3, 0.35), whiteT = std('#e6e4de', 0.6), sand = std('#cdbfa6', 0.8);
      for (let i = 0; i < 46; i++) {
        const hgt = 30 + Math.pow(rm(), 1.6) * 210, wd = 14 + rm() * 18, x = MX - 760 + i * 30 + rm() * 10, z = -540 - rm() * 230;
        const m = rm() < 0.5 ? glass : rm() < 0.6 ? whiteT : sand;
        box(wd, hgt, wd * (0.7 + rm() * 0.6), m, x, hgt / 2, z, scene, false);
        if (hgt > 150) box(wd * 0.6, 12, wd * 0.6, m, x, hgt + 6, z, scene, false);
      }
      [[-140, -128], [-80, -128], [160, -40]].forEach(([x, z], i) => { const t = mkTruck(['#e2ded5', '#4f6f8f', '#8a3b2e'][i], i !== 1, PAL[(i * 5 + 2) % PAL.length]); t.position.set(MX + x, 0, z); t.rotation.y = i === 2 ? 0 : Math.PI / 2; });
      for (let i = 0; i < 2; i++) { const t = mkTruck(['#d8d4cb', '#3d5a74'][i], true, PAL[(i * 4 + 3) % PAL.length]); this._movers.push({ t, off: i * 200 + 60, z: i ? 96 : -96, dir: i ? 1 : -1, min: MX - 230, max: MX + 165 }); }

      // CBP review zone (illustrative)
      const ZX = MX + 196, ZZ = 26;
      box(44, 0.12, 44, std('#b4b2aa', 0.95), ZX, 0.06, ZZ, scene, false);
      for (const dx of [-8, 8]) box(0.4, 0.06, 40, std('#d9b25a', 0.7), ZX + dx, 0.14, ZZ, scene, false);
      const rail = std('#d9d4c8', 0.6, 0.3);
      for (const dx of [-22, 22]) { box(0.3, 1.1, 44, rail, ZX + dx, 0.55, ZZ); for (let z = ZZ - 22; z <= ZZ + 22; z += 5.5) box(0.4, 1.2, 0.4, rail, ZX + dx, 0.6, z, scene, false); }
      for (const dx of [-15, 15]) box(14, 1.1, 0.3, rail, ZX + dx, 0.55, ZZ - 22);
      const post = std('#d9d4c8', 0.6, 0.3);
      for (const dx of [-8.6, 8.6]) box(0.8, 2.2, 0.8, post, ZX + dx, 1.1, ZZ - 22);
      const armPivot = new THREE.Group(); armPivot.position.set(ZX - 8.6, 1.9, ZZ - 22); scene.add(armPivot);
      const armW = std('#f2ece2', 0.5), armR = std('#9b2f2a', 0.6);
      for (let i = 0; i < 8; i++) box(2.1, 0.32, 0.32, i % 2 ? armR : armW, 1.05 + i * 2.1, 0, 0, armPivot);
      const sigMat = new THREE.MeshStandardMaterial({ color: '#e3b25a', emissive: '#e3b25a', emissiveIntensity: 1.2, roughness: 0.4 });
      const sig = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), sigMat); sig.position.set(ZX + 8.6, 2.6, ZZ - 22); scene.add(sig);
      this._gate = { armPivot, sigMat, open: 0 };
      box(56, 0.3, 14, asphalt, MX + 262, 0.05, -60, scene, false);
      box(14, 0.3, 196, asphalt, MX + 262, 0.05, -160, scene, false);
      for (let z = -75; z > -255; z -= 10) box(0.4, 0.06, 5, paint, MX + 262, 0.24, z, scene, false);
      const wh = std('#d4d0c6', 0.85);
      box(60, 14, 44, wh, MX + 300, 7, -250);
      box(62, 1, 46, std('#7c8288', 0.7, 0.3), MX + 300, 14.5, -250);
      box(3, 1.2, 44, concrete, MX + 268.5, 0.6, -250);
      for (const z of [-264, -254, -244, -234]) box(0.3, 5, 4.4, std('#2b3035', 0.8), MX + 269.9, 3.7, z, scene, false);
      box(0.4, 2.2, 30, std('#3c5a73', 0.6), MX + 269.8, 11.6, -250, scene, false);
      const pal = std('#a07c52', 0.9), sk = std('#b49a72', 0.95);
      for (const z of [-246, -241]) { box(1.6, 0.25, 1.6, pal, MX + 265.6, 0.12, z); box(1.4, 1, 1.4, sk, MX + 265.6, 0.75, z); }
      const dockV = std('#d9a43a', 0.7);
      mkPerson(MX + 265.4, -236, Math.PI, hat, true, dockV);
      mkPerson(MX + 266, -250, -Math.PI / 2, std('#3c5a73', 0.5), false, dockV);
      box(8, 5, 6, std('#ebe8e1', 0.7), ZX + 16, 2.5, ZZ - 14);
      box(8.1, 1.4, 6.1, std('#22313f', 0.25, 0.4), ZX + 16, 3.4, ZZ - 14, scene, false);
      box(8.6, 0.4, 6.6, std('#3c5a73', 0.6), ZX + 16, 5.2, ZZ - 14);
      const gantry = new THREE.Group(); scene.add(gantry);
      const gm = std('#c9ccc7', 0.5, 0.45);
      for (const dx of [-4.2, 4.2]) { box(0.7, 6.6, 0.9, gm, dx, 3.3, 0, gantry); box(1.2, 0.5, 2.4, std('#4a5057', 0.7), dx, 0.25, 0, gantry); }
      box(9.1, 0.9, 1.2, gm, 0, 6.8, 0, gantry);
      const scanMat = new THREE.MeshStandardMaterial({ color: '#e3b25a', emissive: '#e3b25a', emissiveIntensity: 0.1, roughness: 0.5 });
      const scan = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 0.3), scanMat); scan.position.y = 6.25; gantry.add(scan);
      gantry.position.set(ZX, 0, ZZ - 20);
      const navy = std('#24364f', 0.8), navyCap = std('#1b2738', 0.6);
      mkPerson(ZX + 11, ZZ - 13, -Math.PI / 2, navyCap, false, navy);
      const inspectors = [mkPerson(ZX - 3.2, ZZ + 4, Math.PI / 2 + Math.PI, navyCap, true, navy), mkPerson(ZX + 3.2, ZZ - 2, -Math.PI / 2 + Math.PI, navyCap, false, navy)];
      inspectors[0].rotation.y = 0; inspectors[1].rotation.y = Math.PI;
      inspectors.forEach(p => { p.rotation.y = p === inspectors[0] ? -Math.PI / 2 : Math.PI / 2; p.visible = false; });
      inspectors[0].rotation.y = Math.PI / 2; inspectors[1].rotation.y = -Math.PI / 2;
      this._zone = { gantry, scanMat, inspectors, ZX, ZZ };
      const fda = new THREE.Group(); scene.add(fda);
      const vanW = std('#f0eee8', 0.55, 0.1), vanG = std('#22313f', 0.25, 0.4);
      const van = new THREE.Group(); van.position.set(ZX + 16, 0, ZZ - 4); van.rotation.y = Math.PI / 2; fda.add(van);
      box(6.4, 2.6, 2.6, vanW, 0, 1.7, 0, van); box(1.6, 1.8, 2.5, vanW, 3.9, 1.3, 0, van);
      box(0.1, 0.9, 2.3, vanG, 4.72, 1.7, 0, van, false); box(6.42, 0.25, 2.62, std('#3c5a73', 0.6), 0, 1.5, 0, van, false);
      for (const wx of [-2.2, 3.4]) box(0.9, 0.9, 2.7, std('#151617', 0.9), wx, 0.45, 0, van, false);
      const tbl = new THREE.Group(); tbl.position.set(ZX + 6, 0, ZZ + 10); fda.add(tbl);
      box(3.2, 0.12, 1.4, std('#e8e4dc', 0.6), 0, 1.05, 0, tbl);
      for (const dx of [-1.4, 1.4]) for (const dz of [-0.55, 0.55]) box(0.1, 1, 0.1, std('#7b8086', 0.5, 0.5), dx, 0.5, dz, tbl, false);
      const samples = new THREE.Group(); tbl.add(samples);
      [[-0.8, 0], [0, 0.2], [0.8, -0.1]].forEach(([x, z]) => box(0.55, 0.32, 0.4, std('#b49a72', 0.95), x, 1.27, z, samples));
      box(0.5, 0.4, 0.4, std('#3c5a73', 0.5), 1.2, 1.31, 0.35, samples);
      const coat = std('#eef0ee', 0.75), cap = std('#3c5a73', 0.5);
      const fOff = mkPerson(ZX + 6, ZZ + 11.6, Math.PI, cap, true, coat);
      const fOff2 = mkPerson(ZX + 9.5, ZZ + 8.5, -Math.PI / 2, cap, false, coat);
      scene.remove(fOff); scene.remove(fOff2); fda.add(fOff, fOff2);
      const fRing = new THREE.Mesh(new THREE.RingGeometry(10.6, 11.1, 64), new THREE.MeshBasicMaterial({ color: '#e3b25a', transparent: true, opacity: 0, depthWrite: false }));
      fRing.rotation.x = -Math.PI / 2; fRing.position.set(ZX, 0.2, ZZ); fda.add(fRing);
      fda.visible = false;
      this._fda = { g: fda, samples, fOff2, fRing, ZX, ZZ };

      // Pointer orbit (light, bounded)
      this._user = { az: 0, el: 0, zoom: 1, taz: 0, tel: 0, tzoom: 1 };
      const el = renderer.domElement;
      let drag = null;
      el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az: this._user.taz, el: this._user.tel }; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
      el.addEventListener('pointermove', e => { if (!drag) return; this._user.taz = Math.max(-0.9, Math.min(0.9, drag.az - (e.clientX - drag.x) * 0.004)); this._user.tel = Math.max(-0.25, Math.min(0.35, drag.el + (e.clientY - drag.y) * 0.003)); });
      const up = () => { drag = null; el.style.cursor = 'grab'; };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => { e.preventDefault(); this._user.tzoom = Math.max(0.6, Math.min(1.35, this._user.tzoom * (e.deltaY > 0 ? 1.06 : 0.94))); }, { passive: false });
      el.addEventListener('dblclick', () => { this._user.taz = 0; this._user.tel = 0; this._user.tzoom = 1; });

      this._cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), shift: 0, from: null, t0: 0, dur: 1 };
      this._orbitA = 0.7; this._active = this._view; this._vt0 = performance.now(); this._sail = 0;
      this._setCamImmediate();

      this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this);
      this._perf = { level: 0, frames: 0, acc: 0, t0: performance.now() };
      this._applyQuality();
      this._clock = new THREE.Clock();
      const loop = () => { this._raf = requestAnimationFrame(loop); this._frame(); };
      loop();
    }

    _viewPose(v, a) {
      const p = this._basePose(v, a);
      if (!this._ship) return p;
      const tS = reduce() ? 99 : (performance.now() - this._vt0) / 1000;
      if (v === 's5') {
        const k5 = ease(Math.max(0, Math.min(1, (tS - 8.5) / 3.5)));
        if (k5 > 0) { const T = this.T; p.pos.lerp(new T.Vector3(MX + 238, 24, 70), k5); p.target.lerp(new T.Vector3(MX + 196, 3, 26), k5); }
        return p;
      }
      if (v === 's8' && this._unit) {
        const T = this.T, up = this._unit.g.position, k = ease(Math.max(0, Math.min(1, (tS - 14) / 3.5)));
        const tg = new T.Vector3(up.x + 16 * k, 3 + 2 * k, up.z - 8 * k);
        p.target.copy(tg); p.pos.copy(tg).add(new T.Vector3(-58 - 22 * k, 38 + 18 * k, 66 + 12 * k)); return p;
      }
      if (v === 's4') {
        const k4 = ease(Math.max(0, Math.min(1, (tS - 8.6) / 3.5)));
        if (k4 > 0) { const T = this.T; p.pos.lerp(new T.Vector3(MX + 95, 48, 252), k4); p.target.lerp(new T.Vector3(MX - 14.6, 14, 140), k4); }
        return p;
      }
      if (v !== 's3') return p;
      const k = ease(Math.max(0, Math.min(1, (tS - 9.6) / 4)));
      if (k <= 0) return p;
      const sp = this._ship.position, T = this.T;
      const tg = new T.Vector3(sp.x + 40, 8, sp.z), pos = new T.Vector3(tg.x - 250, 80, tg.z + 210);
      p.pos.lerp(pos, k); p.target.lerp(tg, k); return p;
    }
    _basePose(v, a) {
      const T = this.T, V = VIEWS[v] || VIEWS.home;
      if (V.orbit) {
        const t = new T.Vector3(...V.target);
        return { pos: new T.Vector3(t.x + Math.cos(a) * V.radius, V.height, t.z + Math.sin(a) * V.radius), target: t, shift: V.shift };
      }
      return { pos: new T.Vector3(...V.pos), target: new T.Vector3(...V.target), shift: V.shift };
    }
    _setCamImmediate() { const p = this._viewPose(this._active, this._orbitA); this._cam.pos.copy(p.pos); this._cam.target.copy(p.target); this._cam.shift = p.shift; }

    _applyView() {
      if (!this._renderer) return;
      const idx = v => (/^s\d$/.test(v) ? +v[1] : 0);
      const reg = v => (idx(v) >= 4 ? 1 : 0);
      const cut = reg(this._active) !== reg(this._view) || (this._active === 's3' && this._sail > 40) || (idx(this._view) >= 3 && idx(this._view) <= 7 && idx(this._active) > idx(this._view));
      clearTimeout(this._cutT);
      if (cut && !reduce()) {
        this._fade.style.opacity = '1';
        this._cutT = setTimeout(() => { this._setActive(this._view, true); this._fade.style.opacity = '0'; }, 480);
      } else this._setActive(this._view, false);
    }
    _setActive(v, instant) {
      this._active = v; this._vt0 = performance.now();
      const c = this._cam, u = this._unit, to = UNIT[v] || UNIT.home;
      this._user.taz = 0; this._user.tel = 0; this._user.tzoom = 1;
      if ((VIEWS[v] || {}).orbit) { const t = VIEWS.home.target; this._orbitA = Math.atan2(c.pos.z - t[2], c.pos.x - t[0]); }
      if (instant) {
        this._sail = 0; u.g.position.set(to[0], to[1], to[2]); u.from = null; u.truck.visible = !to[3];
        this._setCamImmediate(); c.from = null; return;
      }
      c.from = { pos: c.pos.clone(), target: c.target.clone(), shift: c.shift };
      c.t0 = performance.now(); c.dur = reduce() ? 1 : 2600;
      u.from = u.g.position.clone(); u.to = new this.T.Vector3(to[0], to[1], to[2]); u.t0 = performance.now(); u.hideTruck = !!to[3];
    }

    _applyQuality() {
      const q = this._quality || 'auto', P = this._perf, r = this._renderer; if (!r) return;
      const lvl = q === 'high' ? 0 : q === 'low' ? 2 : P.level;
      if (P.applied === lvl) return; P.applied = lvl;
      const dpr = window.devicePixelRatio || 1;
      r.setPixelRatio(lvl === 0 ? Math.min(dpr, 1.75) : lvl === 1 ? Math.min(dpr, 1.25) : 1);
      const shadows = lvl < 2;
      r.shadowMap.enabled = shadows; r.shadowMap.type = lvl === 0 ? this.T.PCFSoftShadowMap : this.T.PCFShadowMap;
      if (this._sun) { this._sun.castShadow = shadows; const sz = lvl === 0 ? 2048 : 1024; if (this._sun.shadow.mapSize.x !== sz) { this._sun.shadow.mapSize.set(sz, sz); if (this._sun.shadow.map) { this._sun.shadow.map.dispose(); this._sun.shadow.map = null; } } }
      this._scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
      this._resize();
    }
    _perfTick(dt) {
      const P = this._perf; if ((this._quality || 'auto') !== 'auto' || P.level >= 2 || document.hidden) return;
      if (performance.now() - P.t0 < 2500) return;
      P.frames++; P.acc += dt;
      if (P.frames >= 120) { const fps = P.frames / P.acc; P.frames = 0; P.acc = 0; if (fps < 42) { P.level++; P.t0 = performance.now(); this._applyQuality(); } }
    }
    _resize() {
      if (!this._renderer) return;
      const w = this.clientWidth, h = this.clientHeight; if (!w || !h) return;
      this._renderer.setSize(w, h); this._camera.aspect = w / h; this._camera.updateProjectionMatrix();
    }

    _frame() {
      const rawDt = this._clock.getDelta(), T = this.T, now = performance.now(), dt = Math.min(rawDt, 0.05), time = this._clock.elapsedTime;
      if (rawDt < 0.5) this._perfTick(rawDt);
      const live = this._motion && !reduce();
      const V = VIEWS[this._active] || VIEWS.home, c = this._cam;
      if (V.orbit && live) this._orbitA += dt * 0.028;
      const goal = this._viewPose(this._active, this._orbitA);
      if (c.from) {
        const k = ease(Math.min(1, (now - c.t0) / c.dur));
        c.pos.lerpVectors(c.from.pos, goal.pos, k); c.target.lerpVectors(c.from.target, goal.target, k); c.shift = c.from.shift + (goal.shift - c.from.shift) * k;
        if (k >= 1) c.from = null;
      } else { c.pos.copy(goal.pos); c.target.copy(goal.target); c.shift = goal.shift; }

      const us = this._user; const lk = 1 - Math.pow(0.002, dt);
      us.az += (us.taz - us.az) * lk; us.el += (us.tel - us.el) * lk; us.zoom += (us.tzoom - us.zoom) * lk;
      const off = c.pos.clone().sub(c.target);
      const sph = new T.Spherical().setFromVector3(off);
      sph.theta += us.az; sph.phi = Math.max(0.15, Math.min(1.5, sph.phi - us.el)); sph.radius *= us.zoom;
      if (live && !V.orbit) { sph.theta += Math.sin(time * 0.12) * 0.015; }
      const cam = this._camera;
      cam.position.copy(c.target).add(new T.Vector3().setFromSpherical(sph));
      cam.lookAt(c.target);
      const w = this.clientWidth, h = this.clientHeight;
      const sh = w < 820 ? 0 : c.shift;
      cam.setViewOffset(w, h, sh * w, 0, w, h);

      const u = this._unit;
      if (u.from) {
        const k = ease(Math.min(1, (now - u.t0) / (reduce() ? 1 : 2400)));
        u.g.position.lerpVectors(u.from, u.to, k);
        if (k > 0.5) u.truck.visible = !u.hideTruck;
        if (k >= 1) u.from = null;
      }
      const pulse = live ? (Math.sin(time * 2.0) + 1) / 2 : 0.5;
      u.ring.scale.setScalar(1 + pulse * 0.12); u.ring.material.opacity = 0.35 + (1 - pulse) * 0.35;
      u.pinHead.rotation.y = time * 0.8; u.pinHead.position.y = 16.05 + (live ? Math.sin(time * 1.6) * 0.5 : 0);

      if (live) {
        this._ripple.offset.set(time * 0.004, time * 0.0025);
        this._ship.rotation.x = Math.sin(time * 0.5) * 0.004; this._ship.position.y = Math.sin(time * 0.4) * 0.15;
        this._trolleys.forEach(o => {
          const p = (Math.sin(time * 0.22 + o.phase) + 1) / 2;
          o.tr.position.z = 120 + p * 60;
          const drop = 47 - (8 + (1 - Math.abs(Math.sin(time * 0.22 + o.phase))) * 18);
          o.spreader.position.y = drop; o.cable.scale.y = Math.max(1, 47 - drop); o.cable.position.y = (47 + drop) / 2;
          if (o.held) o.held.position.y = drop - 1.7;
        });
        this._movers.forEach(m => { const L = m.max - m.min; const x = ((time * 9 * m.dir + m.off) % L + L) % L + m.min; m.t.position.set(x, 0, m.z); m.t.rotation.y = m.dir > 0 ? 0 : Math.PI; });
        this._people.forEach((p, i) => { p.rotation.z = Math.sin(time * 0.9 + i * 1.7) * 0.03; });
      } else {
        this._trolleys.forEach(o => { o.tr.position.z = 150; o.spreader.position.y = 30; o.cable.scale.y = 17; o.cable.position.y = 38.5; if (o.held) o.held.position.y = 28.3; });
        this._movers.forEach(m => m.t.position.set(Math.max(m.min + 10, m.off - 200), 0, m.z));
      }
      // Narrative: crane loading + departure (stage 3)
      const vi = /^s\d$/.test(this._active) ? +this._active[1] : 0;
      const tS = reduce() ? 99 : (now - this._vt0) / 1000;
      const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
      let d = 0, spd = 0;
      if (vi === 3) { const uu = tS - 9.6; if (reduce()) d = 700; else if (uu > 0) { d = uu < 5 ? 4 * uu * uu : 100 + 40 * (uu - 5); spd = Math.min(1, uu / 5); } }
      this._sail = d;
      const shp = this._ship, BERTH = 172;
      if (vi >= 4) {
        const arr = vi === 4 ? (reduce() ? 1 : ss(0, 9, tS)) : 1, rm1 = 1 - arr;
        shp.position.x = MX - 10 - 520 * rm1; shp.position.z = BERTH + 80 * rm1 * rm1; shp.rotation.y = 0.2 * rm1;
        this._wake.material.opacity = 0.5 * Math.min(1, rm1 * 3);
        this._scene.fog.near = 380; this._scene.fog.far = 1700;
        this._water.position.x = MX; this._ripple.offset.x = live ? time * 0.004 : 0;
      } else {
        const ds = Math.min(d, 1300), s01 = Math.min(1, ds / 400);
        shp.position.x = -10 + ds; shp.position.z = BERTH + 70 * ss(0, 400, ds); shp.rotation.y = -0.22 * 4 * s01 * (1 - s01);
        this._wake.material.opacity = spd * 0.55;
        const fk = ss(120, 900, d); this._scene.fog.near = 380 - 260 * fk; this._scene.fog.far = 1700 - 950 * fk;
        this._water.position.x = ds; this._ripple.offset.x = (live ? time * 0.004 : 0) + d * 0.015;
      }
      this._sun.target.position.set(c.target.x, 0, c.target.z); this._sun.position.set(c.target.x, 0, c.target.z).addScaledVector(this._sunDir, 600);
      const toU = UNIT[this._active] || UNIT.home, baseRot = toU[4] ?? -Math.PI / 2;
      const PATHS = {
        5: { P: [[MX - 14.6, 118], [MX - 14.6, 96], [MX + 196, 96], [MX + 196, 26]], dur: 8, r0: -Math.PI / 2, rev: true },
        8: { P: [[MX + 196, 26], [MX + 196, -60], [MX + 262, -60], [MX + 262, -238]], dur: 13, r0: Math.PI / 2, rev: false }
      };
      const PH = PATHS[vi];
      if (PH && !reduce()) {
        const P = PH.P;
        const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
        const sd = ease(Math.max(0, Math.min(1, (tS - 1) / PH.dur))) * L[L.length - 1];
        let i = 1; while (i < P.length - 1 && L[i] < sd) i++;
        const f = (sd - L[i - 1]) / (L[i] - L[i - 1]), x = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, z = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f;
        const want = (PH.rev && i === 1) ? -Math.PI / 2 : Math.atan2(-(P[i][1] - P[i - 1][1]), P[i][0] - P[i - 1][0]);
        if (this._uRot == null || tS < 0.2) this._uRot = PH.r0;
        let dA = want - this._uRot; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); this._uRot += dA * (1 - Math.exp(-dt * 3.2));
        u.g.position.set(x, 0, z); u.g.rotation.y = this._uRot; u.truck.visible = true; u.from = null;
      } else { u.g.rotation.y = baseRot; this._uRot = baseRot; }
      const cf = u.coffee, up = u.g.position;
      let mode = 'unit';
      if (vi === 3) { if (tS >= 8.6) mode = 'ship'; else if (tS >= 3.6) mode = 'crane'; }
      else if (vi === 4) { if (tS < 10) mode = 'ship'; else if (tS < 15) mode = 'craneM'; }
      if (mode === 'ship') { shp.updateMatrixWorld(); cf.position.copy(shp.localToWorld(new T.Vector3(-4.6, 13.54, 0))); cf.rotation.set(0, shp.rotation.y, 0); }
      else if (mode === 'crane') { const a = ss(3.6, 5.2, tS), b = ss(5.2, 7.2, tS), cc = ss(7.2, 8.6, tS); cf.position.set(up.x, 2.75 + 29.25 * a - 18.46 * cc, (up.z - 0.6) + (BERTH - (up.z - 0.6)) * b); cf.rotation.set(0, -Math.PI / 2 * (1 - a), 0); }
      else if (mode === 'craneM') { const a = ss(10, 11.5, tS), b = ss(11.5, 13.5, tS), c2 = ss(13.5, 15, tS); cf.position.set(MX - 14.6, 13.54 + 18.46 * a - 29.25 * c2, BERTH + (117.4 - BERTH) * b); cf.rotation.set(0, -Math.PI / 2 * a, 0); }
      else { u.g.updateMatrixWorld(); cf.position.copy(u.g.localToWorld(new T.Vector3(-0.6, 2.75, 0))); cf.rotation.set(0, u.g.rotation.y, 0); }
      const zn = this._zone, insp = vi === 5 && this._inspect && tS > 9.5;
      zn.gantry.position.z = insp ? zn.ZZ + (live ? Math.sin((tS - 9.5) * 0.45 - Math.PI / 2) * 12 : 0) : zn.ZZ - 20;
      zn.scanMat.emissiveIntensity = insp ? 1.2 : 0.1;
      zn.inspectors.forEach(p => { p.visible = insp; });
      const fd = this._fda, smp = vi === 6 && this._inspect;
      fd.g.visible = vi === 6;
      const gt = this._gate, gOpen = vi >= 8 || (vi === 7 && (reduce() || tS > 6.5)) ? 1 : 0;
      gt.open += (gOpen - gt.open) * (reduce() ? 1 : 1 - Math.exp(-dt * 2.5));
      gt.armPivot.rotation.z = gt.open * Math.PI * 0.46;
      gt.sigMat.color.set(gOpen ? '#74c79c' : '#e3b25a'); gt.sigMat.emissive.set(gOpen ? '#74c79c' : '#e3b25a');
      fd.samples.visible = smp;
      const tg2 = smp ? [fd.ZX + 2.6, fd.ZZ + 7.4] : [fd.ZX + 9.5, fd.ZZ + 8.5];
      const fk2 = reduce() ? 1 : 1 - Math.exp(-dt * 2.2);
      fd.fOff2.position.x += (tg2[0] - fd.fOff2.position.x) * fk2;
      fd.fOff2.position.z += (tg2[1] - fd.fOff2.position.z) * fk2;
      fd.fOff2.rotation.y = smp ? Math.PI : -Math.PI / 2;
      fd.fRing.material.opacity = smp ? 0.35 + 0.35 * (live ? (Math.sin(time * 2) + 1) / 2 : 0.5) : 0;
      u.ring.visible = u.ring.visible && !smp;
      u.mk.position.copy(cf.position); u.ring.visible = mode === 'unit';
      const o1 = this._trolleys[1];
      if (vi === 3 && tS < 9.6) {
        const top = cf.position.y + 1.7; let sy = top, tz = cf.position.z;
        if (tS < 3.6) { sy = 30 + (top - 30) * ss(2.6, 3.6, tS); tz = up.z - 0.6; }
        else if (tS >= 8.6) { sy = top + (30 - top) * ss(8.6, 9.6, tS); tz = BERTH; }
        o1.tr.position.z = tz; o1.spreader.position.y = sy; o1.spreader.rotation.y = mode === 'crane' ? cf.rotation.y : 0;
        o1.cable.scale.y = Math.max(1, 47 - sy); o1.cable.position.y = (47 + sy) / 2;
      } else o1.spreader.rotation.y = 0;
      const o4 = this._trolleys[4];
      if (vi === 4 && tS < 16) {
        const top = cf.position.y + 1.7; let sy = top, tz = cf.position.z;
        if (tS < 10) { sy = 30 + (top - 30) * ss(8.5, 10, tS); tz = BERTH; }
        else if (tS >= 15) { sy = top + (30 - top) * ss(15, 16, tS); tz = 117.4; }
        o4.tr.position.z = tz; o4.spreader.position.y = sy; o4.spreader.rotation.y = mode === 'craneM' ? cf.rotation.y : 0;
        o4.cable.scale.y = Math.max(1, 47 - sy); o4.cable.position.y = (47 + sy) / 2;
      } else o4.spreader.rotation.y = 0;
      this._sky.position.copy(cam.position);
      this._renderer.render(this._scene, cam);
    }
  }
  customElements.define('port-scene', PortScene);
})();
