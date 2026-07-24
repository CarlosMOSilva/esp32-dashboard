const throttleMap = {};  // one timeout per data ID
const lastDataMap = {};  // one pending value per data ID
const delay = 50;

const motorState = { 1: 0, 2: 0, 3: 0, 4: 0 };
let batchTimeout = null;

let useBLE = false;
let bleCharacteristic = null;
let websocket = null;
let bleBusy = false; // Add this global flag

function getESP32IP() {
    return localStorage.getItem('esp32ip') || '192.168.1.106';
}

function connectWebSocket(ip) {
    if (websocket) websocket.close();

    try {
        // The browser will block this on GitHub Pages, so we must "catch" the error
        websocket = new WebSocket(`ws://${ip}/ws`);

        websocket.onopen = () => {
            if (!useBLE) {
                document.getElementById('status-text').innerText = `WiFi Connected (${ip})`;
                document.getElementById('status-text').style.color = 'lightgreen';
            }
        };
        websocket.onclose = () => {
            if (!useBLE) {
                document.getElementById('status-text').innerText = 'WiFi Disconnected';
                document.getElementById('status-text').style.color = 'red';
            }
        };
        websocket.onerror = () => {
            if (!useBLE) {
                document.getElementById('status-text').innerText = 'WiFi Error';
                document.getElementById('status-text').style.color = 'orange';
            }
        };
    } catch (error) {
        // This will silently catch the DOMException on HTTPS so the rest of the page (like BLE) still works
        console.warn("WebSocket blocked by browser security. You must use BLE when on HTTPS.");
        if (!useBLE) {
            document.getElementById('status-text').innerText = 'WiFi Blocked (Use BLE)';
            document.getElementById('status-text').style.color = 'orange';
        }
    }
}

async function sendCommand(motorId, value) {

    motorState[motorId] = value;

    if (batchTimeout) return; // already scheduled
    batchTimeout = setTimeout(() => {
        const payload = JSON.stringify({
            t: "mb",  // mb = motor batch
            motors: motorState
        });
        if (useBLE && bleCharacteristic) {
            if (bleBusy) return; // Skip if we are already sending

            try {
                bleBusy = true;
                const encoder = new TextEncoder();
                // Use writeValueWithoutResponse for faster, non-blocking writes if possible
                bleCharacteristic.writeValueWithoutResponse(encoder.encode(payload));
            } catch (error) {
                console.error("BLE Send Error:", error);
            } finally {
                bleBusy = false; // Ready for the next command
            }
        } else if (!useBLE && websocket.readyState === WebSocket.OPEN) {
            websocket.send(payload);
        }
        batchTimeout = null;
    }, delay);
}

window.onload = () => {
    const isSecure = window.location.protocol === 'https:';

    const toggleWrap = document.getElementById('toggle-wrap');
    const ipInput = document.getElementById('esp32-ip');
    const connectBtn = document.getElementById('main-connect-btn');
    const modeToggle = document.getElementById('mode-toggle');
    const statusText = document.getElementById('status-text');

    ipInput.value = getESP32IP();

    // --- 1. AUTO-SWITCH LOGIC ON LOAD ---
    if (isSecure) {
        // We are on GitHub Pages (HTTPS). Force BLE mode.
        useBLE = true;
        toggleWrap.style.display = 'none'; // Hide the switch
        ipInput.style.display = 'none';    // Hide the IP input
        connectBtn.innerText = "Connect Bluetooth";
        statusText.innerText = "BLE Ready (Click Connect)";
        statusText.style.color = '#60a5fa';
    } else {
        // We are on local HTTP. Allow WiFi and show UI.
        useBLE = false;
        connectWebSocket(getESP32IP());
    }

    // --- 2. THE MAIN CONNECT BUTTON LOGIC ---
    connectBtn.addEventListener('click', async () => {
        if (useBLE) {
            // Connect to Bluetooth
            if (!navigator.bluetooth) {
                alert("Web Bluetooth not available. Requires Chrome/Edge.");
                return;
            }
            try {
                const device = await navigator.bluetooth.requestDevice({
                    filters: [{ name: 'ESP32_Robot' }],
                    optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
                });
                const server  = await device.gatt.connect();
                const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
                bleCharacteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

                statusText.innerText = 'BLE Connected';
                statusText.style.color = '#60a5fa';
                if (websocket) websocket.close();
            } catch (err) {
                console.error('BLE failed', err);
                statusText.innerText = 'BLE Connection Failed';
                statusText.style.color = 'red';
            }
        } else {
            // Connect to WiFi
            const ip = ipInput.value.trim();
            localStorage.setItem('esp32ip', ip);
            connectWebSocket(ip);
        }
    });

    // --- 3. THE TOGGLE LOGIC (Only accessible when on HTTP) ---
    modeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            useBLE = true;
            ipInput.style.display = 'none';
            connectBtn.innerText = "Connect Bluetooth";
            if (websocket) websocket.close();
            statusText.innerText = 'BLE Ready';
            statusText.style.color = '#60a5fa';
        } else {
            useBLE = false;
            ipInput.style.display = 'inline-block';
            connectBtn.innerText = "Connect";
            connectWebSocket(ipInput.value.trim());
        }
    });

    // --- 4. JOYSTICK SETUP ---
    // (Keep your existing nipplejs joystick setup code exactly the same down here)
    const joystick1 = nipplejs.create({
        zone: document.getElementById('joystick-zone-1'),
        mode: 'static',
        color:'black',
        position: { left: '50%', top: '50%' },
        size: 200,
        lockY: true,
    });

    joystick1.on('move', (evt, data) => {
        if (!data || !data.vector) return;
        const force = Math.min(data.force, 1);
        const x = Math.round(data.vector.x * force * 255);
        const y = Math.round(data.vector.y * force * 255);
        sendCommand(1, y);
        sendCommand(2, y);
    });

    joystick1.on('end', () => {
        sendCommand(1, 0);
        sendCommand(2, 0);
    });

    const joystick2 = nipplejs.create({
        zone: document.getElementById('joystick-zone-2'),
        mode: 'static',
        color:'black',
        position: { left: '50%', top: '50%' },
        size: 200,
        lockX: true,
    });

    joystick2.on('move', (evt, data) => {
        if (!data || !data.vector) return;
        const force = Math.min(data.force, 1);
        const x = Math.round(data.vector.x * force * 255);
        const y = Math.round(data.vector.y * force * 255);
        sendCommand(3, x);
        sendCommand(4, y);
    });

    joystick2.on('end', () => {
        sendCommand(3, 0);
        sendCommand(4, 0);
    });
}