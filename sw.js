const CACHE_NAME = 'lamp-control-v1';
const ASSETS_TO_CACHE = [
'./',
'./index.html',
'./app.js',
'https://cdn.jsdelivr.net/npm/@jaames/iro@5'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
	caches.open(CACHE_NAME).then((cache) => {
	console.log('[Service Worker] Caching layout assets');
	return cache.addAll(ASSETS_TO_CACHE);
	}).then(() => self.skipWaiting())
	);
	});



self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((keys) => {
return Promise.all(
keys.map((key) => {
if(key !==CACHE_NAME) {
	console.log('[Service Worker] FLushing old cache core:', key);
	return caches.delete(key);
	}
})
);
})
);
});

self.addEventListener('push', (event) => {
	let data = { title: 'Lamp Notification', body: 'Lamp timer has been updated!'};
	
	if (event.data) {
		try {
			data = event.data.json();

		} catch (e) {
			data.body = event.data.text();
		}
}

	const options = {
		body: data.body,
		icon: './icon-192.png.png', // Uses your existing lamp PWA icon
		badge: './icon-192.png.png'
		vibrate: [200, 100, 200],
		data: {
			dateOfArrival: Date.now(),
			primaryKey: '1'
		}
};
	event.waitUntil(
		self.registration.showNotification(data, title, options)
	);
});

self.addEventListener('fetch', (event) => {
if(event.request.url.startsWith(self.location.origin) || event.request.url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
	caches.match(event.request).then((cachedResponse) => {
	if(cachedResponse) {
	return cachedResponse;
	}
	return fetch(event.request);
})
);
}
});
