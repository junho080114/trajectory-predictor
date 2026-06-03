/** 사진 에셋 프리로드 + 흰/검 배경 제거(1회 처리) */

const ASSET_URLS = {
  sky: '/assets/sky.jpg',
  fighter: '/assets/fighter.png',
  drone: '/assets/drone.png',
  missile: '/assets/missile.png',
  turret: '/assets/turret.png',
  explosion: '/assets/explosion.png',
};

const store = {
  ready: false,
  loading: null,
  images: {},
  processed: {},
  bgCache: new Map(),
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/** 렉 방지: 스프라이트 최대 변 길이 */
function downscaleImage(img, maxDim = 256) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (Math.max(w, h) <= maxDim) return img;
  const scale = maxDim / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** 흰색/밝은 배경 → 투명 (스프라이트 컷아웃) */
function removeLightBackground(img, threshold = 238) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r > threshold && g > threshold && b > threshold) {
      d[i + 3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
      const fade = 255 - Math.min(r, g, b);
      d[i + 3] = Math.min(d[i + 3], fade * 2);
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** 검은 배경 → 투명 (폭발) */
function removeDarkBackground(img, threshold = 35) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r < threshold && g < threshold && b < threshold) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export function preloadPhotoAssets() {
  if (store.loading) return store.loading;
  if (store.ready) return Promise.resolve(store.processed);

  store.loading = (async () => {
    const entries = Object.entries(ASSET_URLS);
    await Promise.all(
      entries.map(async ([key, url]) => {
        store.images[key] = await loadImage(url);
      })
    );

    store.processed.sky = store.images.sky;
    store.processed.fighter = removeLightBackground(downscaleImage(store.images.fighter, 200), 235);
    store.processed.drone = removeLightBackground(downscaleImage(store.images.drone, 160), 232);
    store.processed.missile = removeLightBackground(downscaleImage(store.images.missile, 180), 228);
    store.processed.turret = removeLightBackground(downscaleImage(store.images.turret, 200), 225);
    store.processed.explosion = removeDarkBackground(downscaleImage(store.images.explosion, 200), 42);

    store.ready = true;
    return store.processed;
  })();

  return store.loading;
}

export function arePhotoAssetsReady() {
  return store.ready;
}

export function getPhotoAsset(key) {
  return store.processed[key] || store.images[key];
}

export function getBackgroundForSize(width, height) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  if (store.bgCache.has(key)) return store.bgCache.get(key);

  const sky = getPhotoAsset('sky');
  if (!sky) return null;

  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const sw = sky.width || sky.naturalWidth;
  const sh = sky.height || sky.naturalHeight;
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(sky, (width - dw) / 2, (height - dh) / 2, dw, dh);

  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(0, 40, 80, 0.08)');
  vignette.addColorStop(1, 'rgba(0, 30, 50, 0.2)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  store.bgCache.set(key, c);
  return c;
}
