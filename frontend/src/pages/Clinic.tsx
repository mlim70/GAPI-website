// frontend/src/pages/Clinic.tsx
import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, Calendar, Heart, Stethoscope, Syringe, Users } from "lucide-react";
import { fetchS3ImagesFromFolder } from "../api/s3.js";
import { getS3Buckets, getS3Folders } from "../config/s3.js";
import { imageCache } from "../utils/imageCache.js";

export default function Clinic() {
  const [isVisible, setIsVisible] = useState(false);
  const [doctorImageUrl, setDoctorImageUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);

  // Fetch doctor image from clinic bucket with localStorage caching
  useEffect(() => {
    const fetchDoctorImage = async () => {
      try {
        setIsImageLoading(true);
        
        // Get fresh S3 configuration
        const s3Buckets = getS3Buckets();
        const s3Folders = getS3Folders();
        
        // Check cache first
        const cachedUrl = imageCache.getSingle('clinic-doctor-url');
        if (cachedUrl) {
          setDoctorImageUrl(cachedUrl);
          setIsImageLoading(false);
          return;
        }
        
        const images = await fetchS3ImagesFromFolder(s3Buckets.clinic, s3Folders.hero);
        
        if (images && images.length > 0) {
          const firstImage = images[0];
          setDoctorImageUrl(firstImage.url);
          
          // Cache the URL
          imageCache.setSingle('clinic-doctor-url', firstImage.url);
        } else {
        }
      } catch (error) {
        console.error('❌ Error fetching doctor image:', error);
      } finally {
        setIsImageLoading(false);
      }
    };

    fetchDoctorImage();
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Hero Section - Split Layout with Medical Elements */}
        <header 
          ref={heroRef}
          className="relative bg-white text-neutral-dark h-[calc(100vh-64px)] overflow-hidden"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
            <div className="grid lg:grid-cols-2 gap-12 h-full items-center">
             
              {/* Left side - Content */}
              <div className="space-y-8">
                {/* Main headline */}
                <div>
                  <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
                    <span className="text-neutral-dark">Free</span>
                    <span className="block text-red">Healthcare</span>
                    <span className="block text-2xl lg:text-3xl font-normal text-neutral-dark/70 mt-4">
                      for Families in Need
                    </span>
                  </h1>
                  
                    {/* "Now accepting patients" Badge */}
                   <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 rounded-full px-4 py-2 text-sm font-medium border border-green-200">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                     <span>Now Accepting Patients</span>
                   </div>
                </div>
               
               {/* Description */}
               <p className="text-xl text-neutral-dark/80 leading-relaxed max-w-lg">
                 Providing compassionate medical care to families without insurance. 
                 Professional healthcare services at no cost.
               </p>
               
                {/* Schedule and location information */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-red flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-lg">1st & 3rd Saturday</p>
                      <p className="text-base text-neutral-dark/70">of each month</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-red flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-lg">1:00 PM - 4:00 PM</p>
                      <p className="text-base text-neutral-dark/70">3-hour window</p>
                    </div>
                  </div>
                  
                    <div 
                       className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                       onClick={() => window.open('https://www.google.com/maps/dir//Global+Mall,+5675+Jimmy+Carter+Blvd,+Norcross,+GA+30071', '_blank')}
                       role="button"
                       tabIndex={0}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                           e.preventDefault();
                           window.open('https://www.google.com/maps/dir//Global+Mall,+5675+Jimmy+Carter+Blvd,+Norcross,+GA+30071', '_blank');
                         }
                       }}
                       aria-label="Open Google Maps for Global Mall, Norcross location"
                     >
                       <MapPin className="w-6 h-6 text-red flex-shrink-0" aria-hidden="true" />
                       <div>
                         <p className="font-semibold text-lg whitespace-nowrap">Global Mall, Norcross</p>
                         <p className="text-base text-neutral-dark/70">Suite 736</p>
                       </div>
                     </div>
                </div>
             </div>
             
              {/* Right side - Doctor image */}
              <div className="flex items-center justify-center h-full">
                <div className="w-full h-full bg-white rounded-lg overflow-hidden relative">
                  {isImageLoading ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mx-auto"></div>
                        <p className="text-sm text-neutral-dark/60">Loading image...</p>
                      </div>
                    </div>
                  ) : doctorImageUrl ? (
                    <img 
                      src={doctorImageUrl} 
                      alt="GAPI Clinic Doctor" 
                      className="w-full h-full object-cover object-center transform translate-x-18"
                      loading="eager"
                      onLoad={() => console.log('✅ Doctor image loaded successfully')}
                    />
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-32 h-32 bg-red/10 rounded-full flex items-center justify-center mx-auto">
                        <Stethoscope className="w-16 h-16 text-red" />
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-neutral-dark">Professional Medical Care</p>
                        <p className="text-sm text-neutral-dark/70">Experienced healthcare providers</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
           </div>
         </div>
         
          {/* Bottom line divider */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red to-transparent"></div>
        </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-gray-50">
        <div className="space-y-12">
          

          {/* Services Section - Scroll Triggered */}
          <section aria-labelledby="services-heading" className={`transition-all duration-1000 ease-out delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center gap-3 mb-8">
              <Stethoscope className="w-8 h-8 text-red" aria-hidden="true" />
              <h2 id="services-heading" className="text-3xl font-bold text-neutral-dark">Services Available</h2>
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

          {/* Recent Flu Vaccination Program - Scroll Triggered */}
          <section aria-labelledby="flu-program-heading" className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-200 transition-all duration-1000 ease-out delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center gap-3 mb-6">
              <Syringe className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h2 id="flu-program-heading" className="text-2xl font-bold text-blue-900">Recent Flu Vaccination Program</h2>
            </div>
            <p className="text-blue-800 mb-4 text-lg">
              Free flu vaccinations for individuals aged 18 and above were administered on:
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" aria-hidden="true" />
                <span className="font-semibold text-blue-900">September 21, 2024</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" aria-hidden="true" />
                <span className="font-semibold text-blue-900">October 5, 2024</span>
              </div>
            </div>
            <p className="text-blue-800">
              <strong>GAPI thanks Walgreens Pharmacy</strong> for collaborating to provide preventive services to GAPI clinic patients.
            </p>
          </section>

          {/* Quick Information - Scroll Triggered */}
          <section className={`bg-gradient-to-br from-red to-red/90 text-white rounded-lg p-8 transition-all duration-1000 ease-out delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8" aria-hidden="true" />
                  <span>Free primary consultation for families with no insurance</span>
                </div>
              <div className="flex items-center gap-3">
                <Heart className="w-6 h-6" aria-hidden="true" />
                <span>Low-income individuals welcome</span>
              </div>
              <div className="flex items-center gap-3">
                <Stethoscope className="w-6 h-6" aria-hidden="true" />
                <span>Primary care consultation available</span>
              </div>
            </div>
          </section>
        </div>
      </div>

             {/* CSS for reduced motion preference */}
       <style>{`
         @media (prefers-reduced-motion: reduce) {
           .transition-all {
             transition: none !important;
           }
           .duration-1000,
           .duration-500,
           .duration-300 {
             transition-duration: 0s !important;
           }
         }
       `}</style>
    </div>
  );
} 
