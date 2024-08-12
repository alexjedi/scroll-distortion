'use client'

import {
  Component,
  Copy,
  Dribbble,
  Framer,
  Github,
  Grip,
  Linkedin,
  Star,
  TestTube,
  TestTubeDiagonal,
  Twitter,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import CustomLink from '@/components/ui/link'
import Image from 'next/image'
import profilePic from '@/app/avatar.png'
import GalleryScroll from '@/components/ThreeScene'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { EffectControls } from '@/components/EffectControlls'
import { component } from '@/lib/copyable'

const projectLinks = {
  code: 'https://github.com/alexjedi/noise-effect',
  framer: 'https://framer.com/projects/new?duplicate=4nZDiYRDmL3lVtSryEzt',
  twitter: 'https://twitter.com/pxl_alexjedi',
  linkedin: 'https://www.linkedin.com/in/alex-shelvey/',
  dribbble: 'https://dribbble.com/pxlhead',
}

export default function Home() {
  const images = [
    '/img/image-1.png',
    '/img/image-2.png',
    '/img/image-3.png',
    '/img/image-4.png',
    '/img/image-5.png',
    '/img/image-6.png',
    '/img/image-7.png',
    '/img/image-8.png',
    '/img/image-9.png',
  ]
  const [distortion, setDistortion] = useState(3.0)
  const [distortion2, setDistortion2] = useState(5.0)
  const [speed, setSpeed] = useState(0.2)
  const [rollSpeed, setRollSpeed] = useState(0.1)
  const [chromaticAberration, setChromaticAberration] = useState(0.1)
  const videoUrl = 'https://videos.pexels.com/video-files/8721932/8721932-uhd_2732_1440_25fps.mp4'
  const { toast } = useToast()
  return <GalleryScroll images={images} />
}
