let BATTERY_ENDPOINT = null;
const POLL_INTERVAL_MS = 5000;

async function fetchBattery() {
  if (!BATTERY_ENDPOINT) return; // no endpoint yet
  try {
    const resp = await fetch(BATTERY_ENDPOINT, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    setBatteryHUD(data);
  } catch (err) {
    console.warn('⚠️ battery fetch failed:', err);
    const statusEl = document.getElementById('batteryStatusText');
    if (statusEl) statusEl.innerText = 'Fehler: ' + err.message;
  }
}

// load config first
fetch('/config')
  .then(r => r.json())
  .then(cfg => {
    if (!cfg.ESP32_IP) throw new Error('missing ESP32_IP');
    BATTERY_ENDPOINT = `http://${cfg.ESP32_IP}:81/battery`;
    setBatteryHUD({ voltage: null, soc: null });
    fetchBattery();
    setInterval(fetchBattery, POLL_INTERVAL_MS);
  })
  .catch(err => {
    console.error('❌ battery module init failed:', err);
    const statusEl = document.getElementById('batteryStatusText');
    if (statusEl) statusEl.innerText = 'config error';
  });

// Klammert Wert auf Bereich ein
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Anzeige aktualisieren
function setBatteryHUD({ voltage, soc, charging = false }) {
  const iconEl = document.getElementById('batteryIcon');
  const pctEl = document.getElementById('batteryPercent');
  const voltEl = document.getElementById('batteryVoltage');
  const statusEl = document.getElementById('batteryStatusText');

  if (!iconEl || !pctEl || !voltEl || !statusEl) return;

  voltEl.innerText = (typeof voltage === 'number') ? voltage.toFixed(2) + ' V' : '-- V';

  let percent = (typeof soc === 'number') ? Math.round(clamp(soc, 0, 100)) : null;
  pctEl.innerText = (percent !== null) ? (percent + '%') : '--%';

  if (percent === null) {
    iconEl.innerText = '🔋';
    iconEl.style.color = '#bbbbbb';
    statusEl.innerText = 'Keine Daten';
  } else if (percent > 60) {
    iconEl.innerText = charging ? '⚡🔋' : '🔋';
    iconEl.style.color = '#2ecc71';
    statusEl.innerText = charging ? 'Lädt' : 'OK';
  } else if (percent > 30) {
    iconEl.innerText = charging ? '⚡🔋' : '🔋';
    iconEl.style.color = '#f1c40f';
    statusEl.innerText = charging ? 'Lädt' : 'Mittel';
  } else {
    iconEl.innerText = charging ? '⚡🔋' : '🔋';
    iconEl.style.color = '#e74c3c';
    statusEl.innerText = charging ? 'Lädt' : 'Niedrig';
  }
}

function updateBatteryDisplay(percent) {
  const icon = document.getElementById("batteryIcon");
  const percentText = document.getElementById("batteryPercent");

  percentText.textContent = `${percent}%`;

  let iconName;

  switch (true) {
    case (percent >= 90):
      iconName = "battery_android_full";
      break;
    case (percent >= 70):
      iconName = "battery_android_5";
      break;
    case (percent >= 50):
      iconName = "battery_android_4";
      break;
    case (percent >= 30):
      iconName = "battery_android_2";
      break;
    case (percent >= 10):
      iconName = "battery_android_frame_1";
      break;
    default:
      iconName = "battery_android_question";
  }

  icon.textContent = iconName;
}

// Akku-Daten abrufen und anzeigen
async function fetchBattery() {
  try {
    const resp = await fetch(BATTERY_ENDPOINT, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    setBatteryHUD(data);
  } catch (err) {
    console.warn('Fehler beim Abrufen Batterie:', err);
    const statusEl = document.getElementById('batteryStatusText');
    if (statusEl) statusEl.innerText = 'Fehler: ' + err.message;
  }
}

// Initial und in Intervallen abrufen
setBatteryHUD({ voltage: null, soc: null });
fetchBattery();
setInterval(fetchBattery, POLL_INTERVAL_MS);
