// js/firebase-config.js - Firebase connection module
// Connected to live project: the-witch-cave

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnhAZpqEYqdLtOz3ZpmDFtf0y3eNiIPqE",
  authDomain: "the-witch-cave.firebaseapp.com",
  projectId: "the-witch-cave",
  storageBucket: "the-witch-cave.firebasestorage.app",
  messagingSenderId: "563745056227",
  appId: "1:563745056227:web:c1853c0fc26db316ecacd6",
  measurementId: "G-YTWM2M40CY"
};

// Check if user has stored custom credentials in browser LocalStorage
export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem("HEXLEY_FIREBASE_CONFIG");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.projectId && !parsed.projectId.includes("YOUR_")) {
        return { config: parsed, isCustom: true };
      }
    }
  } catch (err) {
    console.warn("Could not read local Firebase config:", err);
  }
  return { config: DEFAULT_FIREBASE_CONFIG, isCustom: false };
}

export function saveActiveFirebaseConfig(newConfig) {
  localStorage.setItem("HEXLEY_FIREBASE_CONFIG", JSON.stringify(newConfig));
}

export function clearActiveFirebaseConfig() {
  localStorage.removeItem("HEXLEY_FIREBASE_CONFIG");
}

export function isConfigPlaceholder(config) {
  return (
    !config ||
    !config.apiKey ||
    config.apiKey.includes("YOUR_") ||
    !config.projectId ||
    config.projectId.includes("YOUR_")
  );
}
