/* 家計簿 2026 — アプリ本体だけをキャッシュ。Supabase への通信は常にネットワーク */
const CACHE = "kakeibo-v2";
const SHELL = ["./index.html","./manifest.json","./icon-192.png","./icon-512.png","./icon-512-maskable.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // 書き込みは素通し
  const url = new URL(req.url);
  if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/auth/v1/")
      || url.pathname.includes("/realtime/")) return;      // Supabase API は触らない
  if (url.origin !== self.location.origin) return;         // 外部CDNも触らない

  // アプリ本体(HTML)はネットワーク優先。更新をその場で受け取り、オフライン時だけキャッシュに落ちる。
  const isDoc = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if (isDoc) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", cp)); }
        return res;
      }).catch(() => caches.match("./index.html").then(hit => hit || caches.match(req)))
    );
    return;
  }

  // アイコン・manifest はキャッシュ優先のまま
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
