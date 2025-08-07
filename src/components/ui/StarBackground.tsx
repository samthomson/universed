import { useEffect, useRef, useCallback } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  targetOpacity: number;
  life: number;
  maxLife: number;
  speed: number;
  twinkleSpeed: number;
}

export function StarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const starsRef = useRef<Star[]>([]);
  const lastTimeRef = useRef<number>();

  // Create a random star
  const createRandomStar = useCallback((canvas: HTMLCanvasElement): Star => {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1 + 0.3, // Size between 0.3 and 1.3 pixels (significantly smaller)
      opacity: 0,
      targetOpacity: Math.random() * 0.4 + 0.1, // Target opacity between 0.1 and 0.5 (much more subtle)
      life: 0,
      maxLife: Math.random() * 6000 + 4000, // Life between 4-10 seconds (slower, longer duration)
      speed: Math.random() * 0.3 + 0.05, // Slower twinkle speed
      twinkleSpeed: Math.random() * 0.01 + 0.005, // Slower opacity change speed
    };
  }, []);

  // Initialize stars
  const initStars = useCallback((canvas: HTMLCanvasElement, count: number = 200) => {
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      stars.push(createRandomStar(canvas));
    }
    starsRef.current = stars;
  }, [createRandomStar]);

  // Update stars
  const updateStars = useCallback((canvas: HTMLCanvasElement, deltaTime: number) => {
    const stars = starsRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];

      // Update star life
      star.life += deltaTime;

      // Calculate life phase (0 to 1)
      const lifePhase = star.life / star.maxLife;

      // Fade in and out based on life phase with slower transitions
      if (lifePhase < 0.15) {
        // Slower fade in phase (15% of life instead of 20%)
        star.opacity = lifePhase * 6.67 * star.targetOpacity; // Gradual fade in
      } else if (lifePhase > 0.85) {
        // Slower fade out phase (15% of life instead of 20%)
        star.opacity = (1 - lifePhase) * 6.67 * star.targetOpacity; // Gradual fade out
      } else {
        // Stable phase with very gentle twinkle
        const twinkle = Math.sin(star.life * star.twinkleSpeed) * 0.15 + 0.85; // Reduced twinkle intensity
        star.opacity = star.targetOpacity * twinkle;
      }

      // Remove star if it has completed its life
      if (lifePhase >= 1) {
        stars.splice(i, 1);
        // Add a new star to maintain count
        stars.push(createRandomStar(canvas));
        continue;
      }

      // Draw star
      ctx.save();
      ctx.globalAlpha = star.opacity;

      // Use softer, more subtle colors (light gray to pale white)
      const colorIntensity = Math.random() * 0.3 + 0.7; // Between 0.7 and 1.0 for subtle variation
      const red = Math.floor(240 + colorIntensity * 15); // 240-255 (light gray to white)
      const green = Math.floor(240 + colorIntensity * 15); // 240-255 (light gray to white)
      const blue = Math.floor(245 + colorIntensity * 10); // 245-255 (slightly bluish white)

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      ctx.shadowColor = `rgb(${red}, ${green}, ${blue})`;
      ctx.shadowBlur = star.size * 1.5; // Reduced shadow blur for subtlety

      // Draw star as a small circle
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      // Add a very subtle cross glow only for the largest stars
      if (star.size > 1.0) {
        ctx.globalAlpha = star.opacity * 0.15; // Much more subtle glow
        ctx.lineWidth = 0.3; // Thinner lines
        ctx.strokeStyle = `rgb(${red}, ${green}, ${blue})`;

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(star.x, star.y - star.size * 1.5);
        ctx.lineTo(star.x, star.y + star.size * 1.5);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(star.x - star.size * 1.5, star.y);
        ctx.lineTo(star.x + star.size * 1.5, star.y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }, [createRandomStar]);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate delta time
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Update and draw stars
    updateStars(canvas, deltaTime);

    // Continue animation
    animationRef.current = requestAnimationFrame(animate);
  }, [updateStars]);

  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Reinitialize stars for new canvas size
    initStars(canvas, 250); // Increased star count for better coverage with smaller stars
  }, [initStars]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initial setup
    handleResize();

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [animate, handleResize]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: 'transparent',
      }}
    />
  );
}