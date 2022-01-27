import * as CANNON from 'cannon-es'
import TheBallGame from './theBallGame'


export default class Physics {
    public world = new CANNON.World()
    public bodies: { [id: string]: CANNON.Body } = {}

    public groundMaterial: CANNON.Material
    public slipperyMaterial: CANNON.Material

    public jewelBody: CANNON.Body = new CANNON.Body()

    private theBallGame: TheBallGame

    constructor(theBallGame: TheBallGame, io: any) {
        this.theBallGame = theBallGame

        this.world.gravity.set(0, -9.82, 0)

        this.groundMaterial = new CANNON.Material('groundMaterial')
        this.groundMaterial.friction = 0.15
        this.groundMaterial.restitution = 0.25
        this.slipperyMaterial = new CANNON.Material('slipperyMaterial')
        this.slipperyMaterial.friction = 0.15
        this.slipperyMaterial.restitution = 0.25

        const groundShape = new CANNON.Box(new CANNON.Vec3(50, 1, 50))
        const groundBody = new CANNON.Body({
            mass: 0,
            material: this.groundMaterial,
        })
        groundBody.addShape(groundShape)
        groundBody.position.x = 0
        groundBody.position.y = -1
        groundBody.position.z = 0
        this.world.addBody(groundBody)
}

    public createPlayerSphere(id: string): number {
        const sphereShape = new CANNON.Sphere(1)
        const sphereBody = new CANNON.Body({
            mass: 1,
            material: this.slipperyMaterial,
        }) //, angularDamping: .9 })
        sphereBody.addShape(sphereShape)
        sphereBody.addEventListener('collide', (e: any) => {
            if (e.contact.ni.dot(new CANNON.Vec3(0, 1, 0)) < -0.5) {
                this.theBallGame.players[id].canJump = true
            }
        })
        sphereBody.position.x = Math.random() * 50 - 25
        sphereBody.position.y = 2
        sphereBody.position.z = Math.random() * 50 - 25
        this.world.addBody(sphereBody)

        this.bodies[id] = sphereBody

        return sphereBody.id
    }
}
