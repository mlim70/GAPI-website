import React from 'react';

const FAQs: React.FC = () => {
  return (
         <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Find answers to common questions about GAPI, our mission, and activities.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* FAQs */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-neutral-dark mb-8 text-center">
              GAPI FAQ's
            </h2>
            
            <div className="space-y-8">
              <div className="border-b border-sand pb-8">
                <h3 className="text-2xl font-semibold text-neutral-dark mb-4">
                  What is GAPI?
                </h3>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  GAPI is an organization established in 1987 by Indian physicians practicing in the state of Georgia as a forum for sharing information of common interest.
                </p>
              </div>

              <div className="border-b border-sand pb-8">
                <h3 className="text-2xl font-semibold text-neutral-dark mb-4">
                  What is GAPI trying to accomplish?
                </h3>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  They strive to promote scientific, educational, civic and professional activities and to act as a liaison between various professional organizations in U.S.A and India.
                </p>
              </div>

              <div className="border-b border-sand pb-8">
                <h3 className="text-2xl font-semibold text-neutral-dark mb-4">
                  To date, how many members are in GAPI?
                </h3>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  To date, there are – 815 members and 587 life members, that number is growing steadily.
                </p>
              </div>

              <div className="border-b border-sand pb-8">
                <h3 className="text-2xl font-semibold text-neutral-dark mb-4">
                  What are their activities?
                </h3>
                <div className="text-lg text-neutral-600 leading-relaxed space-y-4">
                  <p>
                    CME and NON-CME meetings, General interest discussions with lectures on practice issues, Finances, investments in U.S, India, etc., Opportunities for interaction with charities, State Government and Politicians. Camaraderie and entertainment, Updates on latest practice management techniques.
                  </p>
                  <p>
                    Additionally, GAPI will hold three quarterly meetings and one annual meeting. Distinguished guests are invited to speak on various medical topics. Consultants are invited to address important issues pertaining to practice management in todays growing managed care environment.
                  </p>
                  <p>
                    GAPI Foundation provides for scholarships to deserving college students. It renders emergency disaster relief.
                  </p>
                </div>
              </div>

              <div className="pb-8">
                <h3 className="text-2xl font-semibold text-neutral-dark mb-4">
                  How can I become a member?
                </h3>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Membership is open to physicians of Indian origin practicing in Georgia. You can apply through our membership application process, which includes verification of credentials and payment of annual dues. Visit our "Memberships" page for more details.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FAQs;
