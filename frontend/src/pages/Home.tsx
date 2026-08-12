// frontend/src/pages/Home.tsx
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import HeroSection from '../components/home/HeroSection';
import EventImageCarousel from '../components/home/EventImageCarousel';
import HomeNewsSection from '../components/home/HomeNewsSection';
import SponsorSection from '../components/home/SponsorSection';
import NewsletterSignup from '../components/newsletter/NewsletterSignup';
import galleryImagePaths from '../data/galleryImages.json';
import eventsData from '../data/events.json';
import newsData from '../data/news.json';
import { categorizeEvents } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export default function Home() {
  const navigate = useNavigate();

  // Gallery carousel images are now static paths from the manifest
  const carouselImages: string[] = galleryImagePaths;

  // Load events from JSON data - automatically get up to 3 upcoming and 3 past events
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const { upcomingEvents: allUpcoming, pastEvents: allPast } = categorizeEvents(eventsData.events);

    // Limit to 3 events each for the home page
    return {
      upcomingEvents: allUpcoming.slice(0, 3),
      pastEvents: allPast.slice(0, 3)
    };
  }, []);

  // Automatically get the three most recent news items from news.json
  const recentNews = useMemo(() => {
    // Sort news by date (newest first) and take the first 3
    return newsData.news
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
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
                  {upcomingEvents.map((event) => {
                    const isPDF = event.detailsLink?.endsWith('.pdf');
                    const handleEventClick = (e: React.MouseEvent) => {
                      // Don't navigate if clicking the RSVP button
                      if ((e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      if (event.detailsLink) {
                        if (isPDF) {
                          window.open(event.detailsLink, '_blank');
                        } else {
                          navigate(event.detailsLink);
                        }
                      } else {
                        navigate('/events');
                      }
                    };

                    return (
                      <div
                        key={event.id}
                        className="block cursor-pointer"
                        onClick={handleEventClick}
                      >
                        <div className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors">
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <div className="text-xs font-medium text-sand text-center">
                              {event.date}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-neutral-dark text-base mb-1 line-clamp-2">
                              {event.title}
                            </h3>
                            <p
                              className="text-sm text-neutral-dark/70 line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: event.description }}
                            />
                            {event.rsvpLink && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(event.rsvpLink, '_blank');
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-neutral-dark transition-colors cursor-pointer"
                                >
                                  RSVP / Register
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  {pastEvents.map((event) => {
                    const isPDF = event.detailsLink?.endsWith('.pdf');
                    const handleEventClick = (e: React.MouseEvent) => {
                      if ((e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      if (event.detailsLink) {
                        if (isPDF) {
                          window.open(event.detailsLink, '_blank');
                        } else {
                          navigate(event.detailsLink);
                        }
                      } else {
                        navigate('/events');
                      }
                    };

                    return (
                      <div
                        key={event.id}
                        className="block cursor-pointer"
                        onClick={handleEventClick}
                      >
                        <div className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors">
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <div className="text-xs font-medium text-sand text-center">
                              {event.date}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-neutral-dark text-base mb-1 line-clamp-2">
                              {event.title}
                            </h3>
                            <p
                              className="text-sm text-neutral-dark/70 line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: event.description }}
                            />
                            {event.rsvpLink && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(event.rsvpLink, '_blank');
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-neutral-dark transition-colors cursor-pointer"
                                >
                                  RSVP / Register
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
          <EventImageCarousel
            images={carouselImages}
            autoPlayInterval={4000}
          />
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