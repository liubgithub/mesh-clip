import * as THREE from 'three';
import { ClipMeshObject } from './ClipMeshObject';
import earcut, { flatten } from "earcut";
import { booleanContains } from "@turf/boolean-contains";
import { polygon } from "@turf/helpers";

const xyNormal = new THREE.Vector3(0, 0, 1);

const planeGeometry = new THREE.PlaneGeometry(1, 1);
const TEMP_VECTOR = new  THREE.Vector3(0, 0, 0);
const material = new THREE.MeshBasicMaterial({
    color: 0xdddddd,
    side: THREE.DoubleSide,
    opacity: 0.5,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,

});
let renderOrderIndex = 999;
const NORMAL = new THREE.Vector3(1, 0, 0);
export default class ClipPlane extends THREE.Mesh {
    constructor(plane, options) {
        super(planeGeometry);
        if (options.name === undefined || options.name === null) {
            throw new Error('should set name for plane');
        }
        this.plane = plane;
        this.plane.normal.normalize();
        this.options = options || {};
        this.name = this.options.name;//剖切面名称
        const position = this.options.position || new THREE.Vector3(0, 0, 0);
        this.position.set(position.x, position.y, position.z);
        this.plane.translate(this.position);
        const scale = this.options.scale || new THREE.Vector3(1, 1, 1);
        this.scale.set(scale.x, scale.y, scale.z);//剖切面尺寸
        const rotation = this.options.rotation || [0 , 0, 0];
        this.rotation.set(rotation[0], rotation[1], rotation[2]);
        this.updateMatrixWorld();
        this.visible = this.options.showHelper;
        this.material = material;
        this.renderOrder = renderOrderIndex;
        renderOrderIndex ++;
        this.outline = this._createOutline();
        this.updateOutline();
        this.clipMeshObjectGroup= new THREE.Group();
        this._originPosition = this.position.clone();
        this._originRotation = this.rotation.clone();
    }

    clip(target) {
        this.target = target;
        this.shapecast();
    }

    shapecast() {
        this.clear();
        this._shapecast(this.target);
        this._compo.updateClippingPlanesForPlanesAndLines();
     }
 
     _shapecast(node) {
         if (node.isMesh) {
             const clipMeshObject = this._shapecastMesh(node);
             this._linesegmentToLine(node, clipMeshObject);
         } else {
             node.children.forEach(n => {
                 this._shapecast(n);
             });
         }
     }

     _shapecastMesh(mesh) {
        const clipMeshObjet = new ClipMeshObject();
        this.clipMeshObjectGroup.add(clipMeshObjet);
        const tempVector = new THREE.Vector3();
        const tempVector1 = new THREE.Vector3();
        const tempVector2 = new THREE.Vector3();
        const tempVector3 = new THREE.Vector3();
        const tempLine = new THREE.Line3();
        const inverseMatrix = new THREE.Matrix4();
        const localPlane = new THREE.Plane();

        const clippingPlane = this.plane;
        inverseMatrix.copy( mesh.matrixWorld ).invert();
		localPlane.copy( clippingPlane ).applyMatrix4( inverseMatrix );

		let index = 0;
        const outlineLine = clipMeshObjet.outline;
        outlineLine.matrixAutoUpdate = false;
		const posAttr = outlineLine.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setXYZ( i, 0, 0, 0 );
        }
        outlineLine.matrix.copy(mesh.matrixWorld);
        outlineLine.updateMatrixWorld(true);
        const colliderBvh = mesh.colliderBvh;
        colliderBvh.shapecast( {

			intersectsBounds: box => {

				return localPlane.intersectsBox( box );

			},

			intersectsTriangle: tri => {
				// check each triangle edge to see if it intersects with the plane. If so then
				// add it to the list of segments.
				let count = 0;

				tempLine.start.copy( tri.a );
				tempLine.end.copy( tri.b );
				if ( localPlane.intersectLine( tempLine, tempVector ) ) {
                    if (!isNaN(tempVector.x) && !isNaN(tempVector.y) && !isNaN(tempVector.z)) {
                        posAttr.setXYZ( index, tempVector.x, tempVector.y, tempVector.z );
                        index ++;
                        count ++;
                    }
				}

				tempLine.start.copy( tri.b );
				tempLine.end.copy( tri.c );
				if ( localPlane.intersectLine( tempLine, tempVector ) ) {
                    if (!isNaN(tempVector.x) && !isNaN(tempVector.y) && !isNaN(tempVector.z)) {
                        posAttr.setXYZ( index, tempVector.x, tempVector.y, tempVector.z );
                        count ++;
                        index ++;
                    }

				}

				tempLine.start.copy( tri.c );
				tempLine.end.copy( tri.a );
				if ( localPlane.intersectLine( tempLine, tempVector ) ) {
                    if (!isNaN(tempVector.x) && !isNaN(tempVector.y) && !isNaN(tempVector.z)) {
                        posAttr.setXYZ( index, tempVector.x, tempVector.y, tempVector.z );
                        count ++;
                        index ++;
                    }

				}

				// When the plane passes through a vertex and one of the edges of the triangle, there will be three intersections, two of which must be repeated
				if ( count === 3 ) {

					tempVector1.fromBufferAttribute( posAttr, index - 3 );
					tempVector2.fromBufferAttribute( posAttr, index - 2 );
					tempVector3.fromBufferAttribute( posAttr, index - 1 );
					// If the last point is a duplicate intersection
					if ( tempVector3.equals( tempVector1 ) || tempVector3.equals( tempVector2 ) ) {

						count --;
						index --;

					} else if ( tempVector1.equals( tempVector2 ) ) {

						// If the last point is not a duplicate intersection
						// Set the penultimate point as a distinct point and delete the last point
						posAttr.setXYZ( index - 2, tempVector3 );
						count --;
						index --;

					}

				}

				// If we only intersected with one or three sides then just remove it. This could be handled
				// more gracefully.
				if ( count !== 2 ) {

					index -= count;

				}

			},

		} );
        outlineLine.geometry.setDrawRange( 0, index );
		outlineLine.position.copy( clippingPlane.normal ).multiplyScalar( - 0.00001 );
		posAttr.needsUpdate = true;
        return clipMeshObjet;
    }

    clearClipMesh(clipPlane) {
        clipPlane.clipMeshes.forEach(m => {
            this.clipMeshGroup.remove(m);
            m.geometry.dispose();
            m.material.dispose();
        });
        clipPlane.clipMeshes = [];
    }

    
    _findNext(line, vMapList) {
        if (!vMapList.length) {
            return;
        }
        const next = this._find(line, vMapList);
        if (next) {
            this._findNext(next, vMapList);
        } else {
            const firstOne = vMapList[0];
            firstOne.header = true;
            vMapList.splice(0, 1);
            this._findNext(firstOne, vMapList);
        }
    }

    _find(line, vMapList) {
        for (let i = 0; i < vMapList.length; i++) {
            const start1 = line.start;
            const end1 = line.end;
            const toCompareLine = vMapList[i];
            if ((toCompareLine.pre && toCompareLine.pre.id === line.id) || (toCompareLine.next && toCompareLine.next.id === line.id)) {
                debugger
                continue;
            }
            const start2 = copy(toCompareLine.start);
            const end2= copy(toCompareLine.end);
            if ((equal(start1, start2) && equal(end1, end2)) || (equal(start1, end2) && equal(end1, start2))) {
                continue;
            } if (equal(end1, start2)) {
                toCompareLine.start = line.end;
                line.next = toCompareLine;
                toCompareLine.pre = line;
                vMapList.splice(i, 1);
                return toCompareLine;
            } else if(equal(end1, end2)) {
                toCompareLine.start = [end2[0], end2[1], end2[2]];
                toCompareLine.end = [start2[0], start2[1], start2[2]];
                toCompareLine.start = line.end;
                line.next = toCompareLine;
                toCompareLine.pre = line;
                vMapList.splice(i, 1);
                return toCompareLine;
            }
        }
    }

    _linesegmentToLine(mesh, clipMeshObjet) {
        const normal = this.plane.normal;
        let needExchange = false;
        let axis = 0;//需要交换哪个轴
        if (xyNormal.dot(normal) === 0) {
            needExchange = true;
            if (!normal.x && normal.y && !normal.z) {//通过剖切面的法向量方向来判断是否需要交换z的值，用以计算triangles indice，这是因为earcut只支持xy平面造成需要进行这一步逻辑
                axis = 1;//此时剖切面朝向y轴方向，需要交换yz值
            }
        }
        const outlineLine = clipMeshObjet.outline;
        const linePosAttr = outlineLine.geometry.attributes.position;
        const vMap = [];
        const vMapList = [];
        const arr = linePosAttr.array;
        const validPositions = [];

        for (let i = 0; i < linePosAttr.count; i += 1) {
            let x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
            if ((x === 0 && y === 0 && z === 0)) {
                break;
            }
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                x = y = z = 0;
            }
            const v = new THREE.Vector3(x, y, z);
            v.applyMatrix4(outlineLine.matrixWorld);
            v.x = Math.abs(v.x) < 1e-10 ? 0 : v.x;
            v.y = Math.abs(v.y) < 1e-10 ? 0 : v.y;
            v.z = Math.abs(v.z) < 1e-10 ? 0 : v.z;
            if (needExchange) {
                exchangeXZ(v, axis);
            }
            validPositions.push([v.x, v.y, v.z]);
        }
        if (!validPositions.length) {
            return;
        }
        for (let i = 0; i < validPositions.length; i += 2) {
            const start = validPositions[i];
            const end = validPositions[i + 1];
            if (!end) {
                continue;
            }
            const x = start[0], y = start[1], z = start[2];
            const x1 = end[0], y1 = end[1], z1 = end[2];
            const line = {
                id: i / 2,
                start: [x, y, z],
                end: [x1, y1, z1]
            }
            vMapList.push(line);
            vMap.push(line);
        }
        const lineString = [];
        const polygons = [];
        const polygonsBak = [];
        const firstOne = vMapList[0];
        firstOne.header = true;
        vMapList.splice(0, 1);
        this._vMap = vMap;
        this._findNext(firstOne, vMapList);
        for (let i = 0; i < vMap.length; i++) {
            if (vMap[i].header) {
                lineString.push(vMap[i]);
            }
        }
       
        for (let i = 0; i < lineString.length; i++) {
            const headerOne = lineString[i];
            const linePositions = [];
            linePositions.push(headerOne.start);
            this._traverseNextLines(headerOne, linePositions);
            if (linePositions.length < 10) {
                continue;
            }
            polygons.push(linePositions);
            polygonsBak.push(linePositions);
        }
         
        if (!polygons.length) {
            return;
        } else if (polygons.length === 1) {
            polygons[0].outer = true;
        } else if (polygons.length > 1) {
            const startOne = polygons[0];
            polygons.splice(0, 1);
            this._findHoles(startOne, polygons);
        }
        mesh.clipHatch = mesh.clipHatch || new THREE.Vector2(random(-20, 20), random(-20, 20));
        mesh.clipColor = mesh.clipColor || new THREE.Color(random(0.1, 1), random(0.1, 1), random(0.1, 1));
        const hatchParams = mesh.clipHatch;
        const color = mesh.clipColor;
        for (let i = 0; i < polygonsBak.length; i++) {
            if (polygonsBak[i].outer) {
                const multipolygon = [polygonsBak[i]];
                if (polygonsBak[i].holes) {
                    polygonsBak[i].holes.forEach(h => {
                        multipolygon.push(h);
                    });
                }
                const clipMesh = this.drawClipMesh(multipolygon, color, hatchParams, needExchange, axis);
                clipMeshObjet.addMesh(clipMesh);
            }
        }
    }

    drawClipMesh(multipolygon, color, hatchParams, needExchange, axis) {
        const flattenResult = flatten(multipolygon);
        const { vertices, holes, dimensions } = flattenResult;
        const triangles = earcut(vertices, holes, dimensions);
        if (needExchange) {
            for (let i = 0; i < vertices.length / 3; i++) {
                const t = vertices[i * 3 + axis];
                vertices[i * 3 + axis] = vertices[i * 3 + 2];
                vertices[i * 3 + 2] = t;
            }
        }
        const planeGeometry = new THREE.BufferGeometry();
        const planePosAttr = new THREE.BufferAttribute(new Float32Array(vertices), 3, true);
        planeGeometry.setAttribute( 'position', planePosAttr);
        planeGeometry.setIndex(triangles);
        const mat = getClipplaneMaterial(color, hatchParams);
        const planeMesh = new THREE.Mesh(planeGeometry, mat);
        // planeMesh.matrixAutoUpdate = false;
        // planeMesh.matrix.copy(outlineLines.matrixWorld);
        planeMesh.updateMatrixWorld(true);
        // this.clipMeshGroup.add(planeMesh);
        return planeMesh;
    }

    _findHoles(polygon, polygons) {
        if (!polygons.length) {
            return;
        }
        for (let i = 0 ; i < polygons.length; i++) {
            this._isContains(polygon, polygons[i]);
        }
        for (let i = 0 ; i < polygons.length; i++) {
            if (polygons[i].hole) {
                polygons.splice(i, 1);
            }
        }
        const startOne = polygons[0];
        if (startOne) {
            polygons.splice(0, 1);
            this._findHoles(startOne, polygons);
        }
    }

    _isContains(p1, p2) {
        const p1_1 = p1.map(c => { return [c[0], c[1]];});
        checkTail(p1_1);
        const p2_2 = p2.map(c => { return [c[0], c[1]];});
        checkTail(p2_2);
        try {
            const polygon1 = polygon([p1_1]);
            const polygon2 = polygon([p2_2]);
            p1.outer = true;
            p2.outer = true;
            if (booleanContains(polygon1, polygon2)) {
                p1.holes = p1.holes || [];
                p1.holes.push(p2);
                p2.hole = true;
                p2.outer = false;
                return true;
            } else if (booleanContains(polygon2, polygon1)) {
                p2.outer = true;
                p2.holes = p2.holes || [];
                p2.holes.push(p1);
                p1.hole = true;
                p1.outer = true;
                return true;
            }
        } catch(err) {
            console.log(err);
        }
        return false;
    }

    _traverseNextLines(line, linePositions) {
        linePositions.push(line.end);
        if (line.next) {
            this._traverseNextLines(line.next, linePositions);
        }
    }
    
    //更新剖切面位置
    updatePosition(position, update) {
        this.position.set(position[0], position[1], position[2]);
        const plane = this.plane;
        plane.constant = -this.position.dot(plane.normal);
        if (update) {
            this.shapecast();
            this.updateOutline();
            this.updateUIPlane();
        }
    }

    update() {
        this._lookAt(this.rotation);
        this.shapecast();
        this.updateOutline();
        this.updateUIPlane();
    }

    reset() {
        const position = this._originPosition;
        const rotation = [this._originRotation.x * 180 / Math.PI, this._originRotation.y * 180 / Math.PI, this._originRotation.z * 180 / Math.PI];
        this.position.set(position.x, position.y, position.z);
        this.updateRotation(rotation, true);
    }
    
    updateRotation(rotation, update) {
        const r = new THREE.Euler(rotation[0] * Math.PI / 180, rotation[1] * Math.PI / 180, rotation[2] * Math.PI / 180);
        this.rotation.set(r.x, r.y, r.z);
        this._lookAt(r);
        if (update) {
            this.shapecast();
            this.updateOutline();
            this.updateUIPlane();
        }
    }

    _lookAt(euler) {
        const normal = !this._negated ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);
        normal.applyEuler(euler);
        this.plane.normal.set(normal.x, normal.y, normal.z);
        this.plane.constant = 0;
        this.plane.translate(this.position);
    }

    updateUIPlane() {
        if (this.uiPlane) {
            const plane = this.uiPlane;
            plane.position = fixArray(this.position.toArray());
            plane.rotation = fixArray(fixAngle(this.rotation));
            plane.scale = fixArray(this.scale.toArray());
        }
    }

    remove() {
        if (this._compo) {
            this._compo.removeClipPlane(this);
            this._compo.remove(this.outline);
            delete this._compo;
        }
    }

    addTo(compositeClip) {
        compositeClip.addClipPlane(this);
        compositeClip.add(this.outline);
        compositeClip.add(this.clipMeshObjectGroup);
    }

    negate() {
        this.plane.negate();
        this._negated = !this._negated;
        this.shapecast();
        this.updateOutline();
        this.updateUIPlane();
    }

    show() {
        this.visible = true;
        if (this.stencilGroup) {
            this.stencilGroup.visible = true;
        }
        if (this._compo) {
            this._compo.updateClippingPlanes();
            this._compo.updateClippingPlanesForPlanesAndLines();
        }

        if (this.outlineLines) {
            this.outlineLines.forEach(line => { line.visible = true;});
        }
        this.clipMeshObjectGroup.visible = true;
    }

    updateScale(scale) {
        this.scale.set(scale[0], scale[1], 1);
    }

    hide() {
        this.visible = false;
        if (this.stencilGroup) {
            this.stencilGroup.visible = false;
        }
        if (this._compo) {
            this._compo.updateClippingPlanes();
            this._compo.updateClippingPlanesForPlanesAndLines();
        }

        if (this.outlineLines) {
            this.outlineLines.forEach(line => { line.visible = false;})
        }

        this.clipMeshObjectGroup.visible = false;
        if (this._control) {
            this._control.detach();
        }
    }

    setControl(control) {
        this._control = control;
    }

    getControl() {
        return this._control;
    }

    detachControl() {
        if (this._control) {
            this._control.detach();
        }
    }

    _createOutline() {
        const lineGeometry = new THREE.EdgesGeometry(planeGeometry);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.LineSegments(lineGeometry, material);
        line.visible = false;
        return line;
    }

    updateOutline() {
        this.outline.position.copy(this.position);
        this.outline.rotation.copy(this.rotation);
        this.outline.scale.copy(this.scale);
    }

    showOutline() {
        this.outline.visible = true;
    }

    cancelOutline() {
        this.outline.visible = false;
    }

    clear() {
        this.clipMeshObjectGroup.clear();
    }

    clipBy(clippingPlanes) {
        this.clipMeshObjectGroup.children.forEach(c => {
            c.outline.material.clippingPlanes = clippingPlanes;
            c.clipMeshes.forEach(mesh => {
                mesh.material.clippingPlanes = clippingPlanes;
            });
        });
    }
}

function getClipplaneMaterial(color, hatchParams) {
    // return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    return new THREE.ShaderMaterial( {
        side: THREE.DoubleSide,
        clipping: true,
        uniforms: {
            color: { value: new THREE.Vector3(1, 1, 1) },
            hatchParams: { value:  hatchParams },
            hatchTintColor: { value: color },
            hatchTintIntensity: { value: 1 }
        },
        vertexShader: `
            #include <clipping_planes_pars_vertex>
            void main() {
                // gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                vec3 transformed = vec3( position );
                #include <project_vertex>
                #include <clipping_planes_vertex>
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform vec2 hatchParams;
            uniform vec3 hatchTintColor;
            uniform float hatchTintIntensity;
            vec4 calculateHatchPattern(vec2 hatchParams, vec2 coord, vec4 fragColor, vec3 hatchTintColor, float hatchTintIntensity ) {
                float hatchSlope = hatchParams.x;
                float hatchPeriod = hatchParams.y;
                if (abs(hatchSlope) <= 1.0) {
                    float hatchPhase = coord.y - hatchSlope * coord.x;
                    float dist = abs(mod((hatchPhase), (hatchPeriod)));
                    if (dist < 2.0) {
                        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    }
                    else {
                        fragColor.xyz = mix(fragColor.xyz, hatchTintColor, hatchTintIntensity);
                    }
    
                }
                else {
                    float hatchPhase = - coord.y / hatchSlope + coord.x;
                    float dist = abs(mod((hatchPhase), (hatchPeriod)));
                    if (dist < 1.0) {
                        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    }
                    else {
                        fragColor.xyz = mix(fragColor.xyz, hatchTintColor, hatchTintIntensity);
                    }
    
                }
                return fragColor;
            }
            #include <clipping_planes_pars_fragment>
            void main( void ) {
                gl_FragColor = vec4( color, 1.0 );
            	#include <clipping_planes_fragment>
                gl_FragColor = calculateHatchPattern(hatchParams, gl_FragCoord.xy, gl_FragColor, hatchTintColor, hatchTintIntensity);
            }
        `
    });
}

function checkTail(p) {
    const start = p[0];
    const end = p[p.length - 1];
    if (start[0] !== end[0] || start[1] !== end[1]) {
        p.push(start);
    }
}

function equal(pos1, pos2) {
    const error = 1e-5;
    if (Math.abs(pos1[0] - pos2[0]) < error && Math.abs(pos1[1] - pos2[1]) < error && Math.abs(pos1[2] - pos2[2]) < error) {
        return true;
    }
    return false;
}

function copy(arr) {
    return [arr[0], arr[1], arr[2]];
}

function random(m, n)  {
    return Math.ceil(Math.random() * (n-m+1) + m-1)
}

function exchangeXZ(v, axis) {
    if (axis === 0) {
        const t = v.x;
        v.x = v.z;
        v.z = t;
    } else if (axis === 1) {
        const t = v.y;
        v.y = v.z;
        v.z = t;
    }
}

function fixArray(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Number(arr[i].toFixed(2));
    }
    return arr;
}
  
function fixAngle(rotation) {
    let x = rotation.x * 180 / Math.PI;
    x = x < 0 ? x + 360 : x;
    let y = rotation.y * 180 / Math.PI;
    y = y < 0 ? y + 360 : y;
    let z = rotation.z * 180 / Math.PI;
    z = z < 0 ? z + 360 : z;
    return [x, y, z];
  }