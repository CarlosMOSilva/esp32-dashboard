const delay = 50;
const motorState = { 1: 0, 2: 0, 3: 0, 4: 0 };
let batchTimeout = null;
let useBLE = false;
let bleCharacteristic = null;
let websocket = null;
let bleBusy = false;

// ⚠️ CHANGE THIS TO YOUR ACTUAL GITHUB PAGES URL
const GITHUB_URL = "https://carlosmosilva.github.io/esp32-dashboard/";

const BLE_SERVICE    = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BLE_CHAR       = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const ESP32_IP       = () => document.getElementById('esp32-ip')?.value.trim()
    || localStorage.getItem('esp32ip')
    || '192.168.1.106';

// ── Page switching ────────────────────────────────────────────
function showPage(name) {
    document.getElementById('page-ble').classList.toggle('hidden', name !== 'ble');
    document.getElementById('page-wifi').classList.toggle('hidden', name !== 'wifi');
}

// ── WebSocket ─────────────────────────────────────────────────
function connectWebSocket(ip) {
    if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) {
        return;
    }
    if (websocket && websocket.readyState !== WebSocket.CLOSED) {
        websocket.close();
    }

    websocket = new WebSocket(`ws://${ip}/ws`);
    const status = document.getElementById('wifi-status');
    status.innerText = 'Connecting...';
    status.style.color = '#f59e0b';

    websocket.onopen  = () => { status.innerText = `Connected (${ip})`; status.style.color = '#4ade80'; };
    websocket.onclose = () => { status.innerText = 'Disconnected';       status.style.color = 'red'; };
    websocket.onerror = () => { status.innerText = 'Error';              status.style.color = 'orange'; };
}

// ── Send command ──────────────────────────────────────────────
async function sendCommand(motorId, value) {
    motorState[motorId] = value;
    if (batchTimeout) return;
    batchTimeout = setTimeout(() => {
        const payload = JSON.stringify({ t: "mb", motors: motorState });
        if (useBLE && bleCharacteristic) {
            if (bleBusy) { batchTimeout = null; return; }
            try {
                bleBusy = true;
                bleCharacteristic.writeValueWithoutResponse(new TextEncoder().encode(payload));
            } catch(e) { console.error('BLE send error', e); }
            finally { bleBusy = false; }
        } else if (websocket?.readyState === WebSocket.OPEN) {
            websocket.send(payload);
        }
        batchTimeout = null;
    }, delay);
}

// ── Joystick factory ──────────────────────────────────────────
function createJoysticks(m1, m2, m3, m4) {
    const j1 = nipplejs.create({
        zone: document.getElementById('joystick-zone-1'),
        mode: 'static', color: 'black',
        position: { left: '50%', top: '50%' },
        size: 200, lockY: true, multitouch: true
    });
    j1.on('move', (e, d) => {
        if (!d?.vector) return;
        const v = Math.round(d.vector.y * Math.min(d.force, 1) * 255);
        sendCommand(m1, v); sendCommand(m2, v);
    });
    j1.on('end', () => { sendCommand(m1, 0); sendCommand(m2, 0); });

    const j2 = nipplejs.create({
        zone: document.getElementById('joystick-zone-2'),
        mode: 'static', color: 'black',
        position: { left: '50%', top: '50%' },
        size: 200, lockX: true, multitouch: true
    });
    j2.on('move', (e, d) => {
        if (!d?.vector) return;
        const x = Math.round(d.vector.x * Math.min(d.force, 1) * 255);
        const y = Math.round(d.vector.y * Math.min(d.force, 1) * 255);
        sendCommand(m3, x); sendCommand(m4, y);
    });
    j2.on('end', () => { sendCommand(m3, 0); sendCommand(m4, 0); });
}

// ── BLE connect ───────────────────────────────────────────────
async function connectBLE() {
    const status = document.getElementById('ble-status');
    if (!navigator.bluetooth) {
        status.innerText = 'BLE not available (needs HTTPS)';
        status.style.color = 'red';
        return false;
    }

    try { fetch(`http://${ESP32_IP()}/mode/ble`, { mode: 'no-cors' }).catch(() => {}); }
    catch(e) {}

    try {
        status.innerText = 'Connecting...';
        status.style.color = '#f59e0b';
        const device  = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'ESP32_Robot' }],
            optionalServices: [BLE_SERVICE]
        });
        const server  = await device.gatt.connect();
        const service = await server.getPrimaryService(BLE_SERVICE);
        bleCharacteristic = await service.getCharacteristic(BLE_CHAR);
        useBLE = true;
        status.innerText = 'BLE Connected';
        status.style.color = '#60a5fa';
        return true;
    } catch(err) {
        console.error('BLE failed', err);
        status.innerText = 'BLE failed';
        status.style.color = 'red';
        return false;
    }
}

// ── Switch ESP32 to WiFi via BLE command ──────────────────────
async function switchESP32toWiFi() {
    if (!bleCharacteristic) return;
    try {
        const payload = JSON.stringify({ t: "mode", v: "wifi" });
        await bleCharacteristic.writeValueWithoutResponse(new TextEncoder().encode(payload));
        await new Promise(r => setTimeout(r, 1000));
    } catch(e) { console.error('Mode switch error', e); }
}

// ── Main ──────────────────────────────────────────────────────
window.onload = () => {
    // Check if we are running on GitHub (HTTPS) or ESP32 Local (HTTP)
    const isGitHub = window.location.protocol === 'https:';

    document.getElementById('esp32-ip').value = localStorage.getItem('esp32ip') || '192.168.1.106';

    // BLE Connect
    document.getElementById('ble-connect-btn').addEventListener('click', connectBLE);

    // Switch to WiFi logic
    document.getElementById('goto-wifi-btn').addEventListener('click', async () => {
        const ip = ESP32_IP();
        localStorage.setItem('esp32ip', ip);

        await switchESP32toWiFi(); // Tell ESP32 to change network modes

        // Redirect browser to the ESP32's local web server
        window.location.href = `http://${ip}/`;
    });

    // WiFi Connect
    document.getElementById('wifi-connect-btn').addEventListener('click', () => {
        const ip = ESP32_IP();
        localStorage.setItem('esp32ip', ip);
        connectWebSocket(ip);
    });

    // Switch to BLE logic
    document.getElementById('goto-ble-btn').addEventListener('click', async () => {
        // Tell ESP32 to switch to BLE mode
        try { fetch(`/mode/ble`).catch(() => {}); } catch(e) {}

        // Redirect browser back to GitHub Pages
        window.location.href = GITHUB_URL;
    });

    createJoysticks(1, 2, 3, 4);

    // Environment-specific setup
    if (isGitHub) {
        // Running on GitHub Pages -> Show BLE page
        showPage('ble');
    } else {
        // Running on ESP32 LittleFS -> Show WiFi page and auto-connect
        showPage('wifi');
        const localIp = window.location.hostname;
        document.getElementById('esp32-ip').value = localIp;
        connectWebSocket(localIp);
    }
};