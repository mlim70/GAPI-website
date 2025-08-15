import React from "react";

type Committee = {
  id: string;
  title: string;
  blurb: string;
  members: { name: string}[];
};

const COMMITTEES: Committee[] = [
  {
    id: "burnout-recreation",
    title: "Physician Burnout and Recreation Committee",
    blurb:
      "Dedicated to physician wellness and creating opportunities for recreation and camaraderie.",
    members: [
      { name: "Lakshmi GopiReddy, MD" },
      { name: "Trushna Nadig, MD" },
      { name: "Meenu G. Singhal, MD" },
    ],
  },
  {
    id: "community-health-fairs",
    title: "Community Outreach Health Fairs Committee",
    blurb:
      "Organizes health fairs and outreach programs to promote public health awareness across Georgia.",
    members: [
      { name: "Indira Menon, MD" },
      { name: "Namita Parikh, MD" },
      { name: "Neelima Kothari, MD" },
      { name: "Sujatha Reddy, MD (advisor)"},
    ],
  },
  {
    id: "social-media-communications",
    title: "Social Media, Communications, and Community Relations Committee",
    blurb:
      "Leads GAPI's digital presence and cultivates relationships with partners and the broader community.",
    members: [
      { name: "Nandini SunkiReddy, MD" },
      { name: "Rani Reddy, MD" },
      { name: "Saurabh Khakharia, MD" },
    ],
  },
  {
    id: "education",
    title: "Education Committee",
    blurb:
      "Develops CME programming and professional development opportunities for members.",
    members: [
      { name: "Amol Takalkar, MD" },
      { name: "Suresh Nukala, MD" },
      { name: "Rajeev Chauhan, MD" },
    ],
  },
  {
    id: "fun-leisure-lifestyle",
    title: "Fun Leisure, Fashion, and Lifestyle Committee for Physicians",
    blurb:
      "Plans social events, lifestyle activities, and networking opportunities for physicians.",
    members: [
      { name: "Syamala Erramilli, MD" },
      { name: "Chandana Prabudev, MD" },
    ],
  },
];

export default function Committees() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            GAPI Committees
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Our committees collaborate to advance GAPI's mission and serve our community.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-5xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-dark mb-2">
            Committees 2024–25
          </h2>
        </div>

        {/* Committees Grid */}
        <div className="space-y-8">
          {COMMITTEES.map((committee) => (
            <section
              key={committee.id}
              className="bg-white rounded-lg shadow-sm border border-neutral-light p-6"
            >
              {/* Committee Header */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-neutral-dark mb-3">
                  {committee.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {committee.blurb}
                </p>
              </div>

              {/* Committee Members */}
              <div>
                <h4 className="text-base font-semibold text-neutral-dark mb-4">
                  Committee Members
                </h4>
                
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {committee.members.map((member) => (
                    <div
                      key={member.name}
                      className="bg-neutral-light/30 border border-neutral-light rounded-md p-3"
                    >
                      <p className="text-neutral-dark font-medium text-sm">
                        {member.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
