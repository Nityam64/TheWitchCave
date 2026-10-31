// js/firebase-config.js - Firebase connection module
// When running in Demo/Offline mode, clearly informs the app.
// If valid config is provided, initializes Firebase App and Firestore.

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "hexleys-potion-pantry.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "hexleys-potion-pantry.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if user has stored custom credentials in browser LocalStorage
export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem("HEXLEY_FIREBASE_CONFIG");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.projectId && parsed.projectId !== "YOUR_PROJECT_ID") {
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

