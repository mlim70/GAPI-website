interface PastEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  imageUrl?: string;
  detailsLink?: string;
}

interface PastEventsProps {
  events: PastEvent[];
}

export default function PastEvents({ events }: PastEventsProps) {
  return (
    <section className="py-12 bg-neutral-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-dark mb-4">
            Recent Past Events
          </h2>
          <p className="text-lg text-neutral-dark/80 max-w-3xl mx-auto">
            Relive the memories from our recent gatherings and community events.
          </p>
        </div>

        <div className="space-y-8">
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              } md:flex`}
            >
              {event.imageUrl && (
                <div className="md:w-1/3">
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-64 md:h-full object-cover"
                  />
                </div>
              )}
              
              <div className="md:w-2/3 p-6">
                <div className="flex items-center text-sand font-semibold mb-3">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {event.date}
                </div>
                
                <h3 className="text-xl font-bold text-neutral-dark mb-3">
                  {event.title}
                </h3>
                
                <p className="text-neutral-dark/80 mb-4">
                  {event.description}
                </p>
                
                {event.detailsLink && (
                  <a
                    href={event.detailsLink}
                    className="inline-flex items-center text-red hover:text-neutral-dark font-semibold transition-colors duration-200"
                  >
                    View Details & Photos
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 
