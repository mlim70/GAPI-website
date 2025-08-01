import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import HeroEventCarousel from './HeroEventCarousel.js';
import { fetchCarouselImages } from '../../api/carousels.js';

export default function HeroSection() {
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEventImages() {
      try {
        const images = await fetchCarouselImages('heroCarousel');
        
        // Convert S3 images to event format for the carousel
        const events = images.slice(0, 3).map((img, index) => ({
          id: `event-${index + 1}`,
          title: `Event ${index + 1}`,
          date: new Date(img.lastModified).toLocaleDateString(),
          time: 'TBD',
          location: 'GAPI Event Center',
          description: 'Event description will be updated with actual event data.',
          image: img.url,
          isUpcoming: index % 2 === 0 // Alternate between upcoming and past
        }));
        
        setFeaturedEvents(events);
      } catch (error) {
        console.error('Failed to load event images:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEventImages();
  }, []);

  return (
    <section
      className="
        relative
        min-h-[81vh]
        flex items-center justify-center
        bg-gray-900
        text-white
        overflow-hidden
        pb-1
        hero-wave
      "
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 h-full flex items-center">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-stretch w-full h-full">
          
          {/* Left Column - Main Content */}
          <div className="text-center lg:text-left space-y-6 flex flex-col justify-center lg:col-span-2">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Welcome to
                <span className="block text-sand mt-2">GAPI</span>
              </h1>
              
              <p className="text-lg md:text-xl text-white/90 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Empowering physicians of Indian origin in Georgia through professional development, 
                cultural celebration, and community service.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to="/become-a-member"
                className="px-8 py-3 bg-sand text-neutral-dark rounded-lg font-semibold text-base
                         hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Become a Member
              </Link>
              <Link
                to="/about"
                className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold text-base
                         hover:bg-white hover:text-neutral-dark transition-all duration-300 transform hover:scale-105"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Right Column - Event Carousel */}
          <div className="w-full flex items-center lg:col-span-3">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-2xl">
                <div className="text-center text-gray-600">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clay mx-auto mb-4"></div>
                  <p>Loading events...</p>
                </div>
              </div>
            ) : (
              <HeroEventCarousel events={featuredEvents} autoPlayInterval={6000} />
            )}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute pt-12 bottom-6 left-1/2 transform -translate-x-1/2">
        <ChevronDown className="w-12 h-12 text-white animate-pulse" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-10 right-10 w-32 h-32 bg-sand/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 left-10 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
    </section>
  );
} 