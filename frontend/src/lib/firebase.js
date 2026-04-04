import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAzP72Kxk2nOG5BGg3IakxJUUOV_-9tqWE",
  authDomain: "playxi-f62c1.firebaseapp.com",
  projectId: "playxi-f62c1",
  storageBucket: "playxi-f62c1.firebasestorage.app",
  messagingSenderId: "566531447425",
  appId: "1:566531447425:web:3fad7d035e00be7e7d8b80",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

let recaptchaVerifier = null;

function getRecaptcha() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch {}
    recaptchaVerifier = null;
  }

  // Always remove the old element entirely — clearing innerHTML is not enough
  // because grecaptcha holds an internal widget reference to the element.
  const oldEl = document.getElementById('recaptcha-container');
  if (oldEl) oldEl.remove();

  const el = document.createElement('div');
  el.id = 'recaptcha-container';
  document.body.appendChild(el);

  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch {} }
      recaptchaVerifier = null;
    },
  });

  return recaptchaVerifier;
}

export async function sendOTP(phoneNumber) {
  const verifier = getRecaptcha();
  const fullNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
  try {
    const result = await signInWithPhoneNumber(auth, fullNumber, verifier);
    return result;
  } catch (err) {
    // Clear on failure
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch {} }
    recaptchaVerifier = null;
    throw err;
  }
}

export async function verifyOTP(confirmationResult, otp) {
  const result = await confirmationResult.confirm(otp);
  return result.user;
}
