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
  const upcomingEvents = [
    {
      id: '1',
      title: 'GAPI Annual and Scientific Meeting 2025',
      date: 'July 18-19, 2025',
      location: 'GAS South Convention Center, Gwinnett',
      description: 'Save the date for our premier annual gathering featuring scientific sessions, networking opportunities, and cultural celebrations.',
      detailsLink: '#',
      isUpcoming: true,
    },
    {
      id: '2',
      title: 'Physician-Themed Indian Fashion Show 2025',
      date: 'July 18, 2025',
      location: 'GAS South Convention Center',
      description: 'A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship, and community.',
      detailsLink: '#',
      isUpcoming: true,
    },
    {
      id: '3',
      title: 'Choreographed Performances by Physician Members',
      date: 'July 18, 2025',
      location: 'GAS South Convention Center Grand Stage',
      description: 'Experience the artistic talents of our physician members through captivating choreographed performances.',
      detailsLink: '#',
      isUpcoming: true,
    },
    {
      id: '4',
      title: 'Robotic Surgery System Hands-on Practice',
      date: 'July 19, 2025',
      location: 'Practice Meet and Greet Area',
      description: 'Special attraction featuring a very cool Robotic Surgery System for hands-on practice. Open to physicians and non-physicians.',
      detailsLink: '#',
      isUpcoming: true,
    },
  ];

  // Past events data
  const pastEvents = [
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
    <div className="min-h-screen bg-[#FBFBF0]">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-red to-neutral-dark text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">GAPI Events</h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              Join us for professional development, cultural celebrations, and community service events throughout the year.
            </p>
          </div>
        </div>
      </section>

      {/* Events Content */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-white rounded-lg shadow-sm border border-neutral-light p-1">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-6 py-3 rounded-md font-semibold transition-colors ${
                  activeTab === 'upcoming'
                    ? 'bg-red text-white'
                    : 'text-neutral-dark hover:text-red'
                }`}
              >
                Upcoming Events
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`px-6 py-3 rounded-md font-semibold transition-colors ${
                  activeTab === 'past'
                    ? 'bg-red text-white'
                    : 'text-neutral-dark hover:text-red'
                }`}
              >
                Past Events
              </button>
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden border border-neutral-light hover:border-sand transition-all duration-300 hover:shadow-md"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-neutral-dark mb-2 line-clamp-2">
                        {event.title}
                      </h3>
                      <div className="flex items-center text-sm text-sand font-medium mb-2">
                        <span>{event.date}</span>
                      </div>
                      {event.location && (
                        <p className="text-sm text-neutral-dark/70 mb-3">{event.location}</p>
                      )}
                      <p className="text-sm text-neutral-dark/80 line-clamp-3 mb-4">
                        {event.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {event.detailsLink && (
                      <Link
                        to={event.detailsLink}
                        className="text-red hover:text-neutral-dark font-semibold text-sm transition-colors"
                      >
                        Learn More →
                      </Link>
                    )}
                    {activeTab === 'upcoming' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).length === 0 && (
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
      </section>
    </div>
  );
} 
