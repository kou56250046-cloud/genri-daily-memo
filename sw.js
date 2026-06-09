// ============================================================
//  訓読トラッカー — Service Worker
//  役割: PWAキャッシュ / バックグラウンド通知チェック
// ============================================================

const CACHE = 'kunidoku-v1';
const CACHE_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './432hz.mp3'];

let swCfg = {};  // SET_CFG メッセージで受け取る設定

// ─── インストール ───
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

// ─── アクティベート ───
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// ─── フェッチ (オフラインキャッシュ) ───
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Firebase / CDN はネットワーク優先
  if (url.includes('firebasejs') || url.includes('googleapis') || url.includes('firebaseio')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ─── メッセージ受信 (メインアプリから設定を受け取る) ───
self.addEventListener('message', e => {
  if (e.data?.type === 'SET_CFG') {
    swCfg = { ...swCfg, ...e.data };
  }
});

// ─── Periodic Background Sync (バックグラウンドリマインダー) ───
self.addEventListener('periodicsync', e => {
  if (e.tag === 'reading-reminder') {
    e.waitUntil(checkAndNotify());
  }
});

// ─── Push通知 (将来のFCM対応用) ───
self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(d.title || '原理講論 訓読', {
      body:  d.body  || '今日の訓読がまだですよ 📖',
      icon:  './icon-192.png',
      badge: './icon-72.png',
      tag:   'reading-reminder',
      data:  { url: './' }
    })
  );
});

// ─── 通知タップ → アプリを開く ───
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

// ============================================================
//  チェック & 通知ロジック
// ============================================================
async function checkAndNotify() {
  const { databaseURL, who, name, remHour, notifOn } = swCfg;
  if (!databaseURL || !who || !notifOn) return;

  // 設定時刻以降かチェック
  const nowHour = new Date().getHours();
  if (nowHour < parseInt(remHour || '7')) return;

  // 今日の日付 (JST)
  const jst   = new Date(Date.now() + 9 * 3600 * 1000);
  const today = jst.toISOString().slice(0, 10);

  try {
    // Firebase REST API で読み取り (認証不要・テストモード)
    const res  = await fetch(`${databaseURL}/readings/${who}/${today}.json`);
    const data = await res.json();

    if (data === null) {
      // まだ読んでいない → 通知
      await self.registration.showNotification('原理講論 訓読', {
        body:     `${name}さん、今日の訓読がまだですよ 📖`,
        icon:     './icon-192.png',
        badge:    './icon-72.png',
        tag:      'reading-reminder',
        renotify: false,
        data:     { url: './' }
      });
    }
  } catch (err) {
    // ネットワークエラー等は無視
    console.warn('[SW] checkAndNotify failed:', err);
  }
}
