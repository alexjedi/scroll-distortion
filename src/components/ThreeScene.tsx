'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ReactLenis, useLenis } from 'lenis/react'

interface GalleryScrollProps {
  images: string[]
}

const vertexShader = `
precision mediump float;

#define PI 3.1415926535897932384626433832795

uniform float uVelo;
uniform float uStrength;

varying vec2 vUv;

void main() {
    vUv = uv;

    vec4 globalPosition = modelMatrix * vec4(position, 1.0);
    vec3 newPosition = globalPosition.xyz;

    float strength = uStrength * 6.;
    newPosition.z += abs(sin(globalPosition.y * 0.25 + PI * 0.5)) * -strength + strength * 0.25;

    newPosition.y += ((sin(uv.x * PI) * uVelo) * .3);

    gl_Position = projectionMatrix * viewMatrix * vec4(newPosition, 1.0);
}
`

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform sampler2D uTexture;

uniform vec2 uPlaneSize;
uniform vec2 uTextureSize;

uniform float uVelo;
uniform float uScale;

vec2 backgroundCoverUv(vec2 screenSize, vec2 imageSize, vec2 uv) {
    float screenRatio = screenSize.x / screenSize.y;
    float imageRatio = imageSize.x / imageSize.y;
    vec2 newSize = screenRatio < imageRatio ? vec2(imageSize.x * screenSize.y / imageSize.y, screenSize.y) : vec2(screenSize.x, imageSize.y * screenSize.x / imageSize.x);
    vec2 newOffset = (screenRatio < imageRatio ? vec2((newSize.x - screenSize.x) / 2.0, 0.0) : vec2(0.0, (newSize.y - screenSize.y) / 2.0)) / newSize;
    return uv * screenSize / newSize + newOffset;
}

void main() {

    vec2 uv = vUv;

    vec2 texCenter = vec2(0.5);
    vec2 texUv = backgroundCoverUv(uPlaneSize, uTextureSize, uv);
    vec2 texScale = (texUv - texCenter) * uScale + texCenter;
    vec3 tex = texture2D(uTexture, texScale).rgb;

    texScale.y += 0.02 * uVelo;
    if(uv.y < 1.)
        tex.g = texture2D(uTexture, texScale).g;

    texScale.y += 0.03 * uVelo;
    if(uv.y < 1.)
        tex.b = texture2D(uTexture, texScale).b;

    gl_FragColor.rgb = tex;
    // gl_FragColor.rgb = vec3(texUv, 0.);
    gl_FragColor.a = 1.0;
}
`

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.crossOrigin = 'anonymous'
    img.onerror = reject
    img.src = src
  })
}

const GalleryScroll: React.FC<GalleryScrollProps> = ({ images }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const glImagesStripsRef = useRef<
    Array<{
      images: ReturnType<typeof createGlImage>[]
      scrollY: number
      scrollSpeedOffset: number
    }>
  >([])

  const viewportRef = useRef({ width: 0, height: 0 })
  const [imagesLoaded, setImagesLoaded] = useState(false)

  const calculateViewport = () => {
    if (!cameraRef.current) return
    const fov = cameraRef.current.fov * (Math.PI / 180)
    const height = 2 * Math.tan(fov / 2) * cameraRef.current.position.z
    const width = height * cameraRef.current.aspect
    viewportRef.current = { width, height }
  }

  const createGlImage = (
    element: HTMLImageElement,
    geometry: THREE.BufferGeometry,
    scene: THREE.Scene,
    viewport: { width: number; height: number },
    screen: { width: number; height: number }
  ) => {
    const texture = new THREE.Texture(element)
    texture.needsUpdate = true

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uPlaneSize: { value: [0, 0] },
        uTextureSize: { value: [element.width, element.height] },
        uViewportSize: { value: [viewport.width, viewport.height] },
        uVelo: { value: 0 },
        uScale: { value: 1 },
        uStrength: { value: 0 },
      },
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const bounds = element.getBoundingClientRect()
    let offsetY = 0

    const updateScale = () => {
      mesh.scale.x = (viewport.width * bounds.width) / screen.width
      mesh.scale.y = (viewport.height * bounds.height) / screen.height
      material.uniforms.uPlaneSize.value = [mesh.scale.x, mesh.scale.y]
    }

    const updatePosition = (scrollY = 0) => {
      mesh.position.x =
        -(viewport.width / 2) + mesh.scale.x / 2 + (bounds.left / screen.width) * viewport.width
      mesh.position.y =
        viewport.height / 2 -
        mesh.scale.y / 2 -
        ((bounds.top - scrollY) / screen.height) * viewport.height -
        offsetY
    }

    updateScale()
    updatePosition()

    return {
      update: (scrollY: number, velocity: number, direction: number, parentHeight: number) => {
        updatePosition(scrollY)

        const maxVel = Math.min(Math.abs(velocity), 15) * direction
        material.uniforms.uVelo.value = maxVel * 0.02
        material.uniforms.uScale.value = 1 - Math.abs(maxVel * 0.001)
        material.uniforms.uStrength.value = velocity * 0.003

        const meshOffset = mesh.scale.y / 2
        const viewportOffset = viewport.height / 2

        if (mesh.position.y + meshOffset < -viewportOffset) {
          offsetY -= parentHeight
        } else if (mesh.position.y - meshOffset > viewportOffset) {
          offsetY += parentHeight
        }

        if (offsetY > parentHeight) {
          offsetY -= parentHeight
        } else if (offsetY < -parentHeight) {
          offsetY += parentHeight
        }
      },
      onResize: ({
        screen,
        viewport,
      }: {
        screen: { width: number; height: number }
        viewport: { width: number; height: number }
      }) => {
        updateScale()
        updatePosition()
      },
      dispose: () => {
        material.dispose()
        mesh.geometry.dispose()
        texture.dispose()
      },
    }
  }

  useEffect(() => {
    const loadAllImages = async () => {
      try {
        await Promise.all(images.map(loadImage))
        setImagesLoaded(true)
      } catch (error) {
        console.error('Failed to load images:', error)
      }
    }

    loadAllImages()
  }, [images])

  useEffect(() => {
    if (!imagesLoaded || !canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current

    rendererRef.current = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    rendererRef.current.setSize(window.innerWidth, window.innerHeight)
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    sceneRef.current = new THREE.Scene()

    cameraRef.current = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    cameraRef.current.position.z = 10
    calculateViewport()

    const controls = new OrbitControls(cameraRef.current, canvas)
    controls.enableDamping = true

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    sceneRef.current.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(0, 1, 2)
    sceneRef.current.add(directionalLight)

    const geometry = new THREE.PlaneGeometry(1, 1, 32, 32)

    const createGlImageStrip = (parentElement: Element) => {
      const stripImages = parentElement.querySelectorAll('img')
      const glImages = Array.from(stripImages).map((img) =>
        createGlImage(img as HTMLImageElement, geometry, sceneRef.current!, viewportRef.current, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      )
      return {
        images: glImages,
        scrollY: 0,
        scrollSpeedOffset: 1 + Math.random() * 0.25,
      }
    }

    glImagesStripsRef.current = [
      createGlImageStrip(container.querySelector('.images-strip-1')!),
      createGlImageStrip(container.querySelector('.images-strip-2')!),
      createGlImageStrip(container.querySelector('.images-strip-3')!),
    ]

    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current) return
      const { innerWidth: width, innerHeight: height } = window
      rendererRef.current.setSize(width, height)
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      calculateViewport()

      glImagesStripsRef.current.forEach((strip) => {
        strip.images.forEach((glImage) => {
          glImage.onResize({
            screen: { width, height },
            viewport: viewportRef.current,
          })
        })
      })
    }

    window.addEventListener('resize', onResize)
    onResize()

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !containerRef.current)
        return

      const scrollVelocity = scrollRef.current.velocity
      const scrollDirection = scrollRef.current.direction

      glImagesStripsRef.current.forEach((strip, index) => {
        const stripDirection = index % 2 === 0 ? -1 : 1
        strip.scrollY += scrollVelocity * stripDirection * strip.scrollSpeedOffset

        strip.images.forEach((glImage) => {
          glImage.update(
            strip.scrollY,
            scrollVelocity,
            scrollDirection,
            containerRef.current!.clientHeight
          )
        })
      })

      rendererRef.current.render(sceneRef.current, cameraRef.current)
      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      rendererRef.current?.dispose()
      geometry.dispose()
      glImagesStripsRef.current.forEach((strip) =>
        strip.images.forEach((glImage) => glImage.dispose())
      )
      controls.dispose()
    }
  }, [imagesLoaded])

  const scrollRef = useRef({ velocity: 0, direction: 0 })

  useLenis(({ velocity }) => {
    scrollRef.current.velocity = velocity
    scrollRef.current.direction = Math.sign(velocity)
  })

  return (
    <ReactLenis root options={{ infinite: true, smoothWheel: true }}>
      <div
        ref={containerRef}
        className="container relative flex justify-center gap-[var(--gap)] mx-auto px-4"
      >
        {[1, 2, 3].map((stripIndex) => (
          <div
            key={stripIndex}
            className={`images-strip-${stripIndex} flex flex-col gap-[var(--gap)] pt-[var(--gap)]`}
          >
            {images.map((src, index) => (
              <figure key={index} className="relative max-h-[450px] h-full aspect-[3/4]">
                <img
                  src={src}
                  alt={`Gallery image ${index + 1}`}
                  className="block w-full h-full object-cover pointer-events-none opacity-0"
                />
              </figure>
            ))}
          </div>
        ))}
      </div>
      <canvas ref={canvasRef} className="fixed inset-0 w-screen h-screen z-[-1]" />
    </ReactLenis>
  )
}

export default GalleryScroll
