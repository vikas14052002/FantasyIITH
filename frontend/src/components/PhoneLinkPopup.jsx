import { useState, useRef } from 'react';
import { linkPhone, getUser } from '../lib/auth';
import { sendOTP, verifyOTP } from '../lib/firebase';
import './PhoneLinkPopup.css';

export default function PhoneLinkPopup({ onComplete }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmationRef = useRef(null);
  const user = getUser();

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) { setError('Enter a valid 10-digit number'); return; }
    setLoading(true);
    setError('');
    try {
      const confirmation = await sendOTP(phone);
      confirmationRef.current = confirmation;
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length < 6) { setError('Enter 6-digit OTP'); return; }
    setLoading(true);
    setError('');
    try {
      await verifyOTP(confirmationRef.current, otp);
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await linkPhone(user.id, fullPhone);
      onComplete();
    } catch (err) {
      setError(err.code === 'auth/invalid-verification-code' ? 'Invalid OTP' : (err.message || 'Failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plp-overlay">
      <div className="plp-modal">
        <div className="plp-title">Verify Your Number</div>
        <p className="plp-subtitle">
          Hi <strong>{user?.name}</strong>, we've upgraded to phone login. Verify your number to continue playing.
        </p>

        {step === 'phone' ? (
          <>
            <div className="plp-phone-wrap">
              <span className="plp-country">+91</span>
              <input
                className="input plp-phone-input"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                autoFocus
              />
            </div>
            {error && <p className="plp-error">{error}</p>}
            <button className="btn btn-primary" onClick={handleSendOTP} disabled={phone.length < 10 || loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <div id="link-recaptcha"></div>
          </>
        ) : (
          <>
            <p className="plp-otp-info">OTP sent to +91 {phone}</p>
            <input
              className="input plp-otp-input"
              type="tel"
              placeholder="Enter OTP"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
            />
            {error && <p className="plp-error">{error}</p>}
            <button className="btn btn-primary" onClick={handleVerify} disabled={otp.length < 6 || loading}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button className="plp-change" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
              Change number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
