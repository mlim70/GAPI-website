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
      {/* Hero */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-3">
            GAPI Committees
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Our committees collaborate to advance GAPI's mission and serve our community.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-neutral-dark">
            Committees 2024–25
          </h2>
        </div>

        <div className="space-y-6">
          {COMMITTEES.map((committee) => (
            <section
              key={committee.id}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-neutral-dark mb-2">
                  {committee.title}
                </h3>
                <p className="text-neutral-600 mb-4">{committee.blurb}</p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {committee.members.map((m) => (
                  <div
                    key={m.name}
                    className="bg-sand rounded-lg p-3 flex items-center justify-between"
                  >
                    <p className="text-neutral-dark font-medium">{m.name}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
