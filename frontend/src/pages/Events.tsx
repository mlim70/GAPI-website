import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Event {
  id: string;
  title: string;
  date: string;
  location?: string;
  description: string;
  detailsLink?: string;
  isUpcoming?: boolean;
}

export default function Events() {
  // Upcoming events data
  const upcomingEvents: Event[] = [];

  // Past events data
  const pastEvents = [
    {
      id: '1',
      title: 'GAPI Annual and Scientific Meeting 2025',
      date: 'July 18-19, 2025',
      location: 'GAS South Convention Center, Gwinnett',
      description: 'Save the date for our premier annual gathering featuring scientific sessions, networking opportunities, and cultural celebrations.',
      detailsLink: '#',
      isUpcoming: false,
    },
    {
      id: '2',
      title: 'Physician-Themed Indian Fashion Show 2025',
      date: 'July 18, 2025',
      location: 'GAS South Convention Center',
      description: 'A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship, and community.',
      detailsLink: '#',
      isUpcoming: false,
    },
    {
      id: '3',
      title: 'Choreographed Performances by Physician Members',
      date: 'July 18, 2025',
      location: 'GAS South Convention Center Grand Stage',
      description: 'Experience the artistic talents of our physician members through captivating choreographed performances.',
      detailsLink: '#',
      isUpcoming: false,
    },
    {
      id: '4',
      title: 'Robotic Surgery System Hands-on Practice',
      date: 'July 19, 2025',
      location: 'Practice Meet and Greet Area',
      description: 'Special attraction featuring a very cool Robotic Surgery System for hands-on practice. Open to physicians and non-physicians.',
      detailsLink: '#',
      isUpcoming: false,
    },
    {
      id: '5',
      title: 'GAPI Annual Meeting 2024',
      date: 'July 20-21, 2024',
      location: 'GAS South Convention Center',
      description: 'Our successful 2024 annual meeting brought together physicians from across Georgia for networking and professional development.',
      detailsLink: '#',
      isUpcoming: false,
    },
    {
      id: '6',
      title: 'Health Fair 2024',
      date: 'May 15, 2024',
      location: 'Atlanta Community Center',
      description: 'Free health screenings and educational sessions for the community, organized by GAPI members.',
      detailsLink: '#',
      isUpcoming: false,
    },
    {
      id: '7',
      title: 'Cultural Celebration Night',
      date: 'March 8, 2024',
      location: 'GAPI Event Center',
      description: 'An evening of cultural performances, traditional music, and community bonding.',
      detailsLink: '#',
      isUpcoming: false,
    },
  ];

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
                {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 p-3 hover:bg-neutral-light/30 rounded-lg transition-colors">
                    <div className="flex-shrink-0 w-20 text-xs text-sand font-medium">
                      {event.date}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-neutral-dark text-sm mb-1 line-clamp-2">
                        {event.title}
                      </h4>
                      {event.location && (
                        <p className="text-xs text-neutral-dark/70 mb-1">
                          📍 {event.location}
                        </p>
                      )}
                      <p className="text-xs text-neutral-dark/70 line-clamp-2">
                        {event.description}
                      </p>
                      {activeTab === 'upcoming' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                          Upcoming
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
