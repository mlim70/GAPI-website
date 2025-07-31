// frontend/src/pages/Home.tsx
export default function Home() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to GAPI
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your gateway to professional growth and networking opportunities.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Home Page</h2>
          <p className="text-gray-600">
            Welcome to the GAPI website. Explore our services and become a member to unlock exclusive benefits.
          </p>
        </div>
      </div>
    </div>
  );
} 