import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithPhone, linkPhoneToExisting } from '../lib/auth';
import { sendOTP, verifyOTP } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';
import './Login.css';

export default function Login() {
  const COUNTRIES = [
    { code: '+91', flag: '🇮🇳', name: 'India', len: 10 },
    { code: '+1', flag: '🇺🇸', name: 'US', len: 10 },
    { code: '+44', flag: '🇬🇧', name: 'UK', len: 10 },
    { code: '+61', flag: '🇦🇺', name: 'Australia', len: 9 },
    { code: '+971', flag: '🇦🇪', name: 'UAE', len: 9 },
    { code: '+65', flag: '🇸🇬', name: 'Singapore', len: 8 },
    { code: '+49', flag: '🇩🇪', name: 'Germany', len: 11 },
    { code: '+81', flag: '🇯🇵', name: 'Japan', len: 10 },
    { code: '+82', flag: '🇰🇷', name: 'S. Korea', len: 10 },
    { code: '+86', flag: '🇨🇳', name: 'China', len: 11 },
    { code: '+966', flag: '🇸🇦', name: 'Saudi', len: 9 },
    { code: '+977', flag: '🇳🇵', name: 'Nepal', len: 10 },
    { code: '+94', flag: '🇱🇰', name: 'Sri Lanka', len: 9 },
    { code: '+880', flag: '🇧🇩', name: 'Bangladesh', len: 10 },
  ];
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showCountry, setShowCountry] = useState(false);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'choose' | 'new' | 'link'
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [oldName, setOldName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const confirmationRef = useRef(null);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  const fullPhone = () => phone.startsWith('+') ? phone : `${country.code}${phone}`;

  function startResendTimer() {
    setResendTimer(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  const handleResendOTP = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    setError('');
    setOtp('');
    try {
      const confirmation = await sendOTP(phone);
      confirmationRef.current = confirmation;
      startResendTimer();
    } catch (err) {
      const msg = err.code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes.'
        : 'Failed to resend. Try again later.';
      setError(msg);
      logError('resend_otp', err, { phone });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) { setError('Enter a valid 10-digit number'); return; }
    setLoading(true);
    setError('');
    try {
      const confirmation = await sendOTP(phone);
      confirmationRef.current = confirmation;
      setStep('otp');
      startResendTimer();
    } catch (err) {
      const msg = err.code === 'auth/too-many-requests' ? 'Too many attempts. Please wait a few minutes and try again.'
        : err.code === 'auth/invalid-phone-number' ? 'Invalid phone number. Check and try again.'
        : err.code === 'auth/captcha-check-failed' ? 'Verification failed. Please refresh and try again.'
        : err.code === 'auth/network-request-failed' ? 'Network error. Check your connection.'
        : 'Something went wrong. Please try again.';
      setError(msg);
      logError('send_otp', err, { phone });
    } finally {
      setLoading(false);
    }
  };

  const doVerify = async (otpCode) => {
    if (!otpCode || otpCode.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyOTP(confirmationRef.current, otpCode);
      // Check if phone already registered
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('phone', fullPhone())
        .maybeSingle();

      if (existing) {
        // Phone already linked — direct login
        await loginWithPhone(fullPhone());
        navigate('/leagues');
      } else {
        // Phone not in DB — ask: new or link existing
        setStep('choose');
      }
    } catch (err) {
      const msg = err.code === 'auth/invalid-verification-code' ? 'Invalid OTP. Please check and try again.'
        : err.code === 'auth/code-expired' ? 'OTP expired. Tap Resend to get a new one.'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes.'
        : err.code === 'auth/network-request-failed' ? 'Network error. Check your connection.'
        : 'Verification failed. Please try again.';
      setError(msg);
      logError('verify_otp', err, { phone });
    } finally {
      setLoading(false);
    }
  };

  const handleNewAccount = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      await loginWithPhone(fullPhone(), name.trim());
      navigate('/leagues');
    } catch (err) {
      setError(err.message || 'Something went wrong');
      logError('new_account', err, { phone, userName: name });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAccount = async (e) => {
    e.preventDefault();
    if (!oldName.trim() || !oldPassword) { setError('Enter both username and password'); return; }
    setLoading(true);
    setError('');
    try {
      await linkPhoneToExisting(oldName.trim(), oldPassword, fullPhone());
      navigate('/leagues');
    } catch (err) {
      setError(err.message || 'Failed to link account');
      logError('link_account', err, { phone, userName: oldName });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-content fade-in">
        <div className="login-logo">
          <span className="login-emoji">🏏</span>
          <h1 className="login-title">Play<span className="login-accent">XI</span></h1>
          <p className="login-subtitle">Fantasy Cricket League</p>
        </div>

        <div className="login-migration-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span>We've upgraded to phone login for better security. Old account? Use "I Have an Existing Account" after OTP verification to link your data.</span>
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendOTP} className="login-form">
            <div className="login-phone-wrap">
              <button type="button" className="login-country" onClick={() => setShowCountry(!showCountry)}>
                <span>{country.flag}</span>
                <span>{country.code}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <input
                className="input login-phone-input"
                type="tel"
                inputMode="numeric"
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, country.len))}
                maxLength={country.len}
                autoFocus
              />
            </div>
            {showCountry && (
              <div className="login-country-list fade-in">
                {COUNTRIES.map(c => (
                  <button key={c.code} type="button" className={`login-country-item ${c.code === country.code ? 'active' : ''}`}
                    onClick={() => { setCountry(c); setShowCountry(false); setPhone(''); }}>
                    <span>{c.flag}</span>
                    <span className="login-country-name">{c.name}</span>
                    <span className="login-country-code">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
            {error && <p className="login-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={phone.length < 10 || loading}>
              {loading ? 'Sending OTP...' : 'GET OTP'}
            </button>
            {import.meta.env.DEV && (
              <button type="button" className="btn btn-outline" style={{ marginTop: 8, fontSize: 11 }}
                onClick={async () => {
                  if (!phone || phone.length < 10) { setError('Enter your phone number first'); return; }
                  setLoading(true);
                  setError('');
                  try {
                    await loginWithPhone(`+91${phone}`);
                    window.location.href = '/leagues';
                  } catch (err) {
                    setError(err.message || 'Dev login failed');
                  } finally {
                    setLoading(false);
                  }
                }}>
                [DEV] Skip OTP
              </button>
            )}
            <div id="recaptcha-container"></div>
            <p className="login-hint">We'll send you an OTP to verify</p>
          </form>
        )}

        {step === 'otp' && (
          <div className="login-form">
            <div className="login-otp-header">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <p className="login-otp-title">Verify your number</p>
              <p className="login-otp-subtitle">We sent a 6-digit code to <strong>{country.code} {phone}</strong></p>
            </div>
            <div className="otp-boxes">
              {[0,1,2,3,4,5].map(i => (
                <input
                  key={i}
                  className={`otp-box ${otp[i] ? 'filled' : ''}`}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] || ''}
                  autoFocus={i === 0}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) {
                      e.target.previousSibling?.focus();
                    }
                  }}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (!val && e.nativeEvent.inputType === 'deleteContentBackward') {
                      const newOtp = otp.slice(0, i) + otp.slice(i + 1);
                      setOtp(newOtp);
                      return;
                    }
                    // Handle paste
                    if (val.length > 1) {
                      const pasted = val.slice(0, 6);
                      setOtp(pasted);
                      if (pasted.length === 6) doVerify(pasted);
                      else document.querySelectorAll('.otp-box')[Math.min(pasted.length, 5)]?.focus();
                      return;
                    }
                    const newOtp = otp.slice(0, i) + val + otp.slice(i + 1);
                    const trimmed = newOtp.slice(0, 6);
                    setOtp(trimmed);
                    if (trimmed.length === 6) doVerify(trimmed);
                    else if (val && i < 5) e.target.nextSibling?.focus();
                  }}
                />
              ))}
            </div>
            {loading && <p className="login-verifying">Verifying...</p>}
            {error && <p className="login-error">{error}</p>}
            <div className="login-resend">
              {resendTimer > 0 ? (
                <span className="login-resend-timer">Resend OTP in {resendTimer}s</span>
              ) : (
                <button type="button" className="login-resend-btn" onClick={handleResendOTP} disabled={loading}>
                  Resend OTP
                </button>
              )}
            </div>
            <button type="button" className="login-back" onClick={() => { setStep('phone'); setOtp(''); setError(''); setResendTimer(0); if(timerRef.current) clearInterval(timerRef.current); }}>
              Change number
            </button>
            <div id="recaptcha-container"></div>
          </div>
        )}

        {step === 'choose' && (
          <div className="login-form">
            <div className="login-verified-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              +91 {phone} verified
            </div>
            <button className="btn btn-primary" onClick={() => { setStep('new'); setError(''); }}>
              Create New Account
            </button>
            <div className="login-or">
              <span>or</span>
            </div>
            <button className="btn btn-outline" onClick={() => { setStep('link'); setError(''); }}>
              I Have an Existing Account
            </button>
          </div>
        )}

        {step === 'new' && (
          <form onSubmit={handleNewAccount} className="login-form">
            <p className="login-otp-info">Welcome! What should we call you?</p>
            <p className="login-warn">This creates a fresh account. If you had an old account, go back and tap "I Have an Existing Account" instead.</p>
            <input
              className="input"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            {error && <p className="login-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : "LET'S GO"}
            </button>
            <button type="button" className="login-back" onClick={() => { setStep('choose'); setError(''); }}>
              Back
            </button>
          </form>
        )}

        {step === 'link' && (
          <form onSubmit={handleLinkAccount} className="login-form">
            <p className="login-otp-info">Enter your old account details to link your phone number</p>
            <input
              className="input"
              type="text"
              placeholder="Old username"
              value={oldName}
              onChange={e => setOldName(e.target.value)}
              autoFocus
            />
            <div className="login-password-wrap">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Old password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
              />
              <button type="button" className="login-toggle-pw" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {error && <p className="login-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={!oldName.trim() || !oldPassword || loading}>
              {loading ? 'Linking...' : 'LINK & LOGIN'}
            </button>
            <button type="button" className="login-back" onClick={() => { setStep('choose'); setError(''); }}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
