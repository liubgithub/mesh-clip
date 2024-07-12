import * as THREE from 'three';
import { useStore } from "../../../store/index.js";
import { TransformControls } from './TransformControls.js';

const { interactionState } = useStore();
const origin = new THREE.Vector3(0, 0, 0);
const y = new THREE.Vector3(0, -1, 0);
const x = new THREE.Vector3(1, 0, 0);
let downTime = null;
export default class ClipTool {
    constructor(camera, renderer, render) {
        this._camera = camera;
        this._renderer = renderer;
        this._dom = this._renderer.domElement;
        this._pointer = new THREE.Vector2();
        this._enable = true;
        this.render = render;
        this._init();
        this._lastPicked = null;
    }

    _init() {
        this._dom.addEventListener( 'click', this._onClick.bind(this) );
        this._dom.addEventListener( 'mousedown', this._onPointerDown.bind(this) );
        this._dom.addEventListener( 'mousemove', this._onPointerMove.bind(this) );
        // this._dom.addEventListener('mouseup', this._onPointerUp.bind(this));
        this._raycaster = new THREE.Raycaster();
        this._raycaster.setFromCamera(this._pointer, this._camera);
        
        const control = new TransformControls( this._camera, this._renderer.domElement );
        control.addEventListener( 'change', (e) => {
            this.render();
        } );

        control.addEventListener( 'dragging-changed', (event) => {
            interactionState.enabled = !event.value;
            const clipPlaneTarget = event.target.object;
            if (clipPlaneTarget) {
                clipPlaneTarget.update();
                clipPlaneTarget.updateOutline();
            }
        });
        this._control = control;
        this._registerKeyEvent();
    }

    _registerKeyEvent() {
        window.addEventListener( 'keydown', function ( event ) {
            const control = this._control;
            if (!control.visible) {
                return;
            }
            switch ( event.key ) {
                case 't':
                    control.setMode( 'translate' );
                    break;
                case 'r':
                    control.setMode( 'rotate' );
                    break;
                case 's':
                    control.setMode( 'scale' );
                    break;
                case '+':
                case '=':
                    control.setSize( control.size + 0.1 );
                    break;
                case '-':
                case '_':
                    control.setSize( Math.max( control.size - 0.1, 0.1 ) );
                    break;
                case 'x':
                    control.showX = ! control.showX;
                    break;
                case 'y':
                    control.showY = ! control.showY;
                    break;
                case 'z':
                    control.showZ = ! control.showZ;
                    break;
                case ' ':
                    control.enabled = ! control.enabled;
                    break;
                case 'Escape':
                    control.reset();
                    break;
            }
        }.bind(this));
    }

    _onClick(event) {
        if (!this._enable) {
            return;
        }
        const clipPlaneList = this._compositeClip.clipPlaneList;
        if (!clipPlaneList || !clipPlaneList.length) {
            return;
        }
        const now = Date.now();
        const diffTime = now - downTime;
        if (diffTime > 300) {
            return;
        }
        const intersects = this._getIntersects(event);
        if (intersects.length > 0) {
            const picked = intersects[0].object;
            this._attachClipPlane(picked);
        } else {
            this._control.detach();
        }
    }

    _onPointerDown(event) {
        downTime = Date.now();
    }

    _onPointerMove(event) {
        if (!this._enable) {
            return;
        }
        const clipPlaneList = this._compositeClip.clipPlaneList;
        if (!clipPlaneList || !clipPlaneList.length) {
            return;
        }

        const intersects = this._getIntersects(event);
        if (intersects.length > 0) {
            this._dom.className = this._dom.className.replace('tv_cs_rotate', 'tv_cs_pick');
            const picked = intersects[0].object;
            picked.showOutline();
            if (this._lastPicked !== picked) {
                if (this._lastPicked) {
                    this._lastPicked.cancelOutline();
                }
                this.render();
            }
            this._lastPicked = picked;
        } else {
            this._dom.className = this._dom.className.replace('tv_cs_pick', 'tv_cs_rotate');
            if (this._lastPicked) {
                this._lastPicked.cancelOutline();
                this.render();
            }
            this._lastPicked = null;
        }
    }

    _getIntersects(event) {
        const clipPlaneList = this._compositeClip.clipPlaneList;
        const raycaster = this._raycaster;
        this._pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(this._pointer, this._camera);
        const clipList = clipPlaneList.filter(clipPlane => { return clipPlane.visible; });
        const intersects = raycaster.intersectObjects(clipList);
        return intersects;
    }

    _attachClipPlane(clipPlane) {
        const lastClipPlane = this._control.object;
        if (lastClipPlane) {
            lastClipPlane.setControl(null);
        }
        clipPlane.setControl(this._control);
        this._control.attach(clipPlane);
    }

    enable() {
        this._enable = true;
    }

    disable() {
        this._enable = false;
    }

    _onPointerUp(event) {

    }

    addTo(scene) {
        this._scene = scene;
        scene.add(this._control);
    }

    bind(compositeClip) {
        this._compositeClip = compositeClip;
    }

    remove() {
        this.disable();
        this._dom.removeEventListen('mousedown', this._onPointerDown);
        this._dom.removeEventListen('click', this._onClick);
        // this._dom.removeEventListen('mouseup', this._onPointerUp);
        this._scene.remove(this._control);
        delete this._scene;
        delete this._compositeClip;
        this.render();
    }
}
