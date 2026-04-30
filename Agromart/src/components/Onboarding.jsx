import { useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'

const slides = [
  {
    id: 1,
    image: '/images/weather.png',
    badge: 'Live Forecasts',
    title: 'Real-time Weather for Smarter Farming',
    subtitle: 'Track rain, heat, and field alerts before the weather changes your plans.'
  },
  {
    id: 2,
    image: '/images/market.png',
    badge: 'Trusted Market',
    title: 'Buy & Sell Fresh Produce',
    subtitle: 'Connect with trusted buyers and sellers from one clean marketplace.'
  },
  {
    id: 3,
    image: '/images/delivery.png',
    badge: 'Fast Delivery',
    title: 'Fast & Reliable Delivery',
    subtitle: 'Move produce from farm to customer with quick, dependable delivery.'
  }
]

const slideVariants = {
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 56 : -56,
    scale: 1.03
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? -56 : 56,
    scale: 1.03,
    transition: { duration: 0.35 }
  })
}

export default function Onboarding({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const dragX = useMotionValue(0)
  const backgroundX = useTransform(dragX, (value) => value * 0.3)
  const contentX = useTransform(dragX, (value) => value * 0.5)
  const activeImageIndex = useRef(slides.map(() => 0))
  const gestureStartX = useRef(0)
  const gestureActive = useRef(false)

  const currentSlide = slides[currentIndex]

  const resetDrag = () => {
    animate(dragX, 0, {
      type: 'spring',
      stiffness: 320,
      damping: 30
    })
  }

  const goToSlide = (index) => {
    if (index === currentIndex) return
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
    resetDrag()
  }

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setDirection(1)
      setCurrentIndex(currentIndex + 1)
      resetDrag()
    } else {
      onComplete()
    }
  }

  const handleImageError = (slideIndex) => {
    const maxIndex = 0
    activeImageIndex.current[slideIndex] = Math.min(activeImageIndex.current[slideIndex] + 1, maxIndex)
  }

  const getSlideImage = (slideIndex) => slides[slideIndex].image

  const handlePointerDown = (event) => {
    gestureActive.current = true
    gestureStartX.current = event.clientX
    dragX.set(0)
  }

  const handlePointerMove = (event) => {
    if (!gestureActive.current) return
    dragX.set(event.clientX - gestureStartX.current)
  }

  const handlePointerUp = () => {
    if (!gestureActive.current) return

    const offset = dragX.get()
    const threshold = 72

    if (offset <= -threshold && currentIndex < slides.length - 1) {
      setDirection(1)
      setCurrentIndex(currentIndex + 1)
    }

    if (offset >= threshold && currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex(currentIndex - 1)
    }

    gestureActive.current = false
    resetDrag()
  }

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-[#050f0a] text-white"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          <motion.img
            key={getSlideImage(currentIndex)}
            src={getSlideImage(currentIndex)}
            alt={currentSlide.title}
            onError={() => handleImageError(currentIndex)}
            className="absolute inset-0 h-full w-full object-cover object-center"
            style={{ x: backgroundX, scale: 1.12 }}
            initial={{ scale: 1.06 }}
            animate={{ scale: 1.12 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_30%),linear-gradient(to_b,rgba(4,10,7,0.18),rgba(4,10,7,0.58)_45%,rgba(4,10,7,0.94)_100%)]" />

          <motion.div
            style={{ x: contentX }}
            className="relative z-10 flex h-full flex-col justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] font-medium tracking-[0.22em] text-lime-100/85 backdrop-blur-md">
                AGROMART
              </div>
              <button
                onClick={onComplete}
                className="rounded-full border border-white/20 bg-black/20 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
              >
                Skip
              </button>
            </div>

            <div className="mx-auto w-full max-w-[20rem] space-y-4 pb-3 text-center sm:max-w-sm">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="mx-auto flex w-fit items-center gap-2 rounded-full border border-lime-300/20 bg-lime-400/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-lime-100 backdrop-blur-md"
              >
                <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_16px_rgba(190,242,100,0.85)]" />
                {currentSlide.badge}
              </motion.div>

              <motion.h1
                className="text-[2rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.14 }}
              >
                {currentSlide.title}
              </motion.h1>

              <motion.p
                className="mx-auto max-w-[18rem] text-[13px] leading-6 text-white/78 sm:max-w-sm sm:text-base"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2 }}
              >
                {currentSlide.subtitle}
              </motion.p>

              <motion.div
                className="rounded-[1.75rem] border border-white/12 bg-white/8 p-4 text-left shadow-[0_20px_60px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.26 }}
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/50">
                  <span>Why AgroMart</span>
                  <span>{String(currentIndex + 1).padStart(2, '0')} / 03</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                    <p className="text-[11px] text-white/50">Signal</p>
                    <p className="mt-1 text-sm font-semibold text-white">Smarter decisions</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                    <p className="text-[11px] text-white/50">Flow</p>
                    <p className="mt-1 text-sm font-semibold text-white">Swipe-friendly UI</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                    <p className="text-[11px] text-white/50">Result</p>
                    <p className="mt-1 text-sm font-semibold text-white">Faster action</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className="rounded-full p-1 focus:outline-none"
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    <motion.div
                      className={`rounded-full transition-colors ${
                        index === currentIndex ? 'bg-lime-300' : 'bg-white/30'
                      }`}
                      animate={{
                        width: index === currentIndex ? 28 : 8,
                        height: 8,
                        opacity: index === currentIndex ? 1 : 0.55
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-white/55">Swipe horizontally or tap the dots.</p>
                <button
                  onClick={nextSlide}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                    currentIndex === slides.length - 1
                      ? 'bg-lime-400 text-emerald-950 shadow-[0_12px_30px_rgba(163,230,53,0.35)] hover:bg-lime-300'
                      : 'border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/16'
                  }`}
                >
                  {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
