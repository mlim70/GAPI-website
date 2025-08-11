// frontend/src/pages/About.tsx
export default function About() {
  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section — polished w/ grid + glow */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-red/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-cream/40 blur-3xl" />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(0,0,0,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage:
                "radial-gradient(1100px 550px at 20% 0%, black 40%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(1100px 550px at 20% 0%, black 40%, transparent 75%)",
            }}
          />
        </div>

        {/* Accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-red via-red/50 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left column */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-neutral-light/60 bg-white/60 backdrop-blur px-3 py-1 text-xs font-medium text-neutral-dark/70 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red" />
                Georgia Association of Physicians of Indian Origin
              </span>

              <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-neutral-dark">
                Advancing medicine.<br /> Elevating community.
              </h1>

              <p className="mt-4 text-lg md:text-xl text-neutral-dark/70 max-w-2xl">
                GAPI supports physicians through education, advocacy, and connection — strengthening
                clinical excellence while building a thriving professional network across Georgia.
              </p>

              {/* Actions */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="/become-a-member"
                  className="inline-flex items-center justify-center rounded-lg bg-red px-5 py-3 text-white font-semibold shadow-sm hover:bg-red/90 transition-colors"
                >
                  Join GAPI
                </a>
                <a
                  href="/leadership"
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-light bg-white px-5 py-3 text-neutral-dark/80 font-semibold hover:bg-neutral-light/30 transition-colors"
                >
                  View Leadership
                </a>
              </div>
            </div>

            {/* Right column — streamlined stats */}
            <aside className="lg:col-span-5">
              <div className="rounded-xl border border-neutral-light bg-white/80 backdrop-blur shadow-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-dark/70 tracking-wide">
                  At a glance
                </h2>
                <div className="mt-5 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-3xl font-bold text-neutral-dark">30+</div>
                    <div className="text-xs text-neutral-dark/60 mt-1">Years serving GA</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-neutral-dark">2k+</div>
                    <div className="text-xs text-neutral-dark/60 mt-1">Physicians reached</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-neutral-dark">50+</div>
                    <div className="text-xs text-neutral-dark/60 mt-1">Events & programs</div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            <section>
              <h2 className="text-3xl font-semibold text-neutral-dark mb-8 text-center">
                Our Mission
              </h2>
              
              <div className="space-y-6 text-neutral-dark/80 leading-relaxed">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-5 h-5 bg-red/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red rounded-full"></div>
                  </div>
                  <p className="text-lg">
                    To promote close relationship and communication among its members and to act as a central forum for the members, whereby information of common interest can be shared.
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-5 h-5 bg-red/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red rounded-full"></div>
                  </div>
                  <p className="text-lg">
                    To promote the standard of practice in the arts and science of medicine in the common interest of its members and the public through educational, social and scientific activities.
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-5 h-5 bg-red/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red rounded-full"></div>
                  </div>
                  <p className="text-lg">
                    To help its members in establishing their practice in the State of Georgia and to protect the professional interests of its members.
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-5 h-5 bg-red/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red rounded-full"></div>
                  </div>
                  <p className="text-lg">
                    To maintain liaison and communication with other Indian Associations, medical societies, and cultural organizations.
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-5 h-5 bg-red/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red rounded-full"></div>
                  </div>
                  <p className="text-lg">
                    To assist members in maintaining close liaison with local, national and international medical societies and organizations in North America and abroad including those in India.
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-5 h-5 bg-red/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red rounded-full"></div>
                  </div>
                  <p className="text-lg">
                    To promote a respectable image of the organization to the public through its nonprofit activities.
                  </p>
                </div>
              </div>
            </section>

            <section className="pt-8 border-t-2 border-gray-200">
              <div className="bg-neutral-light/20 rounded-xl p-8 border border-gray-200">
                <h3 className="text-xl font-semibold text-neutral-dark mb-4">GAPI PAC</h3>
                <p className="text-neutral-dark/80 leading-relaxed">
                  GAPI PAC will organize physicians to gain influence through positions in boards and organizations that pertain to the needs of physicians, for example medical licensing boards. This goal will be partially achieved by fund raising for political figures.
                </p>
              </div>
            </section>
            
            <section className="pt-8 text-center">
              <div className="bg-red/5 border border-red/20 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-neutral-dark mb-4">Organization Bylaws</h3>
                <p className="text-neutral-dark/70 mb-6">
                  Access our complete organizational bylaws and governance documents.
                </p>
                <a 
                  href="/GAPI-By-laws-2023-3.pdf"
                  download
                  className="inline-flex items-center px-8 py-3 bg-red text-white font-medium rounded-lg hover:bg-red/90 transition-colors shadow-sm"
                >
                  Download Bylaws
                </a>
                <p className="text-sm text-neutral-dark/50 mt-3">
                  Last updated: March 7th, 2023
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 
