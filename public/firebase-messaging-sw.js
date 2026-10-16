// @ts-nocheck
/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

// Firebase Web App identifiers are intentionally public. Keep this block in
// sync with lib/firebase-project-config.js. scripts/firebase-project-preflight.mjs
// verifies the project identity before dev/build/release checks.
firebase.initializeApp({
  apiKey: "AIzaSyB4RFSXLk4YAR2babx5z3ssP0E4msQ-rPE",
  authDomain: "spotly-africa.firebaseapp.com",
  projectId: "spotly-africa",
  storageBucket: "spotly-africa.firebasestorage.app",
  messagingSenderId: "14197555543",
  appId: "1:14197555543:web:189486e7d4a23114c3be12"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Spotly";
  const options = {
    body: payload.notification?.body || payload.data?.body || "You have a new update.",
    icon: "/icons/spotly-192.png",
    badge: "/icons/spotly-192.png",
    data: { href: payload.data?.href || "/account" },
    tag: payload.data?.category || "spotly-notification"
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = new URL(event.notification.data?.href || "/account", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === href);
    if (existing) return existing.focus();
    return clients.openWindow(href);
  }));
});
