import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import HeroEventCarousel from './HeroEventCarousel.js';
import { fetchS3ImagesFromFolder } from '../../api/s3';
import { getS3Buckets, getS3Folders } from '../../config/s3';
import { imageCache } from '../../utils/imageCache';

export default function HeroSection() {
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    async function loadEventImages() {
      try {
        setIsImageLoading(true);
        
        // Get fresh S3 configuration
        const s3Buckets = getS3Buckets();
        const s3Folders = getS3Folders();
        
        // Check cache first
        const cachedImages = imageCache.get('hero-image-urls');
        if (cachedImages) {
          createEventsWithImages(cachedImages);
          setIsImageLoading(false);
          return;
        }
        
        console.log('🔍 Fetching hero carousel images from backend...');
        const images = await fetchS3ImagesFromFolder(s3Buckets.website, s3Folders.hero);
        console.log('📦 Hero carousel images result:', images);
        
        // Cache the images
        imageCache.set('hero-image-urls', images);
        
        createEventsWithImages(images);
      } catch (error) {
        console.error('❌ Error fetching hero carousel images:', error);
        // Fallback to events without images
        createFallbackEvents();
      } finally {
        setLoading(false);
        setIsImageLoading(false);
      }
    }

    function createEventsWithImages(images: any[]) {
      const realEvents = [
        {
          id: '1',
          title: 'GAPI Annual and Scientific Meeting 2025',
          date: 'July 18-19, 2025',
          time: 'All Day',
          location: 'GAS South Convention Center, Gwinnett',
          description: 'Save the date for our premier annual gathering featuring scientific sessions, networking opportunities, and cultural celebrations.',
          image: images[0]?.url || '/placeholder-event.jpg',
          isUpcoming: false
        },
        {
          id: '2',
          title: 'Physician-Themed Indian Fashion Show 2025',
          date: 'July 18, 2025',
          time: 'Evening',
          location: 'GAS South Convention Center',
          description: 'A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship, and community.',
          image: images[1]?.url || '/placeholder-event.jpg',
          isUpcoming: false
        }
      ];
      
      setFeaturedEvents(realEvents);
    }

    function createFallbackEvents() {
      const fallbackEvents = [
        {
          id: '1',
          title: 'GAPI Annual and Scientific Meeting 2025',
          date: 'July 18-19, 2025',
          time: 'All Day',
          location: 'GAS South Convention Center, Gwinnett',
          description: 'Save the date for our premier annual gathering featuring scientific sessions, networking opportunities, and cultural celebrations.',
          image: '/placeholder-event.jpg',
          isUpcoming: false
        },
        {
          id: '2',
          title: 'Physician-Themed Indian Fashion Show 2025',
          date: 'July 18, 2025',
          time: 'Evening',
          location: 'GAS South Convention Center',
          description: 'A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship, and community.',
          image: '/placeholder-event.jpg',
          isUpcoming: false
        }
      ];
      setFeaturedEvents(fallbackEvents);
    }

    loadEventImages();
  }, []);

  return (
    <section
      className="
        relative
        min-h-[calc(100vh-4rem)]
        md:h-[calc(100vh-4rem)]
        lg:h-[600px]
        flex items-center justify-center
        bg-gray-900
        text-white
        overflow-x-hidden overflow-y-visible
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
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 h-full flex items-start lg:items-center">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-center lg:items-stretch w-full h-full">
          
          {/* Left Column - Main Content */}
          <div className="text-center lg:text-left space-y-6 flex flex-col justify-start lg:justify-center lg:col-span-2">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Welcome to
                <span className="block text-gold mt-2">GAPI</span>
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
                className="px-8 py-3 bg-gold text-neutral-dark rounded-lg font-semibold text-base
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
          <div className="w-full flex items-start lg:items-center lg:col-span-3">
            {loading ? (
              <div className="w-full h-74 flex items-center justify-center bg-gray-100 rounded-2xl">
                <div className="text-center text-gray-600">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
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
      <div className="absolute pt-12 bottom-2 left-1/2 transform -translate-x-1/2">
        <ChevronDown className="w-12 h-12 text-white animate-pulse" />
      </div>

      {/* Decorative Elements */}
              <div className="absolute top-10 right-10 w-32 h-32 bg-gold/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 left-10 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
    </section>
  );
} 
