import * as THREE from 'three'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Reflector } from 'three/examples/jsm/objects/Reflector'
import UI from './ui'
import { Socket } from 'socket.io-client'

export default class TheBallGame {
    public gamePhase: number = 0
    private timestamp = 0

    public players: { [id: string]: THREE.Mesh } = {}
    public obstacles: { [id: string]: THREE.Mesh } = {}

    private updateInterval: any

    public myId = ''

    public isMobile = false

    public ui: UI

    //UI Input
    public vec = [0, 0]
    public spcKey = 0

    //scene
    private scene: THREE.Scene
    private renderer: THREE.WebGLRenderer
    public camera: THREE.PerspectiveCamera
    public socket: Socket

    public cameraRotationXZOffset = 0
    public cameraRotationYOffset = 0
    public radius = 4
    public sensitivity = 0.004


    private ambientLight: THREE.AmbientLight
    private backGroundTexture: THREE.CubeTexture
    private jewel = new THREE.Object3D()
    private sphereGeometry = new THREE.SphereBufferGeometry(1, 24, 24)
    private cubeGeometry = new THREE.BoxBufferGeometry(2, 2, 2)
    private sphereMaterial: THREE.MeshBasicMaterial
    private cubeRenderTarget1: THREE.WebGLCubeRenderTarget
    private cubeCamera1: THREE.CubeCamera
    private myMaterial: THREE.MeshPhongMaterial
    private groundMirror: Reflector
    private houseGroup = new THREE.Group();
    private house = new THREE.Object3D();

    constructor(
        socket: Socket,
        scene: THREE.Scene,
        renderer: THREE.WebGLRenderer,
        camera: THREE.PerspectiveCamera
    ) {
        if (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            )
        ) {
            this.isMobile = true
        }

        //threejs
        this.scene = scene
        this.renderer = renderer
        this.camera = camera
        this.socket = socket

        this.ui = new UI(this, renderer.domElement)

        this.ambientLight = new THREE.AmbientLight(0xffffff)
        scene.add(this.ambientLight)

        this.backGroundTexture = new THREE.CubeTextureLoader().load([
            'img/px_eso0932a.jpg',
            'img/nx_eso0932a.jpg',
            'img/py_eso0932a.jpg',
            'img/ny_eso0932a.jpg',
            'img/pz_eso0932a.jpg',
            'img/nz_eso0932a.jpg',
        ])
        scene.background = this.backGroundTexture


        this.sphereMaterial = new THREE.MeshBasicMaterial({
            map: new THREE.TextureLoader().load('img/marble.png'),
            envMap: scene.background,
            reflectivity: 0.66,
            combine: THREE.MixOperation,
        })
        this.cubeRenderTarget1 = new THREE.WebGLCubeRenderTarget(128, {
            format: THREE.RGBFormat,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
        })
        this.cubeCamera1 = new THREE.CubeCamera(0.1, 100, this.cubeRenderTarget1)
        this.myMaterial = new THREE.MeshPhongMaterial({
            map: new THREE.TextureLoader().load('img/marble.png'),
            reflectivity: 0.66,
            color: 0xffffff,
            flatShading: false,
            envMap: this.cubeRenderTarget1.texture,
        })
        scene.add(this.cubeCamera1)

        const loader = new GLTFLoader()
        loader.load(
            'models/female.glb',
            function (gltf) {
                gltf.scene.traverse(function (child) {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = (child as THREE.Mesh)
                        m.receiveShadow = true
                        m.castShadow = true
                    }
                    if (((child as THREE.Light)).isLight) {
                        const l = (child as THREE.Light)
                        l.castShadow = true
                        l.shadow.bias = -.003
                        l.shadow.mapSize.width = 2048
                        l.shadow.mapSize.height = 2048
                    }
                })
                scene.add(gltf.scene)
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
            },
            (error) => {
                console.log(error)
            }
        )


        this.groundMirror = new Reflector(new THREE.PlaneBufferGeometry(50, 50), {
            color: new THREE.Color(0x222222),
            clipBias: 0.003,
            textureWidth: window.innerWidth * window.devicePixelRatio,
            textureHeight: window.innerHeight * window.devicePixelRatio,
        })
        this.groundMirror.position.y = -0.05
        this.groundMirror.rotateX(-Math.PI / 2)
        this.groundMirror.translateX(25)
        this.groundMirror.translateY(-25)


        this.houseGroup.add(this.house);
        this.houseGroup.add(this.groundMirror)
        scene.add(this.houseGroup);

        const wall = new THREE.Shape();
        wall.moveTo(0, 0);
        wall.lineTo(50, 0);
        wall.lineTo(50, 4);
        wall.lineTo(0, 4);
        wall.lineTo(0, 0);

        const wallGeometry = new THREE.ExtrudeBufferGeometry([wall], {
            steps: 2,
            depth: .01,
            bevelEnabled: false,
            curveSegments: 3
        });



        const meshMaterial = new THREE.MeshStandardMaterial({ color: 0xff9999, wireframe: true });
        const wallA = new THREE.Mesh(wallGeometry, this.sphereMaterial);
        this.house.add(wallA);
        console.log(wallGeometry)

        const wallB = wallA.clone();
        wallB.rotateY(-Math.PI / 2);
        this.house.add(wallB);

        const wallC = wallA.clone();
        wallC.translateZ(50);
        this.house.add(wallC);

        const wallD = wallB.clone();

        wallD.translateZ(-50)
        this.house.add(wallD);

        console.log(this.groundMirror)

        //sockets
        socket.on('connect', function () {
            console.log('connect')
        })
        socket.on('disconnect', (message: any) => {
            console.log('disconnect ' + message)
            clearInterval(this.updateInterval)
            Object.keys(this.players).forEach((p) => {
                scene.remove(this.players[p])
            })
        })
        socket.on('joined', (id: string, screenName: string) => {
            this.myId = id;
            ; (
                document.getElementById('screenNameInput') as HTMLInputElement
            ).value = screenName

            this.updateInterval = setInterval(() => {
                socket.emit('update', {
                    t: Date.now(),
                    vec: this.vec,
                    spc: this.spcKey,
                }) //, p: myObject3D.position, r: myObject3D.rotation })
            }, 50)

        })



        socket.on('newGame', () => {

            this.ui.gameClosedAlert.style.display = 'none'
            if (!this.ui.menuActive) {
                this.ui.newGameAlert.style.display = 'block'
                setTimeout(() => {
                    this.ui.newGameAlert.style.display = 'none'
                }, 2000)
            }
        })

        socket.on('removePlayer', (id: string) => {
            scene.remove(scene.getObjectByName(id) as THREE.Object3D)
        })

        socket.on('gameData', (gameData: any) => {
            if (gameData.gameClock >= 0) {
                if (this.gamePhase != 1) {
                    console.log('new game')
                    this.gamePhase = 1
                        ; (
                            document.getElementById('gameClock') as HTMLDivElement
                        ).style.display = 'block'
                        ; (
                            document.getElementById('winnerLabel') as HTMLDivElement
                        ).style.display = 'none'
                        ; (
                            document.getElementById(
                                'winnerScreenName'
                            ) as HTMLDivElement
                        ).innerHTML = ''
                }
                ; (
                    document.getElementById('gameClock') as HTMLDivElement
                ).innerText = Math.floor(gameData.gameClock).toString()
            } else {
                ; (
                    document.getElementById('gameClock') as HTMLDivElement
                ).style.display = 'none'
                if (
                    !this.ui.menuActive &&
                    gameData.gameClock >= -3 &&
                    this.gamePhase === 1
                ) {
                    console.log('game closed')
                    this.ui.gameClosedAlert.style.display = 'block'
                    setTimeout(() => {
                        this.ui.gameClosedAlert.style.display = 'none'
                    }, 4000)
                }
                this.gamePhase = 0
            }
            let pingStatsHtml = 'Socket Ping Stats<br/><br/>'
            Object.keys(gameData.players).forEach((p) => {
                this.timestamp = Date.now()
                pingStatsHtml +=
                    gameData.players[p].screenName +
                    ' ' +
                    (this.timestamp - gameData.players[p].t) +
                    'ms<br/>'
                if (!this.players[p]) {
                    if (p === this.myId) {
                        this.players[p] = new THREE.Mesh(
                            this.sphereGeometry,
                            this.myMaterial
                        )
                    } else {
                        this.players[p] = new THREE.Mesh(
                            this.sphereGeometry,
                            this.sphereMaterial
                        )
                    }
                    this.players[p].name = p
                    this.players[p].position.set(
                        gameData.players[p].p.x,
                        gameData.players[p].p.y,
                        gameData.players[p].p.z
                    )
                    scene.add(this.players[p])
                } else {
                    if (gameData.players[p].p) {
                        if (p === this.myId) {
                            new TWEEN.Tween(this.players[p].position)
                                .to(
                                    {
                                        x: gameData.players[p].p.x,
                                        y: gameData.players[p].p.y,
                                        z: gameData.players[p].p.z,
                                    },
                                    50
                                )
                                .start()
                                .onUpdate(() => {
                                    this.camera.position.set(
                                        this.players[p].position.x +
                                        this.radius *
                                        Math.cos(
                                            this.cameraRotationXZOffset
                                        ),
                                        this.players[p].position.y +
                                        this.radius *
                                        Math.atan(
                                            this.cameraRotationYOffset
                                        ),
                                        this.players[p].position.z +
                                        this.radius *
                                        Math.sin(
                                            this.cameraRotationXZOffset
                                        )
                                    )
                                    this.camera.lookAt(
                                        this.players[this.myId].position.x,
                                        this.players[this.myId].position.y + 1.5,
                                        this.players[this.myId].position.z
                                    )
                                })
                        } else {
                            new TWEEN.Tween(this.players[p].position)
                                .to(
                                    {
                                        x: gameData.players[p].p.x,
                                        y: gameData.players[p].p.y,
                                        z: gameData.players[p].p.z,
                                    },
                                    50
                                )
                                .start()
                        }
                    }
                    if (gameData.players[p].q) {
                        new TWEEN.Tween(this.players[p].quaternion)
                            .to(
                                {
                                    _x: gameData.players[p].q.x,
                                    _y: gameData.players[p].q.y,
                                    _z: gameData.players[p].q.z,
                                    _w: gameData.players[p].q.w,
                                },
                                50
                            )
                            .start()
                            .onUpdate(() => this.players[p].quaternion.normalize())
                    }
                }
            })
        })
    }

    public update = () => {
        if (this.players[this.myId]) {
            this.groundMirror.visible = false
            this.players[this.myId].visible = false
            this.cubeCamera1.position.copy(this.players[this.myId].position)
            this.cubeCamera1.update(this.renderer, this.scene)
            this.groundMirror.visible = true
            this.players[this.myId].visible = true
        }

        TWEEN.update()
    }
}
