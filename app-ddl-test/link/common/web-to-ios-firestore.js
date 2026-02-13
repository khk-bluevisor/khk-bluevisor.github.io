import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqHO45J_aIcm6EyyNEpTyOsFeMJRxJvcc",
  authDomain: "app-ddl-test-matcher.firebaseapp.com",
  projectId: "app-ddl-test-matcher",
  storageBucket: "app-ddl-test-matcher.firebasestorage.app",
  messagingSenderId: "966948670822",
  appId: "1:966948670822:web:11cded19bd579e71d98ca7",
  measurementId: "G-M8MGR1FFYX"
};

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);
const collectionName = "web-to-ios";

export function isIOSBrowser() {
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  const isIPadDesktopUA = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  return isAppleMobile || isIPadDesktopUA;
}

export function sanitizeNumber(value, fallbackValue = "1") {
  const fallbackNumber = Number.parseInt(fallbackValue ?? "1", 10);
  const fallback = Number.isNaN(fallbackNumber) ? 1 : fallbackNumber;
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 10) {
    return String(fallback);
  }
  return String(parsed);
}

function toQueryValueMap(query) {
  const entries = {};
  const keys = Array.from(new Set(query.keys())).sort();
  keys.forEach((key) => {
    const values = query.getAll(key);
    entries[key] = values.length <= 1 ? (values[0] ?? "") : values;
  });
  return entries;
}

export function extractBusinessParams(defaults) {
  const query = new URLSearchParams(window.location.search);
  const text = (query.get("text") || defaults.text || "").trim() || defaults.text;
  const number = sanitizeNumber(query.get("number") || defaults.number || "1");
  const queryParams = toQueryValueMap(query);

  return {
    text,
    number,
    referrerRaw: `text=${text}&number=${number}`,
    queryParams
  };
}

function getConnectionInfo() {
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) {
    return null;
  }

  return {
    effectiveType: connection.effectiveType ?? null,
    downlinkMbps: connection.downlink ?? null,
    rttMs: connection.rtt ?? null,
    saveData: connection.saveData ?? null,
    type: connection.type ?? null
  };
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timerId);
  }
}

async function fetchPublicIpData() {
  const result = {
    ip: null,
    country: null,
    region: null,
    city: null,
    timezone: null,
    asn: null,
    organization: null,
    sources: [],
    errors: []
  };

  try {
    const ipify = await fetchJsonWithTimeout("https://api64.ipify.org?format=json", 3500);
    if (typeof ipify?.ip === "string" && ipify.ip.length > 0) {
      result.ip = ipify.ip;
      result.sources.push("api64.ipify.org");
    }
  } catch (error) {
    result.errors.push("api64.ipify.org 조회 실패");
  }

  try {
    const ipapi = await fetchJsonWithTimeout("https://ipapi.co/json/", 4000);
    if (typeof ipapi?.ip === "string" && ipapi.ip.length > 0) {
      result.ip = result.ip || ipapi.ip;
      result.sources.push("ipapi.co");
    }
    result.country = ipapi?.country_name ?? null;
    result.region = ipapi?.region ?? null;
    result.city = ipapi?.city ?? null;
    result.timezone = ipapi?.timezone ?? null;
    result.asn = ipapi?.asn ?? null;
    result.organization = ipapi?.org ?? null;
  } catch (error) {
    result.errors.push("ipapi.co 조회 실패");
  }

  return result;
}

async function getPermissionStates() {
  if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
    return null;
  }

  const permissionNames = ["geolocation", "notifications", "camera"];
  const states = {};

  await Promise.all(
    permissionNames.map(async (permissionName) => {
      try {
        const status = await navigator.permissions.query({ name: permissionName });
        states[permissionName] = status.state;
      } catch (error) {
        states[permissionName] = "unsupported";
      }
    })
  );

  return states;
}

async function sha256Hex(value) {
  if (!window.crypto || !window.crypto.subtle) {
    return null;
  }

  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function collectComparableSignals() {
  const now = new Date();
  const localeInfo = Intl.DateTimeFormat().resolvedOptions();
  const [publicIp, permissions] = await Promise.all([
    fetchPublicIpData(),
    getPermissionStates()
  ]);
  const connection = getConnectionInfo();

  const comparableSignals = {
    timezone: localeInfo.timeZone ?? null,
    locale: localeInfo.locale ?? null,
    calendar: localeInfo.calendar ?? null,
    numberingSystem: localeInfo.numberingSystem ?? null,
    utcOffsetMinutes: now.getTimezoneOffset(),
    language: navigator.language ?? null,
    languages: navigator.languages ?? null,
    platform: navigator.platform ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGb: navigator.deviceMemory ?? null,
    screenWidth: screen.width ?? null,
    screenHeight: screen.height ?? null,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio ?? null,
    colorDepth: screen.colorDepth ?? null,
    online: navigator.onLine,
    connection,
    permissions
  };

  const comparableSignalSource = [
    publicIp.ip ?? "",
    comparableSignals.timezone ?? "",
    String(comparableSignals.utcOffsetMinutes ?? ""),
    comparableSignals.locale ?? "",
    comparableSignals.language ?? "",
    JSON.stringify(comparableSignals.languages ?? []),
    comparableSignals.platform ?? "",
    String(comparableSignals.maxTouchPoints ?? ""),
    String(comparableSignals.hardwareConcurrency ?? ""),
    String(comparableSignals.screenWidth ?? ""),
    String(comparableSignals.screenHeight ?? ""),
    String(comparableSignals.devicePixelRatio ?? ""),
    comparableSignals.connection?.effectiveType ?? "",
    comparableSignals.connection?.type ?? ""
  ].join("|");
  const comparableSignalHash = await sha256Hex(comparableSignalSource);

  return {
    publicIp,
    comparableSignals,
    comparableSignalHash
  };
}

async function buildPayload({ linkColor, businessParams }) {
  const signalData = await collectComparableSignals();
  const basePayload = {
    eventType: "ios_web_to_app_match_candidate",
    createdAtClientIso: new Date().toISOString(),
    sourcePage: {
      href: window.location.href,
      host: window.location.host,
      path: window.location.pathname,
      linkColor: linkColor || null
    },
    businessParams: {
      text: businessParams.text,
      number: Number.parseInt(businessParams.number, 10),
      referrerRaw: businessParams.referrerRaw,
      queryParams: businessParams.queryParams
    },
    matchSignals: {
      publicIp: signalData.publicIp,
      comparableSignals: signalData.comparableSignals,
      comparableSignalHash: signalData.comparableSignalHash
    }
  };

  return {
    payloadForStore: {
      ...basePayload,
      createdAtServer: serverTimestamp()
    },
    payloadForDisplay: {
      ...basePayload,
      createdAtServer: "(Firestore serverTimestamp)"
    }
  };
}

export async function saveWebToIosCandidate({ linkColor, businessParams }) {
  const { payloadForStore, payloadForDisplay } = await buildPayload({
    linkColor,
    businessParams
  });

  try {
    const docRef = await addDoc(collection(firestore, collectionName), payloadForStore);
    return {
      docId: docRef.id,
      payloadForDisplay
    };
  } catch (error) {
    const wrappedError = new Error("Firestore 저장 실패");
    wrappedError.cause = error;
    wrappedError.payloadForDisplay = payloadForDisplay;
    throw wrappedError;
  }
}

export function extractPayloadFromSaveError(error) {
  if (!error || typeof error !== "object") {
    return null;
  }
  return error.payloadForDisplay ?? null;
}

export function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function formatPayloadForDisplay(payload, docId = null) {
  return {
    ...payload,
    firestoreWriteResult: {
      docId: docId ?? null
    }
  };
}
