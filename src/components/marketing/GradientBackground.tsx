import React, { useEffect, useRef } from 'react';

/**
 * 3-Color Sunrise Aurora Gradient Background with Dynamic Fluid Motion
 * and Interactive Mouse Pointer Sensitivity.
 * 
 * Distinct, saturated 3-Color Harmony:
 * 1. Radiant Sunrise Coral (#FF385C) - Upper & Mid Left Glow
 * 2. Luminous Sun Amber (#F59E0B / #FBBF24) - Center Horizon Glow
 * 3. Twilight Royal Violet (#8B5CF6 / #7C3AED) - Upper & Mid Right Halo
 * 
 * Features:
 * - Fluid, organic multi-phase orbital undulation (10s-12s harmonic cycles)
 * - Mouse Pointer Sensitivity:
 *   a) Multi-depth parallax shift on each color orb responding to cursor position
 *   b) Reactive Sunrise Aurora spotlight aura gently tracking the cursor
 * - Ultra high-performance 60fps/120fps LERP loop with zero React re-renders
 * - Full-viewport fixed coverage with zero white cutoffs at the bottom
 */
export const GradientBackground: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let rafId: number;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let targetNormX = 0;
    let targetNormY = 0;
    let targetOpacity = 0;

    let currentX = targetX;
    let currentY = targetY;
    let currentNormX = 0;
    let currentNormY = 0;
    let currentOpacity = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      targetNormX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      targetNormY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      targetOpacity = 1;
    };

    const handleMouseLeave = () => {
      targetNormX = 0;
      targetNormY = 0;
      targetOpacity = 0;
    };

    const handleMouseEnter = () => {
      targetOpacity = 1;
    };

    // Smooth LERP animation loop running on requestAnimationFrame
    const updateMotion = () => {
      // Linear interpolation (smooth spring drag)
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      currentNormX += (targetNormX - currentNormX) * 0.05;
      currentNormY += (targetNormY - currentNormY) * 0.05;
      currentOpacity += (targetOpacity - currentOpacity) * 0.06;

      if (containerRef.current) {
        // Cursor Spotlight coordinates
        containerRef.current.style.setProperty('--cursor-x', `${currentX.toFixed(1)}px`);
        containerRef.current.style.setProperty('--cursor-y', `${currentY.toFixed(1)}px`);
        containerRef.current.style.setProperty('--cursor-opacity', currentOpacity.toFixed(3));

        // Parallax offsets with distinct physical depth per color layer
        // Coral: pushes slightly with mouse vector (depth: 60px)
        containerRef.current.style.setProperty('--plx-coral-x', `${(currentNormX * 55).toFixed(1)}px`);
        containerRef.current.style.setProperty('--plx-coral-y', `${(currentNormY * 42).toFixed(1)}px`);

        // Amber: subtle horizontal counter-weight with vertical track (depth: 35px)
        containerRef.current.style.setProperty('--plx-amber-x', `${(currentNormX * -28).toFixed(1)}px`);
        containerRef.current.style.setProperty('--plx-amber-y', `${(currentNormY * 34).toFixed(1)}px`);

        // Violet: opposite 3D depth counter-shift (depth: -65px)
        containerRef.current.style.setProperty('--plx-violet-x', `${(currentNormX * -62).toFixed(1)}px`);
        containerRef.current.style.setProperty('--plx-violet-y', `${(currentNormY * -45).toFixed(1)}px`);

        // Lower anchors
        containerRef.current.style.setProperty('--plx-anc-l-x', `${(currentNormX * 30).toFixed(1)}px`);
        containerRef.current.style.setProperty('--plx-anc-l-y', `${(currentNormY * 22).toFixed(1)}px`);
        containerRef.current.style.setProperty('--plx-anc-r-x', `${(currentNormX * -36).toFixed(1)}px`);
        containerRef.current.style.setProperty('--plx-anc-r-y', `${(currentNormY * -26).toFixed(1)}px`);
      }

      rafId = requestAnimationFrame(updateMotion);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    rafId = requestAnimationFrame(updateMotion);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute top-0 left-0 right-0 h-[100vh] min-h-[720px] max-h-[1080px] pointer-events-none overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {/* 1. Base Sunrise Multi-stop Tinted Canvas */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background: 'linear-gradient(155deg, #FFF1F2 0%, #FEF3C7 36%, #F5F3FF 72%, #FAF7F2 100%)',
        }}
      />

      {/* =================================================================== */}
      {/* 2. THREE DISTINCT RADIANT COLOR ORBS WITH PARALLAX & FLUID MOTION   */}
      {/* =================================================================== */}
      <div className="absolute inset-0 w-full h-full">
        {/* COLOR 1: Radiant Sunrise Coral (#FF385C) - Upper Left Glow */}
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{
            transform: 'translate3d(var(--plx-coral-x, 0px), var(--plx-coral-y, 0px), 0)',
          }}
        >
          <div
            className="aurora-coral absolute -top-[10%] -left-[10%] w-[72vw] max-w-[850px] h-[75vh] max-h-[750px] rounded-full blur-[70px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255, 56, 92, 0.54) 0%, rgba(244, 63, 94, 0.28) 45%, transparent 72%)',
            }}
          />
        </div>

        {/* COLOR 2: Luminous Sun Amber (#F59E0B) - Center Horizon Glow */}
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{
            transform: 'translate3d(var(--plx-amber-x, 0px), var(--plx-amber-y, 0px), 0)',
          }}
        >
          <div
            className="aurora-amber absolute top-[18%] left-1/2 w-[85vw] max-w-[1050px] h-[55vh] max-h-[580px] rounded-[100%] blur-[75px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.50) 0%, rgba(251, 191, 36, 0.26) 48%, transparent 72%)',
            }}
          />
        </div>

        {/* COLOR 3: Twilight Royal Violet (#8B5CF6) - Upper Right Halo */}
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{
            transform: 'translate3d(var(--plx-violet-x, 0px), var(--plx-violet-y, 0px), 0)',
          }}
        >
          <div
            className="aurora-violet absolute -top-[8%] -right-[8%] w-[75vw] max-w-[880px] h-[78vh] max-h-[780px] rounded-full blur-[75px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.52) 0%, rgba(124, 58, 237, 0.26) 45%, transparent 72%)',
            }}
          />
        </div>

        {/* LOWER SECTION ANCHORS: Ensures bottom of the screen has vibrant 3-color coverage */}
        {/* Lower Left Warm Coral / Amber Drift */}
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{
            transform: 'translate3d(var(--plx-anc-l-x, 0px), var(--plx-anc-l-y, 0px), 0)',
          }}
        >
          <div
            className="aurora-anchor absolute bottom-[-10%] left-[5%] w-[55vw] max-w-[650px] h-[45vh] rounded-full blur-[80px] opacity-75 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255, 56, 92, 0.35) 0%, rgba(251, 191, 36, 0.24) 50%, transparent 72%)',
            }}
          />
        </div>

        {/* Lower Right Twilight Violet / Amber Drift */}
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{
            transform: 'translate3d(var(--plx-anc-r-x, 0px), var(--plx-anc-r-y, 0px), 0)',
          }}
        >
          <div
            className="aurora-anchor absolute bottom-[-8%] right-[5%] w-[60vw] max-w-[700px] h-[50vh] rounded-full blur-[85px] opacity-75 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.38) 0%, rgba(245, 158, 11, 0.20) 50%, transparent 72%)',
            }}
          />
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. INTERACTIVE CURSOR SUNRISE AURORA SPOTLIGHT                      */}
      {/* =================================================================== */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(650px circle at var(--cursor-x, 50%) var(--cursor-y, 50%), rgba(251, 191, 36, 0.22) 0%, rgba(255, 56, 92, 0.16) 30%, rgba(139, 92, 246, 0.12) 55%, transparent 75%)`,
          opacity: 'var(--cursor-opacity, 0)',
        }}
      />

      {/* 4. Subtle ambient light highlight to preserve crisp text contrast */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 25%, rgba(255, 255, 255, 0.9) 0%, transparent 65%)',
        }}
      />

      {/* 5. Smooth natural transition into the creamy page background (#FAF7F2) */}
      <div
        className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-b from-transparent via-[#FAF7F2]/60 to-[#FAF7F2] pointer-events-none"
      />
    </div>
  );
};
