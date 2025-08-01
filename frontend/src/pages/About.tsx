// frontend/src/pages/About.tsx
export default function About() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            About GAPI
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Learn more about our mission, values, and the community we're building.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About GAPI</h2>
          <p className="text-gray-600 mb-4">
            GAPI is dedicated to fostering professional growth and creating meaningful connections within our community.
          </p>
          <p className="text-gray-600">
            Our organization provides resources, networking opportunities, and support for professionals looking to advance their careers and make a positive impact in their field.
          </p>
        </div>
      </div>
    </div>
  );
} 
