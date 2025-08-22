import React from 'react';

const PastPresidents: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red to-red-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Past Presidents
          </h1>
          <p className="text-xl text-center text-red-100 max-w-3xl mx-auto">
            Honoring the distinguished leaders who have guided GAPI through its remarkable journey since 1987.
          </p>
        </div>
      </div>

      <div className="page-background py-20">
        {/* Past Presidents List */}
        <section className="container mx-auto px-6 max-w-6xl">
          <h2 className="text-3xl font-bold text-neutral-dark mb-8 text-center">
            GAPI Past Presidents
          </h2>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 max-w-3xl mx-auto">
              {/* Left Column */}
              <div className="space-y-4">
                {[
                  { name: "Firoz Yousufji, MD", year: "1989" },
                  { name: "P Mahishnan, MD", year: "1990" },
                  { name: "R Vanapalli, MD", year: "1991" },
                  { name: "G Raghu, MD", year: "1992" },
                  { name: "Y Joshi, MD", year: "1993" },
                  { name: "M Gupta, MD", year: "1994" },
                  { name: "A Kumar, MD", year: "1995" },
                  { name: "S Naidu, MD", year: "1996" },
                  { name: "M. Vinayak Kamath, MD", year: "1997" },
                  { name: "Narasimhan Neelagaru, MD", year: "1998" },
                  { name: "Naresh Parikh, MD", year: "1999" },
                  { name: "R Chhokar, MD", year: "2000" },
                  { name: "Puthugramam Natrajan, MD", year: "2001" },
                  { name: "P.B. Rao, MD", year: "2002" },
                  { name: "Manoj Shah, MD", year: "2003" },
                  { name: "Arvind Gupta, MD", year: "2004" },
                  { name: "Asha Parikh, MD", year: "2005" },
                  { name: "Bipin Chudgar, MD", year: "2006" },
                  { name: "Shailesh Gandhi, MD", year: "2007" },
                ].map((president, index) => (
                  <div key={index} className="flex items-center justify-between py-3 px-4 border-b border-gray-200 last:border-b-0">
                    <h3 className="text-lg font-semibold text-neutral-dark">{president.name}</h3>
                    <p className="text-neutral-600">{president.year}</p>
                  </div>
                ))}
              </div>
              
              {/* Right Column */}
              <div className="space-y-4">
                {[
                  { name: "Sudhakar Jonnalagadda, MD", year: "2008" },
                  { name: "Pravinchandra Patel, MD", year: "2009" },
                  { name: "Santanu Das, MD", year: "2010" },
                  { name: "Sreeni Gangasani, MD", year: "2011" },
                  { name: "Dilip Patel, MD", year: "2012" },
                  { name: "Abhishek Gaur, MD", year: "2013" },
                  { name: "Piyush Patel, MD", year: "2014" },
                  { name: "Indran Indrakrishnan, MD", year: "2015" },
                  { name: "Sudha Tata, MD", year: "2016" },
                  { name: "Vijay Maurya, MD", year: "2017" },
                  { name: "Raghu Lolabhattu, MD", year: "2018" },
                  { name: "Syamala Erramilli, MD", year: "2019" },
                  { name: "Hemant Yagnick, MD", year: "2020" },
                  { name: "Chandana Prabhudev, MD", year: "2021" },
                  { name: "Tarak Patel, MD", year: "2022" },
                  { name: "Uma Jonnalagadda, MD", year: "2023" },
                  { name: "Raj Alappan, MD", year: "2024" },
                  { name: "Lalitha Medepalli, MD", year: "2025" },
                ].map((president, index) => (
                  <div key={index} className="flex items-center justify-between py-3 px-4 border-b border-gray-200 last:border-b-0">
                    <h3 className="text-lg font-semibold text-neutral-dark">{president.name}</h3>
                    <p className="text-neutral-600">{president.year}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>


      </div>
    </div>
  );
};

export default PastPresidents;
