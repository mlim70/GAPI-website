// frontend/src/pages/Clinic.tsx
import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, Calendar, Heart, Stethoscope, Syringe, Users } from "lucide-react";
import { fetchS3ImagesFromFolder } from "../api/s3.js";
import { getS3Buckets, getS3Folders } from "../config/s3.js";
import { imageCache } from "../utils/imageCache.js";

export default function Clinic() {
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
        
        const images = await fetchS3ImagesFromFolder('gapi-clinic', s3Folders.hero);
        
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

  return (
    <div className="min-h-screen page-background">
        {/* Hero Section - Split Layout with Medical Elements */}
                 <header 
           ref={heroRef}
           className="
             relative bg-white text-neutral-dark overflow-hidden
             min-h-[45svh] lg:min-h-[55svh] lg:h-[75vh]
           "
         >
          {/* Optional background lift */}
          <div aria-hidden className="absolute inset-0">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-red/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-cream/40 blur-3xl" />
            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.5) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage:
                  "radial-gradient(1100px 550px at 20% 0%, black 40%, transparent 75%)",
                WebkitMaskImage:
                  "radial-gradient(1100px 550px at 20% 0%, black 40%, transparent 75%)",
              }}
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
                         <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 h-full items-stretch">
             
                             {/* Left side - Content */}
                              <div className="space-y-6 lg:space-y-8 self-center pb-8 lg:pb-0">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Calendar className="w-6 h-6 text-red flex-shrink-0" aria-hidden="true" />
                    <div className="text-center sm:text-left">
                      <p className="font-semibold text-lg">1st & 3rd Saturday</p>
                      <p className="text-base text-neutral-dark/70">of each month</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Clock className="w-6 h-6 text-red flex-shrink-0" aria-hidden="true" />
                    <div className="text-center sm:text-left">
                      <p className="font-semibold text-lg whitespace-nowrap">1:00 PM - 4:00 PM</p>
                      <p className="text-base text-neutral-dark/70">3-hour window</p>
                    </div>
                  </div>
                  
                    <button
                      type="button"
                      onClick={() => window.open('https://www.google.com/maps/dir//Global+Mall,+5675+Jimmy+Carter+Blvd,+Norcross,+GA+30071', '_blank', 'noopener')}
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity w-full sm:w-auto text-left"
                      aria-label="Open Google Maps for Global Mall, Norcross location"
                    >
                       <MapPin className="w-6 h-6 text-red flex-shrink-0" aria-hidden="true" />
                       <div className="text-center sm:text-left">
                         <p className="font-semibold text-lg lg:whitespace-nowrap">Global Mall, Norcross</p>
                         <p className="text-base text-neutral-dark/70">Suite 736</p>
                       </div>
                     </button>
                </div>
             </div>
             
                             {/* Right */}
               <div className="hidden lg:flex items-end justify-center h-full">
                 <div className="
                   relative w-full
                   aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-full
                   rounded-lg
                 ">
                  {isImageLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center page-background rounded-lg">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mx-auto"></div>
                        <p className="text-sm text-neutral-dark/60">Loading image...</p>
                      </div>
                    </div>
                  ) : doctorImageUrl ? (
                    <img
                      src={doctorImageUrl}
                      alt="GAPI Clinic physician"
                      className="hidden lg:block absolute inset-x-0 bottom-0 w-full h-full object-contain object-bottom translate-x-12"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      width={1600} height={1280} // set to approximate intrinsic size to reduce CLS
                      onLoad={() => console.log('✅ Doctor image loaded successfully')}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-red/5">
                      <div className="w-24 h-24 bg-red/10 rounded-full flex items-center justify-center">
                        <Stethoscope className="w-12 h-12 text-red" />
                      </div>
                      <p className="text-lg font-semibold text-neutral-dark">Professional Medical Care</p>
                      <p className="text-sm text-neutral-dark/70">Experienced healthcare providers</p>
                    </div>
                  )}
                </div>
              </div>
           </div>
         </div>
         
          {/* Bottom line divider */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red to-transparent"></div>
        </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 page-background">
        <div className="space-y-12">
          

          {/* Services Section */}
          <section aria-labelledby="services-heading">
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

          {/* Recent Flu Vaccination Program */}
          <section aria-labelledby="flu-program-heading" className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-200">
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

          {/* Quick Information */}
          <section className="bg-gradient-to-br from-red to-red/90 text-white rounded-lg p-8">
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
