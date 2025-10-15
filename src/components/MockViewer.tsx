import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Element } from '../types';

interface MockViewerProps {
  elements: Element[];
  selectedId: string | null;
  onElementSelect: (id: string | null) => void;
}

const MockViewer: React.FC<MockViewerProps> = ({ elements, selectedId, onElementSelect }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const meshesRef = useRef<{ [key: string]: THREE.Mesh }>({});
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animRef = useRef<number | null>(null);

  const statusColorHex = {
    pass: 0x66bb6a,
    warn: 0xffd54f,
    fail: 0xff7043,
    unknown: 0xcccccc,
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0xf0f0f0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(15, 15, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xe0e0e0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create mock elements
    const mockElements = [
      { id: "W1", type: "Wall", props: { UValue: null, fireClass: "F30" }, color: 0xff9999 },
      { id: "W2", type: "Wall", props: { UValue: 0.25, fireClass: null }, color: 0xff9999 },
      { id: "D1", type: "Door", props: { fireClass: null }, color: 0xffcc99 },
      { id: "C1", type: "Column", props: { material: "Concrete" }, color: 0x99ff99 },
    ];

    const group = new THREE.Group();
    mockElements.forEach((m, i) => {
      const geom = new THREE.BoxGeometry(1.5, 2.5, 0.5);
      const mat = new THREE.MeshStandardMaterial({ 
        color: m.color,
        roughness: 0.7,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set((i - 1.5) * 2.5, 0.25, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { id: m.id, originalColor: m.color };
      group.add(mesh);
      meshesRef.current[m.id] = mesh;
    });
    scene.add(group);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onClick(event: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(group.children);
      if (intersects.length > 0) {
        const picked = intersects[0].object as THREE.Mesh;
        const id = picked.userData.id;
        onElementSelect(selectedId === id ? null : id);
      }
    }

    renderer.domElement.addEventListener("click", onClick);
    mountRef.current.appendChild(renderer.domElement);

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      group.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    function handleResize() {
      const w = mountRef.current ? mountRef.current.clientWidth : width;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onClick);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      try {
        mountRef.current && mountRef.current.removeChild(renderer.domElement);
      } catch (e) { /* ignore */ }
      renderer.dispose && renderer.dispose();
      rendererRef.current = null;
      meshesRef.current = {};
    };
  }, []);

  // Apply colors based on element status
  useEffect(() => {
    elements.forEach((el) => {
      const mesh = meshesRef.current[el.id];
      if (!mesh) return;
      const hex = statusColorHex[el.status] || mesh.userData.originalColor;
      if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).color) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(hex);
      }
      if (selectedId === el.id) mesh.scale.set(1.08, 1.08, 1.08);
      else mesh.scale.set(1, 1, 1);
    });
  }, [elements, selectedId]);

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: 520, 
        borderRadius: 6, 
        overflow: 'hidden', 
        border: '1px solid #e5e7eb' 
      }} 
    />
  );
};

export default MockViewer;
