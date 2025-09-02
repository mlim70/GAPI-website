import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PlaceholderImage from '../ui/PlaceholderImage';
import { isEventUpcoming } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';

interface HeroEventCarouselProps {
  events: any[];
  autoPlayInterval?: number;
  onImageError?: (eventId: string) => void;
}

export default function HeroEventCarousel({ events, autoPlayInterval = 5000, onImageError }: HeroEventCarouselProps) {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [imageError, setImageError] = useState<{ [key: string]: boolean }>({});

  // Helper function to get images array from imageKey (supports both string and array)
  const getEventImages = (event: any): string[] => {
    if (!event.imageKey) return [];
    if (Array.isArray(event.imageKey)) return event.imageKey;
    return [event.imageKey];
  };

  // Helper function to advance to next image or event
  const advanceCarousel = () => {
    const currentEvent = events[currentEventIndex];
    const currentEventImages = getEventImages(currentEvent);
    
    logger.debug('🔄 Advancing carousel:', {
      currentEventIndex,
      currentImageIndex,
      currentEventImages: currentEventImages.length,
      willAdvanceImage: currentImageIndex < currentEventImages.length - 1
    });
    
    if (currentImageIndex < currentEventImages.length - 1) {
      // Move to next image in current event
      logger.debug('➡️ Moving to next image in same event');
      setCurrentImageIndex(prev => prev + 1);
    } else {
      // Move to next event and reset image index
      logger.debug('⏭️ Moving to next event');
      setCurrentEventIndex(prev => (prev + 1) % events.length);
      setCurrentImageIndex(0);
    }
  };

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    // Check if we should auto-play: either multiple events OR current event has multiple images
    const currentEvent = events[currentEventIndex];
    const currentEventImages = getEventImages(currentEvent);
    const shouldAutoPlay = events.length > 1 || currentEventImages.length > 1;
    
    if (!shouldAutoPlay) return;
    
    const interval = setInterval(() => {
      advanceCarousel();
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [events.length, autoPlayInterval, isAutoPlaying, currentEventIndex, currentImageIndex]);

  const goToEvent = (eventIndex: number) => {
    setCurrentEventIndex(eventIndex);
    setCurrentImageIndex(0);
    setIsAutoPlaying(false);
    // Resume auto-play after 3 seconds of manual interaction
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  const goToPrevious = () => {
    const currentEvent = events[currentEventIndex];
    const currentEventImages = getEventImages(currentEvent);
    
    if (currentImageIndex > 0) {
      // Go to previous image in current event
      setCurrentImageIndex(prev => prev - 1);
    } else {
      // Go to previous event, last image
      const prevEventIndex = (currentEventIndex - 1 + events.length) % events.length;
      const prevEvent = events[prevEventIndex];
      const prevEventImages = getEventImages(prevEvent);
      setCurrentEventIndex(prevEventIndex);
      setCurrentImageIndex(Math.max(0, prevEventImages.length - 1));
    }
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  const goToNext = () => {
    advanceCarousel();
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  const handleImageError = (eventId: string) => {
    setImageError(prev => ({ ...prev, [eventId]: true }));
    
    // Call the parent error handler for cache invalidation
    if (onImageError) {
      onImageError(eventId);
    }
  };

  if (!events.length) {
    return null;
  }

  const currentEvent = events[currentEventIndex];
  const currentEventImages = getEventImages(currentEvent);
  const currentImage = currentEventImages[currentImageIndex];

  // Debug logging
  logger.debug('🎠 Carousel Debug:', {
    currentEventIndex,
    currentImageIndex,
    eventImageKey: currentEvent?.imageKey,
    currentEventImages,
    currentImage,
    totalEvents: events.length
  });

  // Compute isUpcoming dynamically based on event date
  const isUpcoming = isEventUpcoming(currentEvent.date);

  return (
    <div className="relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl shadow-2xl bg-white">
      {/* Event Image */}
      {currentImage && (
        <div className="relative h-48 sm:h-64 lg:h-74 w-full overflow-hidden">
          {imageError[`${currentEvent.id}-${currentImageIndex}`] ? (
            <PlaceholderImage 
              text="Event Image" 
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <img
              src={currentImage}
              alt={currentEvent.title}
              className="w-full h-full object-cover object-top carousel-image-transition"
              onError={() => handleImageError(`${currentEvent.id}-${currentImageIndex}`)}
            />
          )}
        </div>
      )}

            {/* Event Content */}
      <div className="p-3 sm:p-4 lg:p-6 pb-8 sm:pb-8 h-48 sm:h-52 lg:h-56 flex flex-col">
        <div className="space-y-2 sm:space-y-3 flex-1">
          {/* Event Title */}
          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-dark leading-tight">
            {currentEvent.title} {isUpcoming && <span className="text-neutral-dark/60 font-normal">(Upcoming)</span>}
          </h3>
          
          {/* Event Details */}
          <div className="space-y-1 text-neutral-dark/80">
            <div className="flex items-center space-x-2 text-sm">
              <svg className="w-4 h-4 text-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{currentEvent.date}{currentEvent.time ? ` at ${currentEvent.time}` : ''}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <svg className="w-4 h-4 text-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">{currentEvent.location}</span>
            </div>
          </div>
          
          {/* Event Description */}
          <p className="text-xs sm:text-sm text-neutral-dark/70 line-clamp-2 leading-relaxed flex-1">
            {currentEvent.description}
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1 sm:gap-2 mt-auto pt-2">
            {isUpcoming ? (
              <Link
                to={currentEvent.detailsLink || "/events"}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-neutral-dark transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                RSVP Now
              </Link>
            ) : (
              <Link
                to={currentEvent.detailsLink || "/events"}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-neutral-dark transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Learn More
              </Link>
            )}
            <Link
              to="/events"
              className="px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-red text-red rounded-lg text-xs sm:text-sm font-semibold hover:bg-red hover:text-white transition-all duration-300"
            >
              View All Events
            </Link>
          </div>
      </div>

      {/* Navigation Arrows */}
      {(events.length > 1 || currentEventImages.length > 1) && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-red/90 text-white p-3 rounded-full transition-all duration-300 shadow-xl hover:shadow-2xl backdrop-blur-sm border border-white/20"
            aria-label="Previous event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-red/90 text-white p-3 rounded-full transition-all duration-300 shadow-xl hover:shadow-2xl backdrop-blur-sm border border-white/20"
            aria-label="Next event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {(events.length > 1 || currentEventImages.length > 1) && (
        <div className="hidden lg:flex absolute bottom-6 sm:bottom-4 left-1/2 transform -translate-x-1/2 space-x-2">
          {events.map((event, eventIndex) => {
            const eventImages = getEventImages(event);
            const isCurrentEvent = eventIndex === currentEventIndex;
            
            return (
              <div key={eventIndex} className="flex items-center space-x-1">
                <button
                  onClick={() => goToEvent(eventIndex)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isCurrentEvent
                      ? 'bg-red scale-125 shadow-lg'
                      : 'bg-neutral-light hover:bg-sand hover:scale-110'
                  }`}
                  aria-label={`Go to event ${eventIndex + 1}`}
                />
                {/* Sub-indicators for multiple images */}
                {eventImages.length > 1 && isCurrentEvent && (
                  <div className="flex space-x-1 ml-1">
                    {eventImages.map((_, imageIndex) => (
                      <div
                        key={imageIndex}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          imageIndex === currentImageIndex
                            ? 'bg-red'
                            : 'bg-neutral-light/60'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 
