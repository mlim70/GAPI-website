import React from 'react';
import { NavLink } from 'react-router-dom';
import sponsorsData from '../../data/sponsors.json';

interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string | null;
}

export default function SponsorSection() {
  const sponsors: Sponsor[] = sponsorsData;

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-light" style={{
      background: 'linear-gradient(to bottom, white 0%, white 60%, rgb(249 250 251) 80%, rgb(249 250 251) 95%, rgb(249 250 251) 100%)'
    }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-neutral-dark mb-4">
            Our Sponsors
          </h2>
          <p className="text-lg text-neutral-dark/70 max-w-2xl mx-auto">
            We're grateful for the support of our generous sponsors who help make our mission possible.
          </p>
        </div>
        
        {sponsors.length === 0 ? (
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
            <NavLink to="/sponsor-us" className="text-red hover:text-neutral-dark font-medium">
              Sponsor us
            </NavLink>
          </p>
        </div>
      </div>
    </section>
  );
} 
