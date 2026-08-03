/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDVq07eOLK7fLt5200h4m7dFhFM_csQF3o",
  authDomain: "denzeltinashe-spotly.firebaseapp.com",
  projectId: "denzeltinashe-spotly",
  storageBucket: "denzeltinashe-spotly.firebasestorage.app",
  messagingSenderId: "815870787939",
  appId: "1:815870787939:web:6154be469fb3f076f5d356"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Spotly";
  const options = {
    body: payload.notification?.body || payload.data?.body || "You have a new update.",
    icon: "/brand/spotly.png",
    badge: "/brand/spotly.png",
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
