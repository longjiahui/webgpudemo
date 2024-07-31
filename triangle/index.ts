const canvas = document.querySelector('#canvas') as
    | HTMLCanvasElement
    | undefined
const ctx = canvas?.getContext('webgpu')
if (!canvas || !ctx) {
    throw Error('Canvas not found.')
}
new ResizeObserver(() => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
}).observe(document.querySelector('html')!)
;(async () => (await navigator.gpu.requestAdapter())?.requestDevice())().then(
    (device) => {
        if (!device) {
            throw Error('WebGPU not supported.')
        }

        console.debug('device.limits: ', device.limits)

        ctx.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
        })

        const verteces = new Float32Array([
            0.0, 0.6, 0, 1, 1, 0, 0, 1, -0.5, -0.6, 0, 1, 0, 1, 0, 1, 0.5, -0.6,
            0, 1, 0, 0, 1, 1,
        ])
        const vertexBuffer = device.createBuffer({
            size: verteces.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(vertexBuffer, 0, verteces, 0, verteces.length)

        const shaderModule = device.createShaderModule({
            code: `
struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f
}

@vertex
fn vertex_main(@location(0) position: vec4f,
               @location(1) color: vec4f) -> VertexOut
{
  var output : VertexOut;
  output.position = position;
  output.color = color;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
{
  return fragData.color;
}
`,
        })

        // create and define the render pipeline
        const pipeline = device.createRenderPipeline({
            vertex: {
                module: shaderModule,
                entryPoint: 'vertex_main',
                buffers: [
                    {
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x4',
                            },
                            {
                                shaderLocation: 1, //color
                                offset: 16,
                                format: 'float32x4',
                            },
                        ],
                        arrayStride: 32,
                        stepMode: 'vertex',
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragment_main',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
            layout: 'auto',
        })

        const commandEncoder = device.createCommandEncoder()
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    clearValue: { r: 0.0, g: 0.5, b: 1.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                    view: ctx.getCurrentTexture().createView(),
                },
            ],
        })

        passEncoder.setPipeline(pipeline)
        passEncoder.setVertexBuffer(0, vertexBuffer)
        passEncoder.draw(3)
        passEncoder.end()
        device.queue.submit([commandEncoder.finish()])
    }
)
