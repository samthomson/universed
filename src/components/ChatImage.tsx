import React, { useState, useRef, useEffect } from 'react';
import { Loader2, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function ChatImage({ src, alt, className, onClick, onError }: ChatImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!hasError && !isLoading) {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
      if (!isExpanded) {
        // Only trigger the gallery click when expanding
        onClick?.();
      }
    }
  };

  // Close expanded view when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node) && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  return (
    <>
      {/* Preview thumbnail */}
      <div 
        ref={containerRef}
        className={cn(
          "relative inline-block cursor-pointer group overflow-hidden rounded-lg max-w-xs transition-all duration-300 hover:shadow-lg hover:scale-105",
          isExpanded ? "fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm rounded-none max-w-none max-h-none m-auto" : "",
          className
        )}
        onClick={handleClick}
        style={
          isExpanded 
            ? {} 
            : { transformOrigin: 'center center' }
        }
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center">
              <div className="text-2xl mb-1">🖼️</div>
              <p className="text-xs text-muted-foreground">Failed to load</p>
            </div>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={cn(
              "w-full h-48 object-cover transition-all duration-300",
              isExpanded 
                ? "max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain" 
                : "hover:opacity-90"
            )}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
            style={
              isExpanded 
                ? { transform: 'scale(1)' }
                : { transformOrigin: 'center center' }
            }
          />
        )}
        
        {/* Subtle hover overlay - only for preview state */}
        {!isExpanded && (
          <div className="absolute inset-0 bg-black/0 opacity-0 group-hover:opacity-10 transition-opacity duration-200 pointer-events-none rounded-lg" />
        )}
        
        {/* Expand indicator */}
        {!isExpanded && !hasError && !isLoading && (
          <div className="absolute bottom-2 right-2 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* Close button for expanded state */}
        {isExpanded && (
          <button
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors z-[100000]"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Backdrop for expanded state */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-[99998] transition-opacity duration-300"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}