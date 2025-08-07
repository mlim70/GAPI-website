// frontend/src/pages/Contact.tsx
export default function Contact() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8" style={{
      background: 'linear-gradient(to bottom, white 0%, white 60%, rgb(249 250 251) 80%, rgb(249 250 251) 95%, rgb(249 250 251) 100%)'
    }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get in touch with our team. We're here to help and answer your questions.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-gray-600 mb-4">
            Have questions about GAPI or need assistance? We'd love to hear from you.
          </p>
          <p className="text-gray-600">
            Reach out to our team for support, membership inquiries, or general questions about our services and community.
          </p>
        </div>
      </div>
    </div>
  );
} 
