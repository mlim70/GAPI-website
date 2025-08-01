// frontend/src/pages/Clinic.tsx
import { useState, useEffect } from "react";
import { MapPin, Clock, Calendar, Heart, Stethoscope, Syringe, Users } from "lucide-react";
import ImageCarousel from "../components/ui/ImageCarousel.js";
import { fetchCarouselImages } from "../api/carousels.js";
import type { CarouselImage } from "../api/carousels.js";

export default function Clinic() {
  const [clinicImages, setClinicImages] = useState<CarouselImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClinicImages = async () => {
      try {
        const images = await fetchCarouselImages('clinicCarousel');
        setClinicImages(images);
      } catch (error) {
        console.error('Error loading clinic images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClinicImages();
  }, []);

  const imageUrls = clinicImages.map(img => img.url);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Image Carousel */}
      <div className="relative h-96 md:h-[500px] overflow-hidden">
        {isLoading ? (
          <div className="w-full h-full bg-neutral-dark/10 flex items-center justify-center">
            <div className="text-neutral-dark/60">Loading clinic images...</div>
          </div>
        ) : imageUrls.length > 0 ? (
          <ImageCarousel images={imageUrls} autoPlayInterval={5000} showNavigation={false} height="h-full" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red to-red/80 flex items-center justify-center">
            <div className="text-center text-white">
              <Users className="w-20 h-20 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No clinic images available</p>
            </div>
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-red-600/80"></div>
        
        {/* Content Overlay */}
        <div className="absolute inset-0 flex items-center justify-center translate-x-15">
          <div className="max-w-3xl px-4 sm:px-6 lg:px-8 w-full ml-auto mr-8">
            <div className="text-white">
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                GAPI Free Clinic
              </h1>
              <div className="flex items-center gap-2 text-xl md:text-2xl font-semibold mb-6">
                <Heart className="w-8 h-8 text-red-300" />
                <span>OPEN NOW</span>
              </div>
              
              <p className="text-2xl md:text-4xl font-semibold text-white mb-6 max-w-3xl">
                Providing free primary care consultation for families with no insurance and low income
              </p>
              
              {/* Schedule and Location Subheaders */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-red-light" />
                  <div>
                    <p className="text-base md:text-lg font-medium text-red-light">FIRST and THIRD Saturday of each month</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-red-light" />
                  <div>
                    <p className="text-base md:text-lg font-medium text-red-light">1:00 PM – 4:00 PM</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-light flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-base md:text-lg font-medium text-red-light">5675 Jimmy Carter Blvd, Suite 736</p>
                    <p className="text-sm text-red-light/80">Norcross, GA 30071 • Inside the Global Mall</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {/* Services Section */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <Stethoscope className="w-8 h-8 text-red" />
              <h2 className="text-3xl font-bold text-neutral-dark">Services Available</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-neutral-dark/80">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red rounded-full"></div>
                <span>Dentist consultation</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red rounded-full"></div>
                <span>Minimal cost for lab work</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red rounded-full"></div>
                <span>Discounted rate for medications and flu shots (in season)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red rounded-full"></div>
                <span>Referral to specialists at discounted fees</span>
              </div>
            </div>
          </section>

          {/* Recent Flu Vaccination Program */}
          <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-200">
            <div className="flex items-center gap-3 mb-6">
              <Syringe className="w-8 h-8 text-blue-600" />
              <h2 className="text-2xl font-bold text-blue-900">Recent Flu Vaccination Program</h2>
            </div>
            <p className="text-blue-800 mb-4 text-lg">
              Free flu vaccinations for individuals aged 18 and above were administered on:
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">September 21, 2024</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">October 5, 2024</span>
              </div>
            </div>
            <p className="text-blue-800">
              <strong>GAPI thanks Walgreens Pharmacy</strong> for collaborating to provide preventive services to GAPI clinic patients.
            </p>
          </section>

          {/* Quick Information */}
          <section className="bg-gradient-to-br from-red to-red/90 text-white rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-6">Quick Information</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <span>Free for families with no insurance</span>
              </div>
              <div className="flex items-center gap-3">
                <Heart className="w-6 h-6" />
                <span>Low-income individuals welcome</span>
              </div>
              <div className="flex items-center gap-3">
                <Stethoscope className="w-6 h-6" />
                <span>Primary care consultation available</span>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="bg-gradient-to-r from-red to-red/90 text-white rounded-lg p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Need Medical Care?</h2>
            <p className="text-xl mb-8 text-red-light">
              Visit us on the 1st or 3rd Saturday of each month for free primary care consultation.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <div className="bg-white/20 rounded-lg p-6">
                <Calendar className="w-10 h-10 mx-auto mb-3" />
                <p className="font-semibold text-lg">Next Clinic Day</p>
                <p className="text-red-light">Check calendar for dates</p>
              </div>
              <div className="bg-white/20 rounded-lg p-6">
                <Clock className="w-10 h-10 mx-auto mb-3" />
                <p className="font-semibold text-lg">Hours</p>
                <p className="text-red-light">1:00 PM - 4:00 PM</p>
              </div>
              <div className="bg-white/20 rounded-lg p-6">
                <MapPin className="w-10 h-10 mx-auto mb-3" />
                <p className="font-semibold text-lg">Location</p>
                <p className="text-red-light">Global Mall, Norcross</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 
