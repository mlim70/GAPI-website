import React from "react";
import scholarshipLogo from "../../../assets/gapi-scholarships.png";

export default function ScholarshipsAwards() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          {/* Scholarship Logo */}
          <div className="flex justify-center mb-6">
            <div className="rounded-full p-1">
              <img
                src={scholarshipLogo}
                alt="GAPI Scholarships"
                className="w-30 h-30 md:w-40 md:h-40 object-contain rounded-full"
              />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            GAPI Scholarships & Awards
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Empowering future physicians through financial support, mentorship,
            and community involvement.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* GAPI – YPPI Scholarship */}
        <section className="mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-neutral-dark mb-6 text-center">
              GAPI Youth Physician Pipeline Initiative (GAPI – YPPI) Scholarship
            </h2>

            {/* Vision */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Vision
              </h3>
              <p className="text-neutral-600 leading-relaxed">
                To inspire and guide students in pre-physician programs to
                pursue careers in medicine by fostering involvement in the
                physician, community, and patient care — and as future GAPI
                members.
              </p>
            </div>

            {/* Scholarship Amount */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Scholarship Amount
              </h3>
              <p className="text-neutral-600">
                Each recipient will be awarded a{" "}
                <strong>$1,000 scholarship</strong>. (5 GA students)
              </p>
            </div>

            {/* Eligibility Criteria */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Eligibility Criteria
              </h3>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>
                  Applicants must be high school (11th grade and above) or
                  pre-med students committed to pursuing a career in medicine.
                </li>
                <li>
                  Must demonstrate academic excellence and financial need as
                  outlined in their personal statement.
                </li>
                <li>
                  Awards will be chosen from students of Indian origin residing
                  and attending local colleges in Georgia.
                </li>
              </ul>
            </div>

            {/* Disqualifying Factors */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Disqualifying Factors
              </h3>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>Applicants already enrolled in medical school.</li>
                <li>
                  Family members of GAPI BOT or Executive members (past or
                  present).
                </li>
              </ul>
            </div>

            {/* Application Process */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Application Process
              </h3>
              <p className="text-neutral-600 mb-4">
                Applicants must submit <strong>three attachments by email</strong>:
              </p>
              <ol className="list-decimal list-inside text-neutral-600 space-y-1">
                <li>
                  Personal statement detailing academic achievements, financial
                  need, and commitment to a medical career.
                </li>
                <li>GPA and a high school/college transcript.</li>
                <li>
                  One letter of recommendation from a counselor or academic
                  teacher.
                </li>
              </ol>
              <p className="mt-3 text-neutral-600">
                Applications must be submitted by{" "}
                <strong>November 30th</strong> of each calendar year.
              </p>
              <p className="mt-1">
                Email application to:{" "}
                <a
                  href="mailto:lalitha.medepalli@gmail.com"
                  className="text-red hover:underline"
                >
                  lalitha.medepalli@gmail.com
                </a>
              </p>
            </div>

            {/* Selection Process */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Selection Process
              </h3>
              <p className="text-neutral-600">
                The GAPI Scholarship Selection Chair, Dr. Lalitha Medepalli,
                will review all applications. Selection will be based on
                academic merit, financial need, and commitment to the medical
                profession. Only selected applicants will be notified.
              </p>
            </div>

            {/* Benefits */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Scholarship Benefits
              </h3>
              <ul className="list-disc list-inside text-neutral-600 space-y-1">
                <li>$1,000 financial award</li>
                <li>Up to 8 shadowing opportunities</li>
                <li>
                  12 volunteer hours/year at the GAPI clinic and GAPI events
                </li>
                <li>
                  Access to all GAPI community outreach programs as volunteers
                </li>
                <li>
                  Formal recognition at the GAPI annual event and encouragement
                  to attend all regional meetings
                </li>
              </ul>
            </div>

            {/* Deadline */}
            <div className="bg-sand rounded-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                Application Deadline
              </h3>
              <p className="text-neutral-600">
                November 30th of each calendar year.
              </p>
              <a
                href="https://usgfoundation.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 bg-red text-white px-6 py-3 rounded-lg font-semibold hover:bg-red/90 transition"
              >
                Learn More & Apply
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
