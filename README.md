# mes-clip
A tool to perform 3D geometric operations, inspired by [lo-th/root](https://github.com/lo-th/root/tree/gh-pages/traffic).

## Install
  
* Install with npm: ```npm install mesh-clip```.
* Use unpkg CDN: ```https://unpkg.com/mesh-clip.min.js```

## Vanilla Javascript
```html
<script type="text/javascript" src="../mesh-clip.js"></script>
<script>
const model = new THREE.Mesh(geometry, material);
const clipplane = new CLIP.ClipPlane([0, 0, 1], 0);
const clipTool = new CLIP.ClipTool();
clipTool.add(clipplane);
const { meshes, lines } = clipTool.clip(model);
</script>
```

## ES6

```javascript
import { ClipPlane, ClipTool } from 'mesh-clip';

const model = new THREE.Mesh(geometry, material);
const clipplane = new CLIP.ClipPlane([0, 0, 1], 0);
const clipTool = new CLIP.ClipTool();
clipTool.add(clipplane);
const { meshes, lines } = clipTool.clip(model);

```

## API
  * ### Class : ClipPlane`(inherited from THREE.Plane)`
    > a layer used to renderering gltf model on map, it manages gltf markers.
    
    #### Method : new ClipPlane(normal, constant) 
    | Parameter | Type | Default | Description|
    | ------------- |---------- |-------------|--------- |
    | `normal`      | String |  | gltflayer's id |
    | `constant`   | Object | null |construct options     |

    #### Method : `(static)`getCliplist(name)
    _register a custom shader to gltf layer_
     | Parameter | Type | Default | Description|
    | ------------- |---------- |-------------|--------- |
    | `name`      | String |  | clipplane's name |

    #### Method : removeClipPlane(name)
    _remove a shaclipplaneder from  clip list_
    | Parameter | Type | Default | Description|
    | ------------- |---------- |-------------|--------- |
    | `name`      | String |  | shader's name |

    #### Method : clip(model)
    _remove a shaclipplaneder from  clip list_
    | Parameter | Type | Default | Description|
    | ------------- |---------- |-------------|--------- |
    | `model`      | String |  | a three 3d object to be clipped |
    > returns : <br>
    meshes and lines

    #### Method : add(clipplane)
    _get all shaders registed to gltf layer_
    | Parameter | Type | Default | Description|
    | ------------- |---------- |-------------|--------- |
    | `clipplane`      | ClipPlane |  | a clip plane object |
    > returns : <br>
    Object: this
