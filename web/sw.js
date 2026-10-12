/* StudyWell service worker. Every runtime asset is stored in this repository. */
const CACHE_NAME = "studywell-static-v4";
const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/storage.js",
    "./js/app.js",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];
self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
    self.skipWaiting();
});
self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames
        .filter((name) => name.startsWith("studywell-static-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET")
        return;
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin)
        return;
    // HTML navigations prefer the network so a new release can become available.
    if (event.request.mode === "navigate") {
        event.respondWith(fetch(event.request)
            .then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
            }
            return response;
        })
            .catch(async () => (await caches.match("./index.html")) || Response.error()));
        return;
    }
    event.respondWith(fetch(event.request).then((response) => {
        if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
    }).catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse)
            return cachedResponse;
        return new Response("This resource is not available offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
    }));
});
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        const existingClient = clients.find((client) => "focus" in client);
        if (existingClient)
            return existingClient.focus();
        return self.clients.openWindow("./index.html#home");
    }));
});
