// frontend/src/pages/Home.tsx
import { Link, NavLink } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import HeroSection from '../components/home/HeroSection';
import EventImageCarousel from '../components/home/EventImageCarousel';
import HomeNewsSection from '../components/home/HomeNewsSection';
import SponsorSection from '../components/home/SponsorSection';
import NewsletterSignup from '../components/newsletter/NewsletterSignup';
import { fetchS3ImagesFromFolder } from '../api/s3';
import { getS3Buckets, getS3Folders } from '../config/s3';
import { imageCache } from '../utils/imageCache';
import eventsData from '../metadata/events.json';
import newsData from '../metadata/news.json';
import { getEventImageUrlSync } from '../utils/s3ImageUtils';
import { categorizeEvents } from '../utils/dateUtils';

export default function Home() {
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Function to handle image load errors and refresh cache
  const handleGalleryImageError = async (imageIndex: number) => {
    console.log(`🔄 Gallery image ${imageIndex} failed to load, clearing cache and refreshing...`);
    
    // Clear the gallery carousel cache
    imageCache.clearKey('gallery-carousel-urls');
    
    // Reload images from backend
    await loadCarouselImages();
  };

  // Function to load carousel images
  const loadCarouselImages = async () => {
    try {
      setIsImageLoading(true);
      
      // Get fresh S3 configuration
      const s3Buckets = getS3Buckets();
      const s3Folders = getS3Folders();
      
      // Check cache first
      const cachedImages = imageCache.get('gallery-carousel-urls');
      if (cachedImages) {
        setCarouselImages(cachedImages);
        setIsImageLoading(false);
        return;
      }
      
      console.log('🔍 Fetching gallery carousel images from backend...');
      console.log('📍 S3 Configuration:', {
        bucket: 'gapi-home',
        folder: s3Folders.gallery,
        s3Buckets,
        s3Folders
      });
      
      const images = await fetchS3ImagesFromFolder('gapi-home', s3Folders.gallery);
      console.log('📦 Gallery carousel images result:', {
        totalImages: images.length,
        images: images.map(img => ({
          key: img.key,
          filename: img.filename,
          size: img.size
        }))
      });
      
      // Extract URLs from S3Image objects
      const imageUrls = images.map(img => img.url);
      
      // Cache the URLs
      imageCache.set('gallery-carousel-urls', imageUrls);
      
      setCarouselImages(imageUrls);
    } catch (error) {
      console.error('❌ Error fetching gallery carousel images:', error);
    } finally {
      setLoading(false);
      setIsImageLoading(false);
    }
  };

  useEffect(() => {
    loadCarouselImages();
  }, []);

  // Load events from JSON data - automatically get up to 3 upcoming and 3 past events
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const { upcomingEvents: allUpcoming, pastEvents: allPast } = categorizeEvents(eventsData.events);
    
    // Limit to 3 events each for the home page
    return { 
      upcomingEvents: allUpcoming.slice(0, 3), 
      pastEvents: allPast.slice(0, 3) 
    };
  }, []);
  
  // Helper function to generate event image URL from imageKey
  const getEventImageUrl = (imageKey?: string): string => {
    return getEventImageUrlSync(imageKey);
  };

  // Automatically get the three most recent news items from news.json
  const recentNews = useMemo(() => {
    // Sort news by date (newest first) and take the first 3
    return newsData.news
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3)
      .map(item => ({
        ...item,
        // Add placeholder image for items that don't have one
        imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDUyMkQ7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNMTIgNnZsNCA0IDQtNHYtNkgxMnoiLz4KPC9zdmc+Cjwvc3ZnPgo="
      }));
  }, []);

  return (
    <div className="bg-brand-cream min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Events & News */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming Events - Compact */}
            <section className="bg-white rounded-lg shadow-sm border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-xl font-bold text-neutral-dark">
                  Upcoming Events
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-start space-x-4 p-4 bg-neutral-light/30 rounded-lg">
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-sm font-semibold text-gold">{event.date}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-dark text-base mb-1 line-clamp-2">
                          {event.title}
                        </h3>
                        <p className="text-sm text-neutral-dark/70 line-clamp-2">
                          {event.description}
                        </p>
                        {event.location && (
                          <p className="text-sm text-gold mt-1">{event.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Link to="/events" className="text-base text-red hover:text-neutral-dark font-semibold">
                    View All Events →
                  </Link>
                </div>
              </div>
            </section>

            {/* Recent Past Events Section */}
            <section className="bg-white rounded-lg shadow-sm border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-xl font-bold text-neutral-dark">
                  Recent Past Events
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {pastEvents.map((event) => (
                    <Link key={event.id} to={event.detailsLink} className="block">
                      <div className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors">
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <img 
                            src={getEventImageUrl(event.imageKey)} 
                            alt={`${event.title} event`}
                            className="w-24 h-18 object-cover rounded-lg shadow-sm mb-2"
                                                          onError={(e) => {
                                // Set placeholder image if the original fails to load
                                const target = e.target as HTMLImageElement;
                                target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDUyMkQ7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNMTIgNnZsNCA0IDQtNHYtNkgxMnoiLz4KPC9zdmc+Cjwvc3ZnPgo=";
                              }}
                          />
                          <div className="text-xs font-medium text-sand text-center">
                            {event.date}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-neutral-dark text-base mb-1 line-clamp-2">
                            {event.title}
                          </h3>
                          <p className="text-sm text-neutral-dark/70 line-clamp-2">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Link to="/events" className="text-base text-red hover:text-neutral-dark font-semibold">
                    View All Past Events →
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column - Quick Info & CTA */}
          <div className="space-y-6">


            {/* Quick Actions */}
            <section className="bg-white rounded-lg shadow-sm border border-neutral-light p-6">
              <h3 className="text-lg font-bold text-neutral-dark mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/become-a-member"
                  className="block w-full bg-red text-white text-center py-3 px-4 rounded-lg font-semibold hover:bg-neutral-dark transition-colors"
                >
                  Become a Member
                </Link>
                <NavLink
                  to="/contact"
                  className="block w-full border border-red text-red text-center py-3 px-4 rounded-lg font-semibold hover:bg-red hover:text-white transition-colors"
                >
                  Contact Us
                </NavLink>
                <Link
                  to="/about"
                  className="block w-full border border-neutral-light text-neutral-dark text-center py-3 px-4 rounded-lg font-semibold hover:bg-neutral-light transition-colors"
                >
                  About GAPI
                </Link>
              </div>
            </section>

            {/* Newsletter Signup */}
            <section>
              <NewsletterSignup variant="card" source="homepage" />
            </section>


          </div>
        </div>

        {/* Image Carousel Section */}
        <section className="mt-8 bg-white rounded-lg shadow-sm border border-neutral-light p-6">
          <h2 className="text-xl font-bold text-neutral-dark mb-4">
            GAPI in Action
          </h2>
          {loading ? (
            <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-600">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
                <p>Loading images...</p>
              </div>
            </div>
          ) : (
            <EventImageCarousel 
              images={carouselImages} 
              autoPlayInterval={4000}
              onImageError={handleGalleryImageError}
            />
          )}
        </section>

        {/* Latest News Section */}
        <section className="mt-8">
          <HomeNewsSection news={recentNews} />
        </section>
      </div>

      {/* Sponsor Section */}
      <SponsorSection />
    </div>
  );
} 