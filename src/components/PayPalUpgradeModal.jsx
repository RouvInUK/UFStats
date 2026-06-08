import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Star, Sparkles, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserTier } from '../supabaseClient';

const PayPalUpgradeModal = ({ isOpen, onClose }) => {
  const { user, profile, fetchProfile } = useAuth();
  const [selectedTier, setSelectedTier] = useState('PRO'); // 'PRO' or 'PRO+'
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const paypalContainerRef = useRef(null);
  const buttonsInstanceRef = useRef(null);

  // PayPal Sandbox Plan IDs (Customizable via environment variables)
  const MONTHLY_PLAN_ID = import.meta.env.VITE_PAYPAL_MONTHLY_PLAN_ID || 'P-5GBP-MONTHLY';
  const YEARLY_PLAN_ID = import.meta.env.VITE_PAYPAL_YEARLY_PLAN_ID || 'P-50GBP-YEARLY';
  const PLUS_MONTHLY_PLAN_ID = import.meta.env.VITE_PAYPAL_PLUS_MONTHLY_PLAN_ID || 'P-7GBP-PLUS-MONTHLY';
  const PLUS_YEARLY_PLAN_ID = import.meta.env.VITE_PAYPAL_PLUS_YEARLY_PLAN_ID || 'P-70GBP-PLUS-YEARLY';
  const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb'; // Default to sandbox 'sb'

  useEffect(() => {
    if (isOpen) {
      if (!import.meta.env.VITE_PAYPAL_PLUS_MONTHLY_PLAN_ID || !import.meta.env.VITE_PAYPAL_PLUS_YEARLY_PLAN_ID) {
        console.warn(
          "PayPal Developer Notice: VITE_PAYPAL_PLUS_MONTHLY_PLAN_ID and VITE_PAYPAL_PLUS_YEARLY_PLAN_ID are not set in your .env configuration. " +
          "Vite is falling back to default mock Plan IDs ('P-7GBP-PLUS-MONTHLY' and 'P-70GBP-PLUS-YEARLY'). " +
          "To test successfully in sandbox, please create subscription products in your PayPal Developer Sandbox Dashboard (£7/mo and £70/yr) and add their plan IDs to your .env / .env.local files."
        );
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset states on reopen
    setPaymentSuccess(false);
    setError(null);
    setLoading(false);

    // Dynamically load PayPal Script
    const scriptId = 'paypal-jssdk';
    let script = document.getElementById(scriptId);

    const initButtons = () => {
      setSdkLoaded(true);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription&currency=GBP`;
      script.async = true;
      script.onload = initButtons;
      script.onerror = () => setError('Failed to load payment portal. Please check your network.');
      document.body.appendChild(script);
    } else if (window.paypal) {
      initButtons();
    }

    return () => {
      // Cleanup button instance if it exists
      if (buttonsInstanceRef.current) {
        try {
          buttonsInstanceRef.current.close();
        } catch (e) {
          console.warn('Error closing PayPal buttons instance:', e);
        }
        buttonsInstanceRef.current = null;
      }
    };
  }, [isOpen, CLIENT_ID]);

  // Re-render buttons when SDK is loaded, container exists, or tier/billing cycle swaps
  useEffect(() => {
    if (!sdkLoaded || !paypalContainerRef.current || !window.paypal || paymentSuccess) return;

    // Close any prior buttons to avoid duplicate instances
    if (buttonsInstanceRef.current) {
      try {
        buttonsInstanceRef.current.close();
      } catch (e) {
        console.warn('Error during hot-reload of buttons:', e);
      }
      buttonsInstanceRef.current = null;
    }

    const activePlanId = selectedTier === 'PRO+'
      ? (billingCycle === 'monthly' ? PLUS_MONTHLY_PLAN_ID : PLUS_YEARLY_PLAN_ID)
      : (billingCycle === 'monthly' ? MONTHLY_PLAN_ID : YEARLY_PLAN_ID);

    // Clear container
    paypalContainerRef.current.innerHTML = '';

    try {
      buttonsInstanceRef.current = window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'blue',
          layout: 'vertical',
          label: 'subscribe',
          tagline: false
        },
        createSubscription: (data, actions) => {
          return actions.subscription.create({
            plan_id: activePlanId,
            custom_id: user?.id // Pass User ID so webhook can auto-verify and activate
          });
        },
        onApprove: async (data, actions) => {
          setLoading(true);
          try {
            // Securely activate tier on the client for immediate visual feedback
            // Webhooks will enforce recurring updates on the backend securely
            await updateUserTier(user.id, selectedTier);
            if (fetchProfile) {
              await fetchProfile(user.id);
            }
            setPaymentSuccess(true);
          } catch (err) {
            console.error('Tier upgrade failed:', err);
            setError('Payment was authorized but we could not update your tier. Please contact support@ustats.pro.');
          } finally {
            setLoading(false);
          }
        },
        onError: (err) => {
          console.error('PayPal Error:', err);
          setError('An error occurred during transaction processing. Please try again.');
        }
      });

      buttonsInstanceRef.current.render(paypalContainerRef.current);
    } catch (e) {
      console.error('Error rendering PayPal buttons:', e);
      setError('Could not initialize payment buttons. Check your Sandbox client configuration.');
    }
  }, [sdkLoaded, selectedTier, billingCycle, paymentSuccess, MONTHLY_PLAN_ID, YEARLY_PLAN_ID, PLUS_MONTHLY_PLAN_ID, PLUS_YEARLY_PLAN_ID, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center px-4 pt-10 pb-20 sm:p-6 sm:items-center">
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/50 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh] transform transition-all text-slate-100">
        
        {/* Decorative Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
            <h2 className="text-lg font-black text-white uppercase tracking-widest">Upgrade to Pro</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {paymentSuccess ? (
            /* Success Celebration state */
            <div className="text-center py-8 space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-tr from-indigo-400 to-purple-650 rounded-full flex items-center justify-center border-2 border-indigo-300 shadow-xl animate-[bounce_1s_infinite]">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-wider">
                  Welcome to {selectedTier === 'PRO+' ? 'Coach Pro+' : 'Coach Pro'}!
                </h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                  {selectedTier === 'PRO+' 
                    ? 'Your payment was completed successfully. Unlimited Clubs/Teams, Trainings Desk, and all advanced sidelines intelligence are unlocked!'
                    : 'Your payment was completed successfully. All advanced sidelines intelligence, NIS stats, and 1 Club / 5 Teams capacity are unlocked!'}
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2 text-xs text-left max-w-xs mx-auto text-slate-400">
                <div className="flex items-center gap-2 font-bold text-white uppercase">
                  <Check className="w-4 h-4 text-emerald-400" /> Active Membership
                </div>
                <div>Account: <span className="font-mono text-slate-200">{user?.email}</span></div>
                <div>Tier: <span className="font-bold text-indigo-400">{selectedTier === 'PRO+' ? 'Coach Pro+' : 'Coach Pro'}</span></div>
                <div>Billing Period: <span className="capitalize text-slate-200">{billingCycle} recurring</span></div>
              </div>

              <button 
                onClick={onClose}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-600/30 uppercase tracking-widest text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            /* Billing and PayPal flow */
            <>
              {/* Tier Selection Toggles */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Plan:</h4>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 border border-slate-850 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedTier('PRO')}
                    className={`py-2 px-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${selectedTier === 'PRO' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Coach Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTier('PRO+')}
                    className={`py-2 px-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${selectedTier === 'PRO+' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Coach Pro+
                    <span className="text-[8px] bg-indigo-500/30 text-indigo-200 border border-indigo-500/20 px-1 py-0.5 rounded-md">Plus</span>
                  </button>
                </div>
              </div>

              {/* Product Card */}
              <div className="bg-gradient-to-br from-indigo-950/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {selectedTier === 'PRO+' ? 'Ultimate Sideline' : 'Sideline Elite'}
                      </span>
                      <h3 className="text-xl font-black text-white mt-1 uppercase tracking-wide">
                        {selectedTier === 'PRO+' ? 'Coach Pro+' : 'Coach Pro'}
                      </h3>
                    </div>
                    <div className="text-right">
                      {billingCycle === 'monthly' ? (
                        <div>
                          <span className="text-3xl font-black text-white">
                            {selectedTier === 'PRO+' ? '£7' : '£5'}
                          </span>
                          <span className="text-slate-400 text-xs font-semibold">/mo</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-3xl font-black text-white">
                            {selectedTier === 'PRO+' ? '£70' : '£50'}
                          </span>
                          <span className="text-slate-400 text-xs font-semibold">/yr</span>
                          <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Save ~17%</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billing Cycle Toggle Switch */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`py-2 px-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${billingCycle === 'monthly' ? 'bg-indigo-650 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`py-2 px-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-indigo-650 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Yearly
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded-md">Save</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Benefits list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Included Features:</h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-medium text-slate-300">
                  {selectedTier === 'PRO+' ? (
                    <>
                      <BenefitItem text="Unlimited Clubs & Teams (Free tier: 1 Club / 2 Teams)" />
                      <BenefitItem text="Trainings Desk & Custom Drills planner (Full Access)" />
                      <BenefitItem text="Advanced NIS (Net Impact Score) player metrics" />
                      <BenefitItem text="Sideline Pull Quality tracking & grading dashboard" />
                      <BenefitItem text="Dynamic Lineup resolution & majority attribution" />
                      <BenefitItem text="Export stats directly to premium Coach Pro PDFs" />
                    </>
                  ) : (
                    <>
                      <BenefitItem text="Up to 5 Teams (Free tier: 2 Teams)" />
                      <BenefitItem text="Advanced NIS (Net Impact Score) player metrics" />
                      <BenefitItem text="Sideline Pull Quality tracking & grading dashboard" />
                      <BenefitItem text="Dynamic Lineup resolution & majority attribution" />
                      <BenefitItem text="Export stats directly to premium Coach Pro PDFs" />
                    </>
                  )}
                </div>
              </div>

              {/* Secure note */}
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold justify-center pt-2">
                <Shield className="w-3.5 h-3.5 text-slate-600" />
                <span>SSL Encrypted • Secure Sandbox Payments via PayPal</span>
              </div>

              {/* PayPal Buttons Placement */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-bold text-rose-400 text-center">
                    {error}
                  </div>
                )}
                
                {loading && (
                  <div className="flex flex-col items-center justify-center p-6 space-y-3 text-indigo-400 font-bold tracking-widest text-xs uppercase animate-pulse">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>Processing tier unlock...</span>
                  </div>
                )}

                <div 
                  className={`min-h-[150px] transition-opacity duration-300 ${!sdkLoaded || loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
                >
                  {!sdkLoaded && (
                    <div className="flex items-center justify-center p-12 text-slate-500 font-bold text-xs uppercase tracking-widest gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading PayPal portal...
                    </div>
                  )}
                  <div ref={paypalContainerRef} id="paypal-button-container"></div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

const BenefitItem = ({ text }) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
      <Check className="w-2.5 h-2.5 text-emerald-400" />
    </div>
    <span className="leading-relaxed">{text}</span>
  </div>
);

export default PayPalUpgradeModal;
