import React from 'react';

const BoardDirectors: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Board of Directors
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Meet the dedicated physicians who serve on GAPI's Board of Directors.
          </p>
        </div>
      </div>

      <div className="page-background py-20">
        {/* Board of Directors */}
        <section className="container mx-auto px-6 max-w-6xl">
          <h2 className="text-3xl font-bold text-neutral-dark mb-8 text-center">
            Board of Directors
          </h2>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 max-w-3xl mx-auto">
              {[
                { name: "Amol Takalkar, MD", location: "Decatur, GA" },
                { name: "Dipesh Patel, MD", location: "Macon, GA" },
                { name: "Mark Manocha, MD", location: "Savannah, GA" },
                { name: "Nandini Sunkireddy, MD", location: "Roswell, GA" },
                { name: "Neelima Kothari, MD", location: "Marietta, GA" },
                { name: "Paresh Thanki, MD", location: "Valdosta, GA" },
                { name: "Rajeev Chauhan", location: "Columbus, GA" },
                { name: "Rani Reddy, MD", location: "Statesboro, GA" }, 
                { name: "Sarita Sharma, MD", location: "Augusta, GA" },
                { name: "Saurabh Khakharia, MD", location: "Marietta, GA" },
              ].map((member, index) => (
                <div key={index} className="flex items-center justify-between py-3 px-4 border-b border-gray-200 last:border-b-0">
                  <h3 className="text-lg font-semibold text-neutral-dark">{member.name}</h3>
                  <p className="text-neutral-600">{member.location}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
    </div>
  );
};

export default BoardDirectors;
