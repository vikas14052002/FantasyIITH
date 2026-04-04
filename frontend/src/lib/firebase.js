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

function setupRecaptcha(containerId) {
  // Clear old verifier if exists
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch {}
    recaptchaVerifier = null;
  }

  // Ensure container exists
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      recaptchaVerifier = null;
    },
  });

  return recaptchaVerifier;
}

export async function sendOTP(phoneNumber, containerId) {
  const verifier = setupRecaptcha(containerId);
  const fullNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, fullNumber, verifier);
    return confirmationResult;
  } catch (err) {
    // Reset verifier on failure so next attempt gets a fresh one
    recaptchaVerifier = null;
    throw err;
  }
}

export async function verifyOTP(confirmationResult, otp) {
  const result = await confirmationResult.confirm(otp);
  return result.user;
}
