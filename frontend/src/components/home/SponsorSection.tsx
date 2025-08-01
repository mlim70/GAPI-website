import { useState, useEffect } from 'react';
import { fetchSponsors } from '../../api/sponsors.js';

interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

export default function SponsorSection() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSponsors() {
      try {
        setLoading(true);
        const sponsorData = await fetchSponsors();
        setSponsors(sponsorData);
      } catch (err) {
        console.error('Failed to load sponsors:', err);
        setError('Failed to load sponsors');
      } finally {
        setLoading(false);
      }
    }

    loadSponsors();
  }, []);
  return (
    <section className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-light">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-neutral-dark mb-4">
            Our Sponsors
          </h2>
          <p className="text-lg text-neutral-dark/70 max-w-2xl mx-auto">
            We're grateful for the support of our generous sponsors who help make our mission possible.
          </p>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
              <p className="text-neutral-dark/60">Loading sponsors...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-neutral-dark/60">{error}</p>
          </div>
        ) : sponsors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-dark/60">No sponsors available at the moment.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-8">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-center">
              {sponsors.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="flex items-center justify-center"
                >
                  {sponsor.website ? (
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full h-16 flex items-center justify-center cursor-pointer"
                      title={`Visit ${sponsor.name} website`}
                    >
                      <img
                        src={sponsor.logo}
                        alt={`${sponsor.name} logo`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-16 flex items-center justify-center">
                      <img
                        src={sponsor.logo}
                        alt={`${sponsor.name} logo`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-center mt-12">
          <p className="text-sm text-neutral-dark/60">
            Interested in becoming a sponsor?{' '}
            <a href="/contact" className="text-red hover:text-neutral-dark font-medium">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
} 
