import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import eventsData from '../../data/events.json';
import { getEventImageUrlSync } from '../../utils/s3ImageUtils';
import { categorizeEvents } from '../../utils/dateUtils';

interface Event {
  id: string;
  title: string;
  date: string;
  location?: string;
  description: string;
  detailsLink?: string;
  imageKey?: string;
}



// Helper function to generate image URL from imageKey
const getEventImageUrl = (imageKey?: string): string | null => {
  return getEventImageUrlSync(imageKey);
};

// Helper function to handle event clicks (PDF or regular links)
const handleEventClick = (detailsLink?: string) => {
  if (!detailsLink) return;
  
  // Check if it's a PDF link
  if (detailsLink.endsWith('.pdf')) {
    // Open PDF in new tab
    window.open(detailsLink, '_blank');
  } else {
    // For regular links, let React Router handle it
    // This will be handled by the Link component
  }
};

export default function Events() {
  // Compute upcoming and past events based on date
  const { upcomingEvents, pastEvents } = useMemo(() => {
    return categorizeEvents<Event>(eventsData.events);
  }, []);

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-brand-cream min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-dark mb-4">
            GAPI Events
          </h1>
          <p className="text-xl text-neutral-dark/80 max-w-3xl mx-auto">
            Join us for professional development, cultural celebrations, and community service events throughout the year.
          </p>
        </div>
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`w-46 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                activeTab === 'upcoming'
                  ? 'bg-red text-white shadow-md'
                  : 'bg-white text-neutral-dark hover:bg-neutral-light border border-neutral-light'
              }`}
            >
              Upcoming Events
              <span className="ml-2 text-xs opacity-75">({upcomingEvents.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`w-46 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                activeTab === 'past'
                  ? 'bg-red text-white shadow-md'
                  : 'bg-white text-neutral-dark hover:bg-neutral-light border border-neutral-light'
              }`}
            >
              Past Events
              <span className="ml-2 text-xs opacity-75">({pastEvents.length})</span>
            </button>
          </div>
        </div>

        {/* Events List */}
        {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light">
            <div className="p-6 border-b border-neutral-light">
              <h2 className="text-xl font-bold text-neutral-dark">
                {activeTab === 'upcoming' ? 'Upcoming Events' : 'Past Events'}
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).map((event) => {
                  const imageUrl = getEventImageUrl(event.imageKey);
                  const isPDF = event.detailsLink?.endsWith('.pdf');
                  
                  // For PDF links, use a div with onClick; for regular links, use Link
                  if (isPDF) {
                    return (
                      <div 
                        key={event.id} 
                        className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors cursor-pointer"
                        onClick={() => handleEventClick(event.detailsLink)}
                      >
                        {/* Event Image and Date */}
                        <div className="flex-shrink-0">
                          {imageUrl && (
                            <img 
                              src={imageUrl}
                              alt={`${event.title} event`}
                              className="w-32 h-24 object-cover rounded-lg shadow-sm mb-2"
                            />
                          )}
                          <div className="text-xs font-medium text-sand text-center">
                            {event.date}
                          </div>
                        </div>
                        
                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-neutral-dark text-base mb-2 line-clamp-2">
                            {event.title}
                          </h4>
                          {event.location && (
                            <p className="text-sm text-neutral-dark/70 mb-2 flex items-center">
                              <MapPin className="w-4 h-4 mr-1 text-sand" />
                              <span>{event.location}</span>
                            </p>
                          )}
                          <p className="text-sm text-neutral-dark/70 line-clamp-2">
                            {event.description}
                          </p>
                          {activeTab === 'upcoming' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800 mt-2">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <Link 
                        key={event.id} 
                        to={event.detailsLink || '/events'} 
                        className="block"
                      >
                        <div className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors">
                          {/* Event Image and Date */}
                          <div className="flex-shrink-0">
                            {imageUrl && (
                              <img 
                                src={imageUrl}
                                alt={`${event.title} event`}
                                className="w-32 h-24 object-cover rounded-lg shadow-sm mb-2"
                              />
                            )}
                            <div className="text-xs font-medium text-sand text-center">
                              {event.date}
                            </div>
                          </div>
                          
                          {/* Event Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-neutral-dark text-base mb-2 line-clamp-2">
                              {event.title}
                            </h4>
                            {event.location && (
                              <p className="text-sm text-neutral-dark/70 mb-2 flex items-center">
                                <MapPin className="w-4 h-4 mr-1 text-sand" />
                                <span>{event.location}</span>
                              </p>
                            )}
                            <p className="text-sm text-neutral-dark/70 line-clamp-2">
                              {event.description}
                            </p>
                            {activeTab === 'upcoming' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800 mt-2">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  }
                })}
              </div>
            </div>
          </div>
        ) : (

          <div className="text-center py-12">
            <p className="text-neutral-dark/60 text-lg">
              {activeTab === 'upcoming' 
                ? 'No upcoming events at the moment. Check back soon!' 
                : 'No past events to display.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 
