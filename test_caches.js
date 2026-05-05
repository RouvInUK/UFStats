try {
  caches.open('test');
} catch (e) {
  console.error("Error:", e.message);
}
