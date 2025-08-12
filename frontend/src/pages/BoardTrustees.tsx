import React from 'react';

const BoardTrustees: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            GAPI Board of Trustees
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Meet the distinguished trustees who provide guidance and oversight to GAPI's mission and activities.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-b from-white to-gray-50 py-20">
        {/* Board of Trustees */}
        <section className="container mx-auto px-6 max-w-6xl">
          <h2 className="text-3xl font-bold text-neutral-dark mb-8 text-center">
            GAPI Board of Trustees 2024-25
          </h2>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 max-w-3xl mx-auto">
              {[
                { name: "Sreeni Gangasani, MD", role: "Chair", location: "Duluth" },
                { name: "Uma Jonnalagadda, MD", location: "Valdosta" },
                { name: "Chandana Prabudev, MD", location: "Griffin" },
                { name: "Tarak Patel, MD", location: "Augusta" },
                { name: "Pravinchandra Patel, MD", location: "Columbus" },
                { name: "Indran Indrakrishnan, MD", location: "Lawrenceville" },
              ].map((trustee, index) => (
                <div key={index} className="flex items-center py-3 px-4 border-b border-gray-200 last:border-b-0">
                  <h3 className="text-lg font-semibold text-neutral-dark mr-6">{trustee.name}</h3>
                  <p className="text-neutral-600">{trustee.role ? `${trustee.role}, ${trustee.location}` : trustee.location}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
    </div>
  );
};

export default BoardTrustees;
