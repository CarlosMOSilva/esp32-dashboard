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
    websocket = new WebSocket(`wss://${ip}/ws`);
    websocket.onopen    = () => {
        document.getElementById('ws-status').innerText = `WiFi Connected (${ip})`;
        document.getElementById('ws-status').style.color = 'lightgreen';
    };
    websocket.onclose   = () => {
        document.getElementById('ws-status').innerText = 'WiFi Disconnected';
        document.getElementById('ws-status').style.color = 'red';
    };
    websocket.onerror   = () => {
        document.getElementById('ws-status').innerText = 'WiFi Error';
        document.getElementById('ws-status').style.color = 'orange';
    };
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
        } else if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(payload);
        }
        batchTimeout = null;
    }, delay);
}

window.onload = () => {

    // --- BLE Setup ---
    document.getElementById('ble-connect-btn').addEventListener('click', async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'ESP32_Robot' }],
                optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');

            // Match the UUID from C++
            bleCharacteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

            useBLE = true;
            document.getElementById('status-text').innerText = "Connected via BLE";
            document.getElementById('ble-connect-btn').style.display = 'none';

            // Close WebSocket to save ESP32 resources
            websocket.close();

        } catch (error) {
            console.error("BLE Connection failed", error);
            alert("Could not connect to Bluetooth. Make sure the ESP32 is in BLE mode.");
        }
    });

    document.getElementById('esp32-ip').value = getESP32IP();

    document.getElementById('wifi-connect-btn').addEventListener('click', () => {
        const ip = document.getElementById('esp32-ip').value.trim();
        localStorage.setItem('esp32ip', ip);
        connectWebSocket(ip);
    });

    connectWebSocket(getESP32IP());

    websocket.onmessage = event => {
        const message = JSON.parse(event.data);
        // if (message) {
        //     switch (message.id) {
        //         case 1:
        //             speedRange1.value = message.v;
        //             break;
        //         case 2:
        //             speedRange2.value = message.v;
        //             break;
        //         case 3:
        //             speedRange3.value = message.v;
        //             break;
        //         case 4:
        //             speedRange4.value = message.v;
        //             break;
        //         default:
        //             console.warn("Unknown motor ID:", data.id);
        //             speedRange1.value = 0;
        //             speedRange2.value = 0;
        //             break;
        //     }
        // }
    };

    function setSpeedWS(motorId, speed) {
        if (websocket.readyState === WebSocket.OPEN) {
            motorState[motorId] = speed;
            scheduleBatch();
        }
    }

    function scheduleBatch() {
        if (batchTimeout) return; // already scheduled
        batchTimeout = setTimeout(() => {
            const payload = JSON.stringify({
                t: "mb",  // mb = motor batch
                motors: motorState
            });
            websocket.send(payload);
            batchTimeout = null;
        }, delay);
    }

    const sendDataToWS = (dataId, data) => {
        lastDataMap[dataId] = data;

        if (throttleMap[dataId]) return; // already scheduled for this motor
        throttleMap[dataId] = setTimeout(() => {
            websocket.send(lastDataMap[dataId]);
            throttleMap[dataId] = null;
        }, delay);
    }

    const joystick1 = nipplejs.create({
        zone: document.getElementById('joystick-zone-1'),
        mode: 'static',
        color:'black',
        position: { left: '50%', top: '50%' },
        size: 200,
        lockY: true,
    });

    joystick1.on('move', (evt, data) => {
        if (!data || !data.vector) return; // ← guard

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
        if (!data || !data.vector) return; // ← guard

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