import * as THREE from "three";
import { MeshBVH  } from 'three-mesh-bvh';

export default class CompositeClip extends THREE.Group  {
    constructor(scene, clipPlaneList) {
        super();
        this.clipPlaneList = clipPlaneList || [];
        this.addTo(scene);
        this.nameMap = {};
        this.positions = [];
    }
    
    //添加剖切面
    addClipPlane(clipPlane) {
        // if (this.nameMap[clipPlane.name]) {
        //     throw new Error('plane name ' + clipPlane.name + ' is exist!');
        // }
        clipPlane._compo = this;
        this.clipPlaneList.push(clipPlane);
        this.add(clipPlane);
        this.nameMap[clipPlane.name] = 1;
        clipPlane.renderOrder = this.clipPlaneList.length + 1.1;
        if (this.target) {
            clipPlane.clip(this.target);
            this._setClippingPlanes(this.target, this.clipPlaneList.map(cp => { return cp.plane; }));
            this.target.renderOrder = this.clipPlaneList.length * 2;
        }
    }
    
    //删除剖切面
    removeClipPlane(clipPlane) {
        const index = this.clipPlaneList.indexOf(clipPlane);
        if (index > -1) {
            delete this.nameMap[clipPlane.name];
            this.clipPlaneList.splice(index, 1);
            clipPlane.clear();
            this.remove(clipPlane);
            clipPlane.detachControl();
            clipPlane.geometry.dispose();
            this._setClippingPlanes(this.target, this.clipPlaneList.map(cp => { return cp.plane; }));
            this.updateClippingPlanesForPlanesAndLines();
            this.target.renderOrder = this.clipPlaneList.length * 2;
        }
    }

    getCliplane(name) {
        if (!name) {
            return null;
        }
        return this.clipPlaneList.filter(plane => plane.name === name)[0];
    }

    hasPlane(name) {
        return this.nameMap[name];
    }
    
    //指定待剖切的模型
    clip(target) {
        if (!target) {
            return;
        }
        this._createColliderBvh(target);
        this.target = target;
        this._setClippingPlanes(this.target, this.clipPlaneList.map(cp => { return cp.plane; }));
        this.clipPlaneList.forEach(clipPlane => {
            clipPlane.clip(target);
        });
        this.updateClippingPlanesForPlanesAndLines();
    }

    //开启剖切
    enable() {
        this.enabled = true;
    }
    
    //关闭剖切
    disable() {
        this.enabled = false;
    }
    
    //添加至场景
    addTo(scene) {
        if (!scene) {
            return;
        }
        this.scene = scene;
        scene.add(this);
    }
    
    //清空剖切面
    clear() {
        this.clipPlaneList.forEach(clipPlane => {
            this.removeClipPlane(clipPlane);
        });
        this.clipPlaneList = [];
    }
    
    //移除出场景
    removeFrom() {
        if (this.scene) {
            this.scene.remove(this);
        }
        this._clearStencilGroup();
        this.clipPlaneList = [];
        this.scene = null;
    }

    _clearStencilGroup() {
        this.children.forEach(child => {
            if (child.isStencilGroup) {
                child.clear();
                this.remove(child);
            }
        });
    }

    _createColliderBvh(model) {
        if (model.isMesh && !model.colliderBvh) {
            model.colliderBvh = new MeshBVH( model.geometry, { maxLeafTris: 3 } );
			model.geometry.boundsTree = model.colliderBvh;
        } else {
            model.children.forEach(m => {
                this._createColliderBvh(m);
            });
        }
    }

    updateClippingPlanesForPlanesAndLines() {
        const clipPlanes = this.clipPlaneList;
        clipPlanes.forEach(clipPlane => { 
            const clippingPlanes = clipPlanes.filter(cp => {
                if (cp !== clipPlane && cp.visible) {
                    return true;
                } else { return false;}
            }).map(cp => { return cp.plane; });
            clipPlane.clipBy(clippingPlanes);
        });
    }

    updateClippingPlanes() {
        const planes = [];
        for (let i = 0; i < this.clipPlaneList.length; i++) {
            if (this.clipPlaneList[i].visible) {
                planes.push(this.clipPlaneList[i].plane);
            }
        }
        this._setClippingPlanes(this.target, planes);
    }

    _visibleClipOutlines(node) {
        if (node.isMesh) {
            
        } else {
            node.children.forEach(n => {
                this._visibleClipOutlines(n, clipPlane);
            });
        }
    }
    
    //for model meshes
    _setClippingPlanes(node, planes) {
        if ((node.isMesh || node.isLine) && node.material) {
            node.material.clippingPlanes = planes;
        }
        node.children.forEach(child => {
            this._setClippingPlanes(child, planes);
        });
    }

    _setClippingPlanesForClipMesh(clipPlanes) {
        clipPlanes.forEach(clipPlane => { 
            const clippingPlanes = clipPlanes.filter(cp => {
                if (cp !== clipPlane && cp.visible) {
                    return true;
                } else { return false;}
            }).map(cp => { return cp.plane; });
            clipPlane.clipBy(clippingPlanes);
        });
    }

    _updatePlaneObjectPosition() {
        this.children.forEach(child => {
            if (child.updatePosition) {
                child.lookAt(
                    child.position.x - child.plane.normal.x,
                    child.position.y - child.plane.normal.y,
                    child.position.z - child.plane.normal.z,
                );
            }
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

function filterPlanes(clipPlaneList, plane) {
    const planes = [];
    clipPlaneList.forEach(cp => {
        if (plane !== cp.plane && cp.visible) {
            planes.push(cp.plane);
        }
    });
    return planes;
}