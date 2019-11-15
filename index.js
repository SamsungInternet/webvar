class App {
    constructor() {
        this.onXRFrame = this.onXRFrame.bind(this);
        this.onEnterAR = this.onEnterAR.bind(this);

        this.init();
    }

    async init() {
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar').then(
                (isSupported) => {
                    if(!isSupported) alert("immersive ar not supported");
                }
            );
        } else {
            alert("WebXR not enabled");
            return;
        }

        window.addEventListener('click', this.onEnterAR);
    }

    

    async onEnterAR() {
        const outputCanvas = document.createElement('canvas');

        navigator.xr
            .requestSession('immersive-ar')
            .then(xrSession => {
                this.session = xrSession;
                console.log('requestSession immersive-ar ok');
                xrSession.addEventListener(
                    'end',
                    this.onXRSessionEnded.bind(this)
                );
                document.body.appendChild(outputCanvas);
                this.onSessionStarted();
            })
            .catch(error => {
                console.warn('requestSession immersive-ar error: ', error);
                this.onNoXRDevice();
            });
    }

    onXRSessionEnded() {
        console.log('onXRSessionEnded');
        if (this.renderer) {
            this.renderer.vr.setSession(null);
        }
    }

    async onSessionStarted() {
        this.renderer = new THREE.WebGLRenderer({
            alpha: false,
            preserveDrawingBuffer: false
        });
        
        this.gl = this.renderer.getContext();

        // this.renderer.vr === new WebXRManager(...) -> https://github.com/mrdoob/three.js/blob/dev/src/renderers/webvr/WebXRManager.js
        this.renderer.vr.enabled = true;

        this.XRReferenceSpaceType = 'local';

        this.renderer.vr.setReferenceSpaceType(this.XRReferenceSpaceType);
        this.renderer.vr.setSession(this.session);

        this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);

        this.scene = new THREE.Scene();

        var material = new THREE.MeshPhysicalMaterial();

        var geometry = new THREE.SphereBufferGeometry( 5, 32, 32 );
        
        for(var i=0; i < 50; i++){
            var mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.set(2 + Math.random() * 10, 2 + Math.random() * 10, 2 + Math.random() * 10);
            mesh.material.color = new THREE.Color("hsl("+Math.random()+", 66%, 66%)");
            this.scene.add(mesh);
        }

        var light = new THREE.DirectionalLight( 0xffffff, 0.5 );

        light.position.set(100, 100, 100);

        this.scene.add(light);

        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        var cameraL = new PerspectiveCamera();
        
        cameraL.matrixAutoUpdate = false;

        var hipd = 0.02;

        cameraL.position.x = -hipd;

        var cameraR = new PerspectiveCamera();
        
        cameraR.matrixAutoUpdate = false;

        cameraR.position.x = hipd;
    
        this.cameraL = cameraL;
        
        this.cameraR = cameraR;

        this.camera.add(cameraL);

        this.camera.add(cameraR);

        this.scene.add(camera);
    
        this.frameOfRef = await this.session.requestReferenceSpace('local');

        this.tick();
    }

    tick() {
        this.rafId = this.session.requestAnimationFrame(this.onXRFrame);
    }

    onXRFrame(time, frame) {
        const { session } = frame;

        const pose =
            'getDevicePose' in frame
                ? frame.getDevicePose(this.frameOfRef)
                : frame.getViewerPose(this.frameOfRef);

        // Queue up the next frame
        this.tick();

        if (pose == null) {
            return;
        }

        for (const view of frame.getViewerPose(this.frameOfRef).views) {
            const viewport = session.renderState.baseLayer.getViewport(view);
            
            this.camera.projectionMatrix.fromArray(view.projectionMatrix);
            const viewMatrix = new THREE.Matrix4().fromArray(
                view.transform.inverse.matrix
            );

            this.camera.matrix.getInverse(viewMatrix);
            this.camera.updateMatrixWorld(true);
            this.cameraL.updateMatrixWorld(true);
            this.cameraR.updateMatrixWorld(true);

            var fov = 2 * atan(1/view.projectionMatrix.elements[5]) * 180 / PI;

            var near = view.projectionMatrix.elements[14] / (view.projectionMatrix.elements[10] - 1.0);

            var far = view.projectionMatrix.elements[14] / (view.projectionMatrix.elements[10] + 1.0);

            var aspect = 0.5 * viewport.width /  viewport.height;

            [this.cameraL, this.cameraR].forEach(function(c) {
                c.fov = fov;
                c.near = near;
                c.far = far;
                c.aspect = aspect;
            });

            this.renderer.setViewport(
                viewport.x,
                viewport.y,
                viewport.width / 2,
                viewport.height
            );

            this.renderer.render(this.scene, this.cameraL);
        
            this.renderer.setViewport(
                viewport.width / 2,
                viewport.y,
                viewport.width / 2,
                viewport.height
            );

            this.renderer.render(this.scene, this.cameraR);
           
        }

    }
}

window.app = new App();