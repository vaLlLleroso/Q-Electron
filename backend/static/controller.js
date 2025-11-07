console.log("✅ controller.js loaded");

let controllerIndex = null;
let sendingData = false;
let lastSentTime = 0;

let ws;

fetch('/config')
  .then(r => r.json())
  .then(cfg => {
    if (!cfg.ESP32_IP) throw new Error('missing ESP32_IP');
    // Clean the IP address by removing any protocol prefixes if present
    const cleanIP = cfg.ESP32_IP.replace('http://', '').replace('https://', '').replace('ws://', '').replace('wss://', '').split('/')[0];
    ws = new WebSocket(`ws://${cleanIP}:81`);
    setupWebSocket();
  })
  .catch(err => console.error('⚠️ config/websocket init failed:', err));

function setupWebSocket() {
  ws.onopen = () => console.log('✅ WebSocket connected!');
  ws.onerror = (error) => console.error('⚠️ WebSocket error:', error);
  ws.onclose = () => {
    console.warn('❌ WebSocket disconnected.');
      if (location.hash === "#dashboard" || location.pathname === "/dashboard") {
      setTimeout(() => location.reload(), 1000);
    }
  };
}

// Button toggle states
let toggleStates = {
  buttonX: false,
  buttonO: false,
  buttonL1: false,
  buttonSquare: false
};
let previousButtonStates = { ...toggleStates };

window.addEventListener('DOMContentLoaded', () => {
  const throttleBar = document.getElementById('throttleBar');
  const brakeBar = document.getElementById('brakeBar');
  const leftDot = document.getElementById('leftDot');
  const rightDot = document.getElementById('rightDot');

  function updateControllerStatus(connected) {
    const statusEl = document.getElementById('controllerStatus');
    if (!statusEl) return;
    statusEl.textContent = connected ? 'Status: Connected' : 'Status: Disconnected';
    statusEl.classList.toggle('text-green-400', connected);
    statusEl.classList.toggle('text-red-400', !connected);
  }

  function moveDot(dotId, x, y) {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    const maxOffset = 40; // Max joystick movement in px
    const offsetX = x * maxOffset;
    const offsetY = y * maxOffset;
    dot.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
  }

  function saveState() {
    localStorage.setItem('toggleStates', JSON.stringify(toggleStates));
    localStorage.setItem('sendingData', JSON.stringify(sendingData));
  }

  function loadState() {
    const storedToggles = localStorage.getItem('toggleStates');
    const storedSending = localStorage.getItem('sendingData');
    if (storedToggles) toggleStates = JSON.parse(storedToggles);
    if (storedSending === 'true') sendingData = true;
  }

  function handleToggle(buttonName, isPressed) {
    if (isPressed && !previousButtonStates[buttonName]) {
      toggleStates[buttonName] = !toggleStates[buttonName];
      saveState();
    }
    previousButtonStates[buttonName] = isPressed;

    const element = document.getElementById(buttonName);
    if (element) {
  element.classList.toggle('bg-green-500', toggleStates[buttonName]);
  element.classList.toggle('bg-gray-800', !toggleStates[buttonName]);
  element.classList.toggle('text-white', true);
}
  }

  function updateController() {
    if (controllerIndex === null) return requestAnimationFrame(updateController);

    const gamepad = navigator.getGamepads()[controllerIndex];
    if (!gamepad) return requestAnimationFrame(updateController);

    const L2 = Math.round(gamepad.buttons[6].value * 100);
    const R2 = Math.round(gamepad.buttons[7].value * 100);

    if (throttleBar) throttleBar.style.width = `${R2}%`;
    if (brakeBar) brakeBar.style.width = `${L2}%`;

    const [leftX, leftY, rightX, rightY] = gamepad.axes;

    moveDot('leftDot', leftX, leftY);
    moveDot('rightDot', rightX, rightY);

    handleToggle('buttonX', gamepad.buttons[0].pressed);
    handleToggle('buttonO', gamepad.buttons[1].pressed);
    handleToggle('buttonSquare', gamepad.buttons[2].pressed);
    handleToggle('buttonL1', gamepad.buttons[4].pressed);

    if (sendingData && Date.now() - lastSentTime > 200) {
      const data = {
        leftStickY: leftY,
        rightStickX: rightX,
        L2,
        R2
      };
      ws.send(JSON.stringify(data));
      lastSentTime = Date.now();
    }

    requestAnimationFrame(updateController);
  }

  function toggleSending() {
    sendingData = !sendingData;
    const toggleBtn = document.getElementById('toggleButton');
    if (toggleBtn) toggleBtn.innerText = sendingData ? 'Stop Control' : 'Take Control';
    saveState();
  }


  // Gamepad connect/disconnect events
  window.addEventListener('gamepadconnected', (event) => {
    controllerIndex = event.gamepad.index;
    updateControllerStatus(true);
    updateController();
  });

  window.addEventListener('gamepaddisconnected', () => {
    controllerIndex = null;
    updateControllerStatus(false);
  });

  // Reset on tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('🛑 Tab inactive — resetting values');
      // Only send if ws is open
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ leftStickY: 0, rightStickX: 0, L2: 0, R2: 0 }));
      }
      sendingData = false;
      const toggleBtn = document.getElementById('toggleButton');
      if (toggleBtn) toggleBtn.innerText = 'Take Control';
      saveState();
    }
  });

  // Attach toggle function to control button
  const toggleBtn = document.getElementById('toggleButton');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSending);

  // Load saved toggle states and start
  loadState();
  
  function unloadDashboardComponents() {
    // Clear only if the #dashboard tab is not active
    if (location.hash !== "#dashboard") {
      // pauseDashboard(); // Removed: function not defined and not needed
      // Optional: remove dashboard DOM nodes
    }
  }
  window.addEventListener("hashchange", unloadDashboardComponents);
});
