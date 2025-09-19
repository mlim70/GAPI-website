// frontend/src/pages/about/tabs/ExecutiveCommittee.tsx
import React from 'react';

// Import images
import lalithaImage from '../../../assets/executive-committee/committee-lalitha.png';
import satishImage from '../../../assets/executive-committee/committee-satish.jpg';
import appavuchettyImage from '../../../assets/executive-committee/committee-appavuchetty.jpg';
import vishalImage from '../../../assets/executive-committee/committee-vishal.png';
import raniImage from '../../../assets/executive-committee/committee-rani.jpg';
import sureshImage from '../../../assets/executive-committee/committee-suresh.jpg';

const ExecutiveCommittee: React.FC = () => {
  return (
          <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Executive Committee
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Meet the dedicated leaders who guide GAPI's day-to-day operations and strategic direction.
          </p>
        </div>
      </div>

             <div className="page-background py-16">
         {/* Current Leadership */}
         <section className="container mx-auto px-6 max-w-6xl">
           <h2 className="text-3xl font-bold text-neutral-dark mb-12 text-center">
             Executive Leadership 2025-26
           </h2>
           
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <img 
                  src={vishalImage} 
                  alt="Vishal Sharma, MD"
                  className="w-auto h-64 object-contain mx-auto mb-4 rounded-lg shadow-lg"
                />
                <h3 className="text-lg font-semibold text-neutral-dark mb-2">Vishal Sharma, MD</h3>
                <p className="text-red font-medium mb-1">President 2025-26</p>
              </div>

              <div className="text-center">
                <img 
                  src={satishImage} 
                  alt="Satish Cheti, MD"
                  className="w-auto h-64 object-contain mx-auto mb-4 rounded-lg shadow-lg"
                />
                <h3 className="text-lg font-semibold text-neutral-dark mb-2">Satish Cheti, MD</h3>
                <p className="text-red font-medium mb-1">President Elect 2025-26</p>
              </div>

              <div className="text-center">
                <img 
                  src={appavuchettyImage} 
                  alt="Appavuchetty Soundappan, MD"
                  className="w-auto h-64 object-contain mx-auto mb-4 rounded-lg shadow-lg"
                />
                <h3 className="text-lg font-semibold text-neutral-dark mb-2">Appavuchetty Soundappan, MD</h3>
                <p className="text-red font-medium mb-1">Vice President 2025-26</p>
              </div>

              <div className="text-center">
                <img 
                  src={raniImage} 
                  alt="Rani Reddy, MD"
                  className="w-auto h-64 object-contain mx-auto mb-4 rounded-lg shadow-lg"
                />
                <h3 className="text-lg font-semibold text-neutral-dark mb-2">Rani Reddy, MD</h3>
                <p className="text-red font-medium mb-1">Secretary 2025-26</p>
              </div>

              <div className="text-center">
                <div className="w-54 h-64 mx-auto mb-4 rounded-lg shadow-lg overflow-hidden">
                  <img 
                    src={sureshImage} 
                    alt="Suresh Nukula"
                    className="w-full h-full object-cover scale-105"
                  />
                </div>
                <h3 className="text-lg font-semibold text-neutral-dark mb-2">Suresh Nukula</h3>
                <p className="text-red font-medium mb-1">Treasurer 2025-26</p>
              </div>

              <div className="text-center">
                <img 
                  src={lalithaImage} 
                  alt="Lalitha Medepalli, MD, FACC"
                  className="w-auto h-64 object-contain mx-auto mb-4 rounded-lg shadow-lg"
                />
                <h3 className="text-lg font-semibold text-neutral-dark mb-2">Lalitha Medepalli, MD, FACC</h3>
                <p className="text-red font-medium mb-1">Past President 2024-25</p>
              </div>

             </div>
         </section>
       </div>
    </div>
  );
};

export default ExecutiveCommittee;
