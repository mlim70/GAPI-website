// frontend/src/pages/SponsorUs.tsx
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchSponsors } from '../api/sponsors';
import { createSponsorCheckout } from '../api/sponsorCheckout';
import { logger } from '../utils/logger';

const currencyFormat = (v: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);


interface Sponsor {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

interface SponsorshipTier {
  name: string;
  amount: string;
  benefits: string[];
  color: string;
}

const sponsorshipTiers: SponsorshipTier[] = [
  {
    name: "Silver",
    amount: "$1,000",
    color: "from-gray-300/20 to-gray-500/20",
    benefits: [
      "Acknowledgment during the meeting"
    ]
  },
  {
    name: "Gold",
    amount: "$2,000",
    color: "from-yellow-400/20 to-yellow-600/20",
    benefits: [
      "Display table at event",
      "Acknowledgment during the meeting"
    ]
  },
  {
    name: "Platinum",
    amount: "$3,000",
    color: "from-purple-400/20 to-purple-600/20",
    benefits: [
      "Sponsor talkes for 5 minutes",
      "Display table at event",
      "Acknowledgment during the meeting"
    ]
  },
  {
    name: "Patron",
    amount: "$5,000",
    color: "from-rose-400/20 to-rose-600/20",
    benefits: [
      "Sponsor talkes for 10 minutes",
      "Display table at event",
      "Acknowledgment during the meeting"
    ]
  },
  {
    name: "Grand Sponsor",
    amount: "$10,000",
    color: "from-indigo-400/20 to-indigo-600/20",
    benefits: [
      "Sponsor talkes for 15 minutes",
      "Display table at event",
      "Acknowledgment during the meeting"
    ]
  },
  {
    name: "Custom Amount",
    amount: "Custom",
    color: "from-green-400/20 to-green-600/20",
    benefits: [
      "Benefits based on amount",
      "Display table (for $2,000+)"
    ]
  }
];

export default function SponsorUs() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Sponsor form state
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SponsorshipTier | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [sponsorForm, setSponsorForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: ''
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    async function loadSponsors() {
      try {
        setLoading(true);
        const sponsorData = await fetchSponsors();
        setSponsors(sponsorData);
      } catch (err) {
        logger.error('Failed to load sponsors:', err);
        setError('Failed to load sponsors');
      } finally {
        setLoading(false);
      }
    }

    loadSponsors();
  }, []);

  const validateSponsorForm = () => {
    const errors: { [key: string]: string } = {};

    if (!sponsorForm.name.trim()) {
      errors.name = 'Full name is required';
    }

    if (!sponsorForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sponsorForm.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!sponsorForm.company.trim()) {
      errors.company = 'Company/Organization name is required';
    }

    // Validate custom amount if Custom Amount tier is selected
    if (selectedTier?.name === 'Custom Amount') {
      if (!customAmount.trim()) {
        errors.customAmount = 'Custom amount is required';
      } else {
        const amount = parseFloat(customAmount);
        if (isNaN(amount) || amount < 1) {
          errors.customAmount = 'Please enter a valid amount (minimum $1.00)';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSponsorFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSponsorForm(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleGetStarted = (tier: SponsorshipTier) => {
    setSelectedTier(tier);
    setShowSponsorForm(true);
    // Reset form
    setSponsorForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      message: ''
    });
    setCustomAmount('');
    setFormErrors({});
  };

  const handleSponsorCheckout = async () => {
    if (!selectedTier || !validateSponsorForm()) {
      return;
    }

    // Determine the amount based on tier type
    let numericAmount: number;
    let displayAmount: string;

    if (selectedTier.name === 'Custom Amount') {
      numericAmount = parseFloat(customAmount);
      displayAmount = `$${numericAmount.toFixed(2)}`;
    } else {
      // Extract numeric amount from string like "$1,000"
      numericAmount = parseFloat(selectedTier.amount.replace(/[$,]/g, ''));
      displayAmount = selectedTier.amount;
    }

    setCheckoutLoading(displayAmount);

    try {
      const checkoutData = {
        amount: numericAmount,
        email: sponsorForm.email,
        name: sponsorForm.name,
        company: sponsorForm.company,
        phone: sponsorForm.phone,
        message: sponsorForm.message,
        tierName: selectedTier.name === 'Custom Amount' ? `Custom Amount - ${displayAmount}` : selectedTier.name
      };

      logger.info('🚀 Starting sponsor checkout for amount:', numericAmount);

      const result = await createSponsorCheckout(checkoutData);

      logger.info('✅ Received checkout result:', result);

      // Redirect to Stripe checkout
      if (result.sessionUrl) {
        logger.info('🔄 Redirecting to Stripe checkout:', result.sessionUrl);
        window.location.href = result.sessionUrl;
      } else {
        throw new Error('No checkout URL received from server');
      }

    } catch (error: any) {
      logger.error('❌ Error starting sponsor checkout:', error);
      alert(`Checkout failed: ${error?.message || 'Unknown error'}. Please try again or contact us.`);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleSponsorshipInquiry = () => {
    window.location.href = '/contact?subject=Sponsorship Inquiry';
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 min-h-screen relative overflow-hidden">
      {/* Background decorative elements */}
      <div aria-hidden className="absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-br from-red/20 via-red/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-brand-cream/40 via-brand-cream/20 to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/4 h-56 w-56 rounded-full bg-gradient-to-br from-blue/20 via-blue/10 to-transparent blur-2xl" />
        <div className="absolute top-1/4 right-1/4 h-40 w-40 rounded-full bg-gradient-to-br from-red/15 via-red/5 to-transparent blur-2xl" />
        <div className="absolute bottom-1/3 left-1/3 h-32 w-32 rounded-full bg-gradient-to-br from-blue/15 via-blue/5 to-transparent blur-xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red/20 via-red/10 to-red/5 rounded-full shadow-lg">
              <svg className="w-10 h-10 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-neutral-dark via-red to-neutral-dark bg-clip-text text-transparent">
              Sponsor Us
            </h1>
          </div>
          <div className="w-24 h-1 bg-gradient-to-r from-red/40 via-red to-red/40 mx-auto mb-6 rounded-full"></div>
          <p className="text-xl text-neutral-dark/80 max-w-3xl mx-auto leading-relaxed">
            Partner with GAPI to support the Georgian medical community and advance healthcare excellence.
            Your sponsorship helps us build bridges, foster professional development, and strengthen our community.
          </p>
        </div>


        {/* Sponsorship Tiers */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-neutral-dark mb-12">Sponsorship Opportunities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {sponsorshipTiers.map((tier, index) => (
              <div
                key={tier.name}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border border-neutral-light"
              >
                <div className={`w-full h-24 bg-gradient-to-br ${tier.color} rounded-lg mb-6 flex items-center justify-center`}>
                  <h3 className="text-xl font-bold text-neutral-dark text-center">{tier.name}</h3>
                </div>

                <div className="text-center mb-6">
                  <span className="text-3xl font-bold text-red">{tier.amount}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-neutral-dark/80 text-sm leading-relaxed">{benefit}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleGetStarted(tier)}
                  disabled={checkoutLoading === tier.amount}
                  className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 bg-neutral-dark text-white hover:bg-red disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkoutLoading === tier.amount ? 'Loading...' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Current Sponsors Section */}
        {sponsors.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-neutral-dark mb-4">
                Our Sponsors
              </h2>
              <p className="text-lg text-neutral-dark/70 max-w-2xl mx-auto">
                We're grateful for the support of our generous sponsors who help make our mission possible.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
                  <p className="text-neutral-dark/60">Loading sponsors...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-neutral-dark/60">{error}</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-8">
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-center">
                  {sponsors.map((sponsor) => (
                    <div
                      key={sponsor.id}
                      className="flex items-center justify-center"
                    >
                      {sponsor.website ? (
                        <a
                          href={sponsor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-16 flex items-center justify-center cursor-pointer"
                          title={`Visit ${sponsor.name} website`}
                        >
                          <img
                            src={sponsor.logo}
                            alt={`${sponsor.name} logo`}
                            className="max-w-full max-h-full object-contain"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-16 flex items-center justify-center">
                          <img
                            src={sponsor.logo}
                            alt={`${sponsor.name} logo`}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Sponsorship Section */}
        <div className="mb-16">
          <div className="bg-gradient-to-br from-blue/10 via-blue/5 to-red/10 rounded-xl p-8 text-center">
            <h2 className="text-3xl font-bold text-neutral-dark mb-6">Custom Sponsorship Packages</h2>
            <p className="text-xl text-neutral-dark/80 mb-8 max-w-3xl mx-auto leading-relaxed">
              Have specific goals or requirements? We're happy to work with you to create a custom sponsorship package
              that aligns with your objectives and maximizes your investment.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/80 rounded-lg p-6">
                <h3 className="font-semibold text-neutral-dark mb-2">Event Sponsorship</h3>
                <p className="text-neutral-dark/70 text-sm">Sponsor specific events, conferences, or educational programs</p>
              </div>
              <div className="bg-white/80 rounded-lg p-6">
                <h3 className="font-semibold text-neutral-dark mb-2">Scholarship Funding</h3>
                <p className="text-neutral-dark/70 text-sm">Support medical education through dedicated scholarship programs</p>
              </div>
              <div className="bg-white/80 rounded-lg p-6">
                <h3 className="font-semibold text-neutral-dark mb-2">Research Support</h3>
                <p className="text-neutral-dark/70 text-sm">Fund research initiatives and medical advancement projects</p>
              </div>
            </div>
            <button
              onClick={handleSponsorshipInquiry}
              className="bg-red text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-red/90 transition-colors duration-300 shadow-lg hover:shadow-xl"
            >
              Discuss Custom Partnership
            </button>
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-neutral-dark mb-6">Other Questions About Sponsoring?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleSponsorshipInquiry}
              className="bg-red text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-red/90 transition-colors duration-300 shadow-lg hover:shadow-xl"
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>

      {/* Sponsor Form Modal */}
      {showSponsorForm && selectedTier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-dark">Sponsor Information</h3>
                  <p className="text-neutral-dark/70 mt-1">
                    {selectedTier.name} Sponsorship - {selectedTier.amount}
                  </p>
                </div>
                <button
                  onClick={() => setShowSponsorForm(false)}
                  className="text-neutral-dark/50 hover:text-neutral-dark transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Benefits Summary */}
              <div className="bg-gradient-to-br from-blue/10 to-red/10 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-neutral-dark mb-2">Your sponsorship includes:</h4>
                <ul className="space-y-1">
                  {selectedTier.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-neutral-dark/80">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSponsorCheckout(); }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-dark mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={sponsorForm.name}
                      onChange={handleSponsorFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${formErrors.name ? 'border-red-300' : 'border-neutral-light'
                        }`}
                      placeholder="Enter your full name"
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-dark mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={sponsorForm.email}
                      onChange={handleSponsorFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${formErrors.email ? 'border-red-300' : 'border-neutral-light'
                        }`}
                      placeholder="Enter your email address"
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company */}
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-neutral-dark mb-2">
                      Company/Organization *
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={sponsorForm.company}
                      onChange={handleSponsorFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${formErrors.company ? 'border-red-300' : 'border-neutral-light'
                        }`}
                      placeholder="Enter company or organization name"
                    />
                    {formErrors.company && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.company}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-neutral-dark mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={sponsorForm.phone}
                      onChange={handleSponsorFormChange}
                      className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors"
                      placeholder="Enter your phone number (optional)"
                    />
                  </div>
                </div>

                {/* Custom Amount Field - Only show for Custom Amount tier */}
                {selectedTier?.name === 'Custom Amount' && (
                  <div>
                    <label htmlFor="customAmount" className="block text-sm font-medium text-neutral-dark mb-2">
                      Custom Sponsorship Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-dark">$</span>
                      <input
                        type="number"
                        id="customAmount"
                        name="customAmount"
                        min="1"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors ${formErrors.customAmount ? 'border-red-300' : 'border-neutral-light'
                          }`}
                        placeholder="0.00"
                      />
                    </div>
                    {formErrors.customAmount && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.customAmount}</p>
                    )}
                    <p className="mt-1 text-xs text-neutral-dark/60">
                      Enter your desired sponsorship amount (minimum $1.00)
                    </p>
                  </div>
                )}

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-neutral-dark mb-2">
                    Additional Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={sponsorForm.message}
                    onChange={handleSponsorFormChange}
                    className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red transition-colors"
                    placeholder="Any additional information or special requests (optional)"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSponsorForm(false)}
                    className="flex-1 py-3 px-6 border border-neutral-light text-neutral-dark rounded-lg font-semibold hover:bg-neutral-light/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={checkoutLoading !== null}
                    className="flex-1 py-3 px-6 bg-red text-white rounded-lg font-semibold hover:bg-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading !== null ? 'Processing...' :
                      selectedTier?.name === 'Custom Amount' && customAmount ?
                        `Proceed to Payment - $${parseFloat(customAmount).toFixed(2)}` :
                        `Proceed to Payment - ${selectedTier?.amount}`
                    }
                  </button>
                </div>

                <p className="text-xs text-neutral-dark/60 text-center pt-2">
                  You will be redirected to Stripe for secure payment processing. Receipt and tax documentation will be sent to your email address.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
