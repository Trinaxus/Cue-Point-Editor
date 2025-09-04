import React, { useRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';

interface HoverGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: number; // not used yet, kept for future tuning
  reactive?: boolean; // if true, disable mouse tracking and use external CSS vars
}

export const HoverGlow = React.forwardRef<HTMLDivElement, HoverGlowProps>((
  { children, className, intensity = 1, reactive = false, ...rest }, forwardedRef
) => {
    const internalRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement | null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const el = internalRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      el.style.setProperty('--intensity', `${intensity}`);
    };

    const handleMouseLeave = () => {
      const el = internalRef.current;
      if (!el) return;
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };

    return (
      <div
        ref={internalRef}
        className={cn('mouse-glow', reactive && 'glow-reactive', className)}
        onMouseMove={reactive ? undefined : handleMouseMove}
        onMouseLeave={reactive ? undefined : handleMouseLeave}
        {...rest}
      >
        {children}
      </div>
    );
});
HoverGlow.displayName = 'HoverGlow';
