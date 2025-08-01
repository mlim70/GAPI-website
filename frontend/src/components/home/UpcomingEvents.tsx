interface Event {
  id: string;
  title: string;
  date: string;
  location?: string;
  description: string;
  detailsLink?: string;
}

interface UpcomingEventsProps {
  events: Event[];
}

export default function UpcomingEvents({ events }: UpcomingEventsProps) {
  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-neutral-dark mb-3">
            Upcoming GAPI Annual Events
          </h2>
          <p className="text-base text-neutral-dark/80 max-w-3xl mx-auto">
            Join us for our premier annual gathering featuring scientific sessions, cultural celebrations, and networking opportunities.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow-sm overflow-hidden border border-neutral-light hover:border-sand transition-all duration-300 hover:shadow-md"
            >
              <div className="p-5">
                
                <h3 className="text-lg font-bold text-neutral-dark mb-2">
                  {event.title}
                </h3>
                
                <div className="flex items-center text-sand font-semibold mb-2">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {event.date}
                </div>
                
                {event.location && (
                  <div className="flex items-center text-neutral-dark/70 mb-3">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location}
                  </div>
                )}
                
                <p className="text-neutral-dark/80 mb-4 line-clamp-3 text-sm">
                  {event.description}
                </p>
                
                {event.detailsLink && (
                  <button className="w-full bg-red text-white py-2 px-4 rounded-lg hover:bg-neutral-dark transition-colors duration-200 font-semibold text-sm">
                    View Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Event Coordination Links */}
        <div className="mt-8 bg-neutral-light rounded-lg p-5">
          <h3 className="text-lg font-bold text-neutral-dark mb-4">
            Event Coordination & Logistics
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Westin Hotel Room Block', link: '#' },
              { title: 'CME Program Details', link: '#' },
              { title: 'Physician Practice Meet & Greet', link: '#' },
              { title: 'Registrants Gift Bag', link: '#' },
              { title: 'Food Committee', link: '#' }
            ].map((item, index) => (
              <a
                key={index}
                href={item.link}
                className="block bg-white p-3 rounded-lg border border-neutral-light hover:border-sand transition-colors duration-200 text-center"
              >
                <span className="text-neutral-dark font-semibold text-sm">{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
} 
