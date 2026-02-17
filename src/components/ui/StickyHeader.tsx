
import { useEffect, useState, useRef } from 'react';
import { cn } from '../../utils/style';

interface StickyHeaderProps {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}

export const StickyHeader = ({ 
  children, 
  className,
  threshold = 10 
}: StickyHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      setIsScrolled(target.scrollTop > threshold);
    };

    // Find the scrollable main container
    const mainContainer = document.querySelector('main');
    
    if (mainContainer) {
      mainContainer.addEventListener('scroll', handleScroll);
      // Initial check
      setIsScrolled(mainContainer.scrollTop > threshold);
    }

    return () => {
      if (mainContainer) {
        mainContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [threshold]);

  return (
    <div 
      ref={ref}
      className={cn(
        "sticky top-0 z-10 transition-all duration-300 ease-in-out",
        "-mx-6 md:-mx-8 px-6 md:px-8 pt-6 pb-4 mb-4",
        isScrolled 
          ? "bg-[#F8FAFC]/85 dark:bg-[#0F172A]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06] shadow-sm" 
          : "bg-transparent border-b border-transparent",
        className
      )}
    >
      {children}
    </div>
  );
};
