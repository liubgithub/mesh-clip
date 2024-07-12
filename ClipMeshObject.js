import * as THREE from 'three';

export class ClipMeshObject extends THREE.Group {
    constructor() {
        super();
        this.outline = this._createOutline();
        this.clipMeshes = [];
    }

    
    _createOutline() {
        const lineGeometry = new THREE.BufferGeometry();
        const linePosAttr = new THREE.BufferAttribute( new Float32Array( 30000 ), 3, false );
        linePosAttr.setUsage( THREE.DynamicDrawUsage );
        lineGeometry.setAttribute( 'position', linePosAttr );
        const outlineLine = new THREE.LineSegments( lineGeometry, new THREE.LineBasicMaterial() );
        outlineLine.material.color = new THREE.Color(0, 0, 1)
        outlineLine.frustumCulled = false;
        outlineLine.renderOrder = 3;
        this.add(outlineLine);
        return outlineLine;
    }

    addMesh(mesh) {
        this.add(mesh);
        this.clipMeshes.push(mesh);
    }

    clear() {
        super.clear();
        this.outline.geometry.dispose();
        this.clipMeshes.forEach(mesh => {
            mesh.geometry.dispose();
        });
    }
}