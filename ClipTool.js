import * as THREE from 'three';
import { useStore } from "../../../store/index.js";
const {
      interactionState
  } = useStore();

const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
const material = new THREE.MeshBasicMaterial({
    color: 0xdddddd,
    side: THREE.DoubleSide,
    opacity: 0.2,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,

});
const origin = new THREE.Vector3(0, 0, 0);
const y = new THREE.Vector3(0, -1, 0);
const x = new THREE.Vector3(1, 0, 0);
export default class ClipTool {
    constructor(camera, renderer, render) {
        this._camera = camera;
        this._renderer = renderer;
        this._dom = this._renderer.domElement;
        this._pointer = new THREE.Vector2();
        this._init();
        this._firstDown = true;
        this._startDrawing = false;
        this._enable = false;
        this.render = render;
    }

    _init() {
        this._dom.addEventListener( 'mousedown', this._onPointerDown.bind(this) );
        this._dom.addEventListener( 'mousemove', this._onPointerMove.bind(this) );
        this._dom.addEventListener('mouseup', this._onPointerUp.bind(this));
        this._raycaster = new THREE.Raycaster();
        this._raycaster.setFromCamera(this._pointer, this._camera);
        this._startPoint = new THREE.Vector3();
        this._endPoint = new THREE.Vector3();
        this._helper = new THREE.Group();
        // this._ground = new THREE.Mesh(planeGeometry, material);
        // this._ground.rotation.set(Math.PI / 2, 0, 0);
        this._ground = this._createGround();
        this._helper.add(this._ground);
        this._lineGroup = this._createLine();
        this._helper.add(this._lineGroup);
    }

    _createGround() {
        const GRID_COLORS_LIGHT = [ 0x999999, 0x777777 ];
        const grid = new THREE.Group();

        const grid1 = new THREE.GridHelper( 1000, 20 );
        grid1.material.color.setHex( GRID_COLORS_LIGHT[ 0 ] );
        grid1.material.vertexColors = false;
        grid.add( grid1 );

        const grid2 = new THREE.GridHelper( 1000, 4 );
        grid2.material.color.setHex( GRID_COLORS_LIGHT[ 1 ] );
        grid2.material.vertexColors = false;
        grid.add( grid2 );
        grid.frustumCulled = false;
        const plane = new THREE.Mesh(planeGeometry, material);
        plane.rotation.set(Math.PI / 2, 0, 0);
        grid.add(plane);
        grid.visible = false;
        return grid;
    }

    showGround() {
        this._ground.visible = true;
        this.render();
    }

    hideGround() {
        this._ground.visible = false;
        this.render();
    }

    _createLine() {
        const lineGroup = new THREE.Group();
        const lineGeometry = new THREE.BufferGeometry();
        const linePosAttr = new THREE.BufferAttribute( new Float32Array(6), 3, false );
        linePosAttr.setUsage( THREE.DynamicDrawUsage );
        lineGeometry.setAttribute( 'position', linePosAttr );
        const helperLine = new THREE.LineSegments( lineGeometry, new THREE.LineBasicMaterial() );
        helperLine.material.color = new THREE.Color(0, 0, 1)
        helperLine.frustumCulled = false;
        helperLine.renderOrder = 3;
        this._line = helperLine;
        const dir = new THREE.Vector3( 0, 0, 0 );

        //normalize the direction vector (convert to vector of length 1)
        dir.normalize();

        const origin = new THREE.Vector3( 0, 0, 0 );
        const length = 33;
        const hex = 0xff0000;

        const arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex, 0.2 * length, 0.1 * length  );
        this._arrow = arrowHelper;
        this._arrow.visible = false;
        lineGroup.add(helperLine);
        lineGroup.add(arrowHelper);
        return lineGroup;
    }

    _onPointerDown(event) {
        if (!this._enable) {
            return;
        }
        const raycaster = this._raycaster;
        this._pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(this._pointer, this._camera);
        const intersects = raycaster.intersectObjects([this._ground]);
        if (intersects.length > 0) {
            const posAttr = this._line.geometry.attributes.position;
            const { point } = intersects[0];
            if (this._firstDown) {
                this._arrow.visible = true;
                this._line.visible = true;
                this._startPoint = point;
                this._firstDown = false;
                posAttr.setXYZ(0, point.x, point.y, point.z);
                posAttr.setXYZ(1, point.x, point.y, point.z);
            } else {
                this._dom.className = this._dom.className.replace('tv_clip_cursor', 'tv_cs_rotate');
                posAttr.setXYZ(1, point.x, point.y, point.z);
                this._endPoint = point;
                this._startDrawing = false;
                this._firstDown = true;
                if (this._callback) {
                    const p1 = this._startPoint, p2 = this._endPoint;
                    const center = new THREE.Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
                    const constant = distanceToLine(origin, p1, p2) * Math.sign(p1.x - p2.x);
                    const p2clone = p2.clone();
                    const v = p2clone.sub(p1);
                    const cameraToCenter = this._camera.position.clone().sub(center);
                    const normal = v.clone().cross(cameraToCenter.negate());
                    const size = v.distanceTo(origin);
                    normal.normalize();
                    const scale = new THREE.Vector3(size, size, size);
                    let angle = -Math.atan2(v.z - x.z, v.x - x.x) * 180 / Math.PI;
                    angle = angle < 0 ? angle + 360 : angle;
                    this._callback(normal, constant, center, scale, angle);
                    this._arrow.visible = false;
                    this._line.visible = false;
                }
                this._enable = false;
                delete this._callback;
                interactionState.drawClipLineState = 0;
            }
            posAttr.needsUpdate = true;
        }
    }

    _onPointerMove(event) {
        if (!this._startDrawing || !this._enable) {
            return;
        }
        this._dom.className = this._dom.className.replace('tv_cs_rotate', 'tv_clip_cursor');
        const raycaster = this._raycaster;
        this._pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(this._pointer, this._camera);
        const intersects = raycaster.intersectObjects([this._ground]);
        if (intersects.length > 0) {
            const posAttr = this._line.geometry.attributes.position;
            const { point } = intersects[0];
            posAttr.setXYZ(1, point.x, point.y, point.z);
            posAttr.needsUpdate = true;

            const p1 = this._startPoint, p2 = point;
            const center = new THREE.Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
            const v = p1.clone().sub(p2);
            const normal = v.cross(y);
            normal.normalize();
            this._arrow.position.set(center.x, center.y, center.z);
            this._arrow.setDirection(normal.clone());
            this._arrow.visible = true;
            this.render();
        }
    }

    _onPointerUp(event) {
        if (!this._firstDown) {
            this._startDrawing = true;
        }
    }

    addTo(scene) {
        this._scene = scene;
        scene.add(this._helper);
        scene.clipTool = this;
    }

    update() {
        // this._ground.lookAt(this._camera.position);
        // const dist = this._camera.position.distanceTo(this._ground.position);
        // this._ground.scale.set(dist, dist, dist);
    }

    enable() {
        this._enable = true;
        this._ground.visible = true;
        this._dom.className = this._dom.className.replace('tv_cs_rotate', 'tv_clip_cursor');
        this.render();
    }

    disable() {
        this._enable = false;
        this._ground.visible = false;
        this._arrow.visible = false;
        delete this._callback;
        this._dom.className = this._dom.className.replace('tv_clip_cursor', 'tv_cs_rotate');
        this.render();
    }

    remove() {
        this.disable();
        this._dom.removeEventListen('mousedown', this._onPointerDown);
        this._dom.removeEventListen('mousemove', this._onPointerMove);
        this._dom.removeEventListen('mouseup', this._onPointerUp);
        this._scene.remove(this._helper);
        delete this._scene.clipTool;
        this.render();
    }

    on(cb) {
        this._callback = cb;
    }
}

function distanceToLine(point, lineStart, lineEnd) {
    // 计算直线向量
    const lineDirection = new THREE.Vector3();
    lineDirection.subVectors(lineEnd, lineStart);
 
    // 计算点到直线起点的向量
    const startToPoint = new THREE.Vector3();
    startToPoint.subVectors(point, lineStart);
 
    // 标准化直线向量
    const directionNormalized = lineDirection.clone().normalize();
 
    // 计算点向量在直线上的投影长度
    const scalar = startToPoint.dot(directionNormalized);
 
    // 计算投影点的位置
    const projectedPoint = new THREE.Vector3();
    projectedPoint.copy(directionNormalized).multiplyScalar(scalar).add(lineStart);
 
    // 计算投影点到原点的距离
    const distanceToProjected = startToPoint.subVectors(projectedPoint, point).length();
 
    return distanceToProjected;
}