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

export function isAndroidBrowser() {
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua);
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
  const publicIp = await fetchPublicIpData();
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
    connection
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

function asDisplayText(value) {
  if (value === null || value === undefined) {
    return "없음";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "없음";
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return String(value);
    }
    return "없음";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function formatArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "없음";
  }

  const normalized = values
    .map((value) => asDisplayText(value))
    .filter((value) => value !== "없음");
  if (normalized.length === 0) {
    return "없음";
  }
  return normalized.join(", ");
}

function formatLocation(country, region, city) {
  const parts = [country, region, city]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  if (parts.length === 0) {
    return "없음";
  }
  return parts.join(" / ");
}

function formatSize(width, height) {
  const parsedWidth = Number.parseInt(String(width ?? ""), 10);
  const parsedHeight = Number.parseInt(String(height ?? ""), 10);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
    return "없음";
  }
  return `${parsedWidth} x ${parsedHeight}`;
}

function formatOptionalNumber(value, suffix = "") {
  if (value === null || value === undefined) {
    return "없음";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "없음";
  }

  const baseValue = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
  return suffix ? `${baseValue}${suffix}` : baseValue;
}

function formatOnline(value) {
  if (value === null || value === undefined) {
    return "없음";
  }
  return value ? "온라인" : "오프라인";
}

function formatConnection(connection) {
  if (!connection || typeof connection !== "object") {
    return "없음";
  }

  const parts = [
    connection.type ? `type=${connection.type}` : null,
    connection.effectiveType ? `effective=${connection.effectiveType}` : null,
    connection.downlinkMbps !== null && connection.downlinkMbps !== undefined
      ? `downlink=${connection.downlinkMbps}Mbps`
      : null,
    connection.rttMs !== null && connection.rttMs !== undefined
      ? `rtt=${connection.rttMs}ms`
      : null,
    connection.saveData !== null && connection.saveData !== undefined
      ? `saveData=${connection.saveData}`
      : null
  ].filter(Boolean);

  if (parts.length === 0) {
    return "없음";
  }
  return parts.join(" / ");
}

function formatQueryParams(queryParams) {
  if (!queryParams || typeof queryParams !== "object") {
    return "없음";
  }

  const keys = Object.keys(queryParams).sort();
  if (keys.length === 0) {
    return "없음";
  }

  const pairs = keys.map((key) => {
    const value = queryParams[key];
    if (Array.isArray(value)) {
      return `${key}=${value.join(", ")}`;
    }
    if (value === null || value === undefined) {
      return `${key}=`;
    }
    return `${key}=${value}`;
  });
  return pairs.join(" | ");
}

function formatUtcOffset(offsetMinutes) {
  if (offsetMinutes === null || offsetMinutes === undefined) {
    return "없음";
  }
  const parsed = Number(offsetMinutes);
  if (!Number.isFinite(parsed)) {
    return "없음";
  }

  const absoluteMinutes = Math.abs(parsed);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  const sign = parsed <= 0 ? "+" : "-";
  return `UTC${sign}${hours}:${minutes}`;
}

export function buildHumanReadablePayload(payload, docId = null) {
  const normalizedPayload = formatPayloadForDisplay(payload, docId);
  const sourcePage = normalizedPayload.sourcePage ?? {};
  const businessParams = normalizedPayload.businessParams ?? {};
  const matchSignals = normalizedPayload.matchSignals ?? {};
  const publicIp = matchSignals.publicIp ?? {};
  const comparableSignals = matchSignals.comparableSignals ?? {};
  const connection = comparableSignals.connection ?? {};

  const rawTextValue = businessParams.text ?? sourcePage.linkColor ?? null;
  const panelText = rawTextValue ? String(rawTextValue).toUpperCase() : "-";
  const panelNumberInt = Number.parseInt(String(businessParams.number ?? ""), 10);
  const panelNumber = Number.isFinite(panelNumberInt) ? String(panelNumberInt) : "-";

  const sections = [
    {
      title: "전달 파라미터",
      rows: [
        { label: "text", value: asDisplayText(businessParams.text) },
        { label: "number", value: asDisplayText(businessParams.number) },
        { label: "referrerRaw", value: asDisplayText(businessParams.referrerRaw) },
        { label: "queryParams", value: formatQueryParams(businessParams.queryParams) }
      ]
    },
    {
      title: "Firestore 저장 정보",
      rows: [
        {
          label: "docId",
          value: asDisplayText(normalizedPayload.firestoreWriteResult?.docId ?? null)
        },
        { label: "eventType", value: asDisplayText(normalizedPayload.eventType) },
        { label: "createdAtClientIso", value: asDisplayText(normalizedPayload.createdAtClientIso) },
        { label: "createdAtServer", value: asDisplayText(normalizedPayload.createdAtServer) },
        { label: "source.href", value: asDisplayText(sourcePage.href) },
        { label: "source.path", value: asDisplayText(sourcePage.path) },
        { label: "source.linkColor", value: asDisplayText(sourcePage.linkColor) }
      ]
    },
    {
      title: "사용자 유추 데이터셋 (웹 수집)",
      rows: [
        { label: "공인 IP", value: asDisplayText(publicIp.ip) },
        { label: "국가/지역/도시", value: formatLocation(publicIp.country, publicIp.region, publicIp.city) },
        { label: "웹-IP 시간대", value: asDisplayText(publicIp.timezone) },
        { label: "브라우저 시간대", value: asDisplayText(comparableSignals.timezone) },
        { label: "UTC 오프셋", value: formatUtcOffset(comparableSignals.utcOffsetMinutes) },
        { label: "로케일", value: asDisplayText(comparableSignals.locale) },
        { label: "기본 언어", value: asDisplayText(comparableSignals.language) },
        { label: "언어 목록", value: formatArray(comparableSignals.languages) },
        { label: "플랫폼", value: asDisplayText(comparableSignals.platform) },
        { label: "터치 포인트", value: formatOptionalNumber(comparableSignals.maxTouchPoints) },
        { label: "CPU 코어 수", value: formatOptionalNumber(comparableSignals.hardwareConcurrency) },
        { label: "메모리", value: formatOptionalNumber(comparableSignals.deviceMemoryGb, " GB") },
        { label: "화면 해상도(px)", value: formatSize(comparableSignals.screenWidth, comparableSignals.screenHeight) },
        { label: "뷰포트(px)", value: formatSize(comparableSignals.viewportWidth, comparableSignals.viewportHeight) },
        { label: "DPR", value: formatOptionalNumber(comparableSignals.devicePixelRatio) },
        { label: "색 깊이(colorDepth)", value: formatOptionalNumber(comparableSignals.colorDepth) },
        { label: "온라인 상태", value: formatOnline(comparableSignals.online) },
        { label: "네트워크 정보", value: formatConnection(connection) },
        { label: "비교용 해시", value: asDisplayText(matchSignals.comparableSignalHash) }
      ]
    },
    {
      title: "IP 부가정보",
      rows: [
        { label: "ASN", value: asDisplayText(publicIp.asn) },
        { label: "통신사/조직", value: asDisplayText(publicIp.organization) },
        { label: "IP 조회 출처", value: formatArray(publicIp.sources) },
        { label: "IP 조회 에러", value: formatArray(publicIp.errors) }
      ]
    }
  ];

  return {
    panel: {
      text: panelText,
      number: panelNumber
    },
    sections
  };
}
