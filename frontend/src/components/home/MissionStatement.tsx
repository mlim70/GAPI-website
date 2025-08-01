export default function MissionStatement() {
  const missionPoints = [
    "To help its members in establishing their practice in the State of Georgia and to protect the professional interests of its members.",
    "To maintain liaison and communication with other Indian Associations, medical societies, and cultural organizations.",
    "To promote close relationship and communication among its members and to act as a central forum for the members, whereby information of common interest can be shared.",
    "To assist members in maintaining close liaison with local, national and international medical societies and organizations in North America and abroad including those in India.",
    "To promote the standard of practice in the arts and science of medicine in the common interest of its members and the public through educational, social and scientific activities.",
    "To promote a respectable image of the organization to the public through its nonprofit activities."
  ];

  return (
    <section className="py-16 bg-gradient-to-br from-red to-neutral-dark text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-6">Our Mission</h2>
          <div className="w-24 h-1 bg-gold mx-auto"></div>
        </div>

        <div className="space-y-6">
          {missionPoints.map((point, index) => (
            <div
              key={index}
              className="flex items-start space-x-4 p-6 bg-white/10 rounded-lg backdrop-blur-sm"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gold rounded-full flex items-center justify-center text-neutral-dark font-bold text-sm">
                {index + 1}
              </div>
              <p className="text-lg leading-relaxed">
                {point}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-xl font-semibold text-gold">
            Building bridges between cultures, advancing medical excellence, and fostering community.
          </p>
        </div>
      </div>
    </section>
  );
} 
