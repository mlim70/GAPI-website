import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';

interface EventImageCarouselProps {
  images: string[];
  autoPlayInterval?: number;
  showNavigation?: boolean;
  height?: string;
  onImageError?: (imageIndex: number) => void;
}

export default function EventImageCarousel({ 
  images, 
  autoPlayInterval = 5000, 
  showNavigation = true, 
  height = "h-96",
  onImageError
}: EventImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [images.length, autoPlayInterval]);

  const goToSlide = (index: number) => {
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const handleImageError = (imageIndex: number) => {
    logger.info(`🔄 Image ${imageIndex} failed to load in EventImageCarousel`);
    setImageErrors(prev => ({ ...prev, [imageIndex]: true }));
    
    // Call the parent error handler for cache invalidation
    if (onImageError) {
      onImageError(imageIndex);
    }
  };

  if (!images.length) {
    return null;
  }

  return (
    <div className={`relative w-full ${height} overflow-hidden rounded-lg shadow-lg`}>
      {/* Main Image with Enhanced Transitions */}
      <div className="w-full h-full relative">
        {images.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-600 ease-in-out ${
              index === currentIndex
                ? 'opacity-100 scale-100 translate-x-0'
                : 'opacity-0 scale-105 translate-x-full'
            }`}
            style={{
              transform: index === currentIndex 
                ? 'translateX(0) scale(1)' 
                : index < currentIndex 
                  ? 'translateX(-100%) scale(1.05)' 
                  : 'translateX(100%) scale(1.05)'
            }}
          >
            <img
              src={image}
              alt={`GAPI Event ${index + 1}`}
              className="w-full h-full object-cover"
              onError={() => handleImageError(index)}
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {showNavigation && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-transparent hover:bg-red/80 text-white p-3 rounded-full transition-all duration-300 shadow-lg hover:scale-110"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-transparent hover:bg-red/80 text-white p-3 rounded-full transition-all duration-300 shadow-lg hover:scale-110"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Progress Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full overflow-hidden">
        <div 
          className="h-full bg-red transition-all duration-300 ease-out"
          style={{ width: `${((currentIndex + 1) / images.length) * 100}%` }}
        ></div>
      </div>


    </div>
  );
} 