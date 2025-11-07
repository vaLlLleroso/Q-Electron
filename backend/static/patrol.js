(() => {
let baseUrl = ''; // will hold from /config

// Wait for OpenLayers to load
function waitForOL(callback) {
  if (window.ol) {
    console.log("✅ OpenLayers ready for patrol");
    callback();
  } else {
    console.log("⏳ Waiting for OpenLayers in patrol...");
    setTimeout(() => waitForOL(callback), 100);
  }
}

async function loadConfig() {
  const res = await fetch('/config');
  const cfg = await res.json();

  // map config vars to globals
  window.appConfig = cfg;
  baseUrl = cfg.GPS_IP || ''; // or cfg.RTSP_URL if that’s your backend

  console.log('esp32:', cfg.GPS_IP);
  console.log('gps endpoint:', cfg.GPS_ENDPOINT);
}
  // Helper function for fetch requests
  async function fetchJSON(url, opts = {}) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers
        },
        cache: 'no-store'
      });
      const text = await res.text();
      try { 
        return { ok: res.ok, status: res.status, data: JSON.parse(text) }; 
      } catch (e) { 
        console.error('JSON parse error:', e, 'Response:', text);
        return { ok: false, status: res.status, error: 'Invalid JSON response' }; 
      }
    } catch (err) {
      console.error('Fetch error:', err);
      return { ok: false, error: err.message, status: 500 };
    }
  }

  // Show status messages
  let messageTimeout;
  function showMessage(msg, isError = false) {
    const msgEl = document.getElementById('message');
    if (msgEl) {
      msgEl.textContent = msg;
      msgEl.className = isError ? 'text-red-400' : 'text-green-400';
      clearTimeout(messageTimeout);
      messageTimeout = setTimeout(() => { msgEl.textContent = ''; }, 4000);
    }
  }

  function initPatrol() {
    const container = document.getElementById('patrol-container');
    if (!container || container.dataset.patrolInit) return;

    container.dataset.patrolInit = "true";
    console.log("✅ patrol.js initialized");

    // Initialize map if needed
    waitForOL(() => {
      if (document.getElementById('mapLoc')) {
        window.switchMapTarget('mapLoc');
      }
    });

    // (slots rendering is handled by the main loadSlots implementation below)

    // Initialize both schedule and time slots containers
    const scheduleList = document.getElementById('schedule-list');
    const slotsTableBody = document.getElementById('slotsTableBody');
    const addScheduleBtn = document.getElementById('addSchedule');
    const calendarEl = document.getElementById('calendar');
    const monthLabel = document.getElementById('monthLabel');

    // For the content-only variant (`patrol_content.html`) we only require the
    // slots table to be present. Other UI parts (full page schedule, calendar,
    // addSchedule button) are optional and initialized only when present.
    if (!slotsTableBody) {
      console.error("Required element `slotsTableBody` not found — patrol UI cannot initialize");
      return;
    }

    // ============ TIME SLOTS MANAGEMENT ============
    async function loadSlots() {
      console.log("Loading time slots...");
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.textContent = 'Laden...';

      const res = await fetchJSON('/time_slots');
      console.log("Time slots response:", res);

      if (loadingEl) loadingEl.textContent = '';

      if (!res.ok) {
        showMessage(`Fehler beim Laden: ${res.error || res.status}`, true);
        slotsTableBody.innerHTML = '<tr><td colspan="4" class="py-4 px-2 text-gray-400">Fehler beim Laden</td></tr>';
        return;
      }

      // Support server returning either an array or { ok: true, data: [...] }
      let payload = res.data;
      let slots = [];
      if (Array.isArray(payload)) slots = payload;
      else if (payload && Array.isArray(payload.data)) slots = payload.data;
      else {
        showMessage('Ungültiges Datenformat vom Server', true);
        slotsTableBody.innerHTML = '<tr><td colspan="4" class="py-4 px-2 text-gray-400">Datenformatfehler</td></tr>';
        return;
      }

      if (slots.length === 0) {
        slotsTableBody.innerHTML = '<tr><td colspan="4" class="py-4 px-2 text-gray-400">Keine Zeitfenster gespeichert</td></tr>';
        return;
      }

      // If a date is selected we shouldn't show global slots here; caller will render per-day schedules
      if (typeof selectedDate !== 'undefined' && selectedDate) {
        // leave slotsTableBody untouched — schedule rendering will replace it
      }

      slotsTableBody.innerHTML = '';
      slots.forEach(slot => {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-gray-700';
        tr.innerHTML = `
          <td class="py-2 px-2">${slot.id}</td>
          <td class="py-2 px-2">
            <input type="time" value="${slot.start}" data-id="${slot.id}" data-type="start" 
                   class="bg-gray-700 text-white rounded px-2 py-1">
              </td>
              <td class="py-2 px-4">
                <input type="time" value="${slot.end}" data-id="${slot.id}" data-type="end" 
                       class="bg-gray-700 text-white rounded px-2 py-1">
              </td>
              <td class="py-2 px-4">
                <button data-action="save" data-id="${slot.id}" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded mr-2">
                  Speichern
                </button>
                <button data-action="delete" data-id="${slot.id}" 
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">
                  Löschen
                </button>
              </td>
            `;
            slotsTableBody.appendChild(tr);
      });
    }

    // legacy saveSlot removed; using unified saveSlot below

    async function deleteSlot(id) {
      if (!confirm('Zeitfenster wirklich löschen?')) return;
      
      const res = await fetchJSON(`/time_slots?id=${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        showMessage('Zeitfenster gelöscht');
        await loadSlots();
      } else {
        showMessage(`Fehler: ${res.error || res.status}`, true);
      }
    }

    // Add new slot handler
    document.getElementById('addSlot')?.addEventListener('click', async () => {
      const start = document.getElementById('newStart')?.value || '08:00';
      const end = document.getElementById('newEnd')?.value || '20:00';
      
      // Get next available ID
      const res = await fetchJSON('/time_slots');
      if (!res.ok) {
        showMessage(`Fehler beim Laden der Slots: ${res.error || res.status}`, true);
        return;
      }
      const payload = res.data;
      const slots = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
      const usedIds = new Set(slots.map(s => s.id));
      let newId = 0;
      while (usedIds.has(newId)) newId++;
      
      // Create new slot
      const createRes = await fetchJSON('/time_slots', {
        method: 'POST',
        body: JSON.stringify({ id: newId, start, end })
      });
      
      if (createRes.ok) {
        showMessage('Zeitfenster hinzugefügt');
        await loadSlots();
      } else {
        showMessage(`Fehler: ${createRes.error || createRes.status}`, true);
      }
    });

    // Add save handler
    async function saveSlot(id, start, end) {
      const res = await fetchJSON(`/time_slots?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ start, end })
      });
      
      if (res.ok) {
        showMessage('Zeitfenster gespeichert');
        await loadSlots();
      } else {
        showMessage(`Fehler: ${res.error || res.status}`, true);
      }
    }

    // Table event delegation for save/delete (handles global slots and per-day schedules)
    slotsTableBody?.addEventListener('click', e => {
      const el = e.target;
      if (el.tagName !== 'BUTTON') return;
      const action = el.getAttribute('data-action');
      const rawId = el.getAttribute('data-id');

      if (action === 'save') {
        // global slot save (server-backed)
        const id = parseInt(rawId, 10);
        const row = el.closest('tr');
        const start = row.querySelector('input[data-type="start"]').value;
        const end = row.querySelector('input[data-type="end"]').value;
        saveSlot(id, start, end);
      } else if (action === 'delete') {
        // global slot delete (server-backed)
        const id = parseInt(rawId, 10);
        deleteSlot(id);
      } else if (action === 'save-schedule') {
        // per-day schedule save (in-memory)
        if (!selectedDate) {
          showMessage('Kein Datum ausgewählt', true);
          return;
        }
        const row = el.closest('tr');
        const sid = row.getAttribute('data-schedule-id');
        const start = row.querySelector('input[data-type="start"]')?.value || '';
        const end = row.querySelector('input[data-type="end"]')?.value || '';
        const iso = getIso(selectedDate);
        const arr = schedulesByDate[iso] || [];
        const idx = arr.findIndex(x => x.id === sid);
        if (idx >= 0) {
          arr[idx].start = start;
          arr[idx].end = end;
        } else {
          arr.push({ id: sid, start, end });
        }
          schedulesByDate[iso] = arr;
          // persist modified schedule set
          saveSchedulesForDateToServer(iso);
          showMessage('Zeitplan gespeichert');
          refreshCalendarHighlights();
      } else if (action === 'delete-schedule') {
        if (!selectedDate) return;
        const row = el.closest('tr');
        const sid = row.getAttribute('data-schedule-id');
        const iso = getIso(selectedDate);
        const arr = schedulesByDate[iso] || [];
        schedulesByDate[iso] = arr.filter(x => x.id !== sid);
        renderSchedulesForDate(selectedDate);
        // persist deletion
        saveSchedulesForDateToServer(iso);
        refreshCalendarHighlights();
        showMessage('Zeitplan gelöscht');
      }
    });

    // Refresh button handler
    const refreshBtn = document.getElementById('refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadSlots);
    }

    // Initial slots load
    loadSlots();

  // ============ PER-DAY SCHEDULES (in-memory) ============
  // Map yyyy-mm-dd -> [{id, start, end}]
  let schedulesByDate = {};

    function getIso(date) {
      return date.format('YYYY-MM-DD');
    }

    // --- Server persistence for schedules ---
    // Try to load schedules from server on init. Fall back to empty object.
    async function loadSchedulesFromServer() {
      try {
        const res = await fetchJSON('/schedules');
        if (res.ok) {
          let payload = res.data;
          // server returns { ok: true, data: {...} }
          if (payload && payload.data && typeof payload.data === 'object') {
            schedulesByDate = payload.data;
          } else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            // fallback: payload is the map directly
            schedulesByDate = payload;
          } else if (Array.isArray(payload)) {
            // payload is a list of entries -> convert to map
            const map = {};
            payload.forEach(it => {
              const d = it.date || it["date"];
              if (!d) return;
              map[d] = map[d] || [];
              map[d].push({ id: it.id, start: it.start, end: it.end });
            });
            schedulesByDate = map;
          }
          refreshCalendarHighlights();
        }
      } catch (e) {
        console.warn('Failed to load schedules from server', e);
      }
    }

    // Save/replace all schedules for a given date on the server
    async function saveSchedulesForDateToServer(dateIso) {
      try {
        const body = { date: dateIso, schedules: schedulesByDate[dateIso] || [] };
        const res = await fetchJSON('/schedules', { method: 'PUT', body: JSON.stringify(body) });
        if (!res.ok) console.warn('Failed to save schedules for', dateIso, res);
      } catch (e) {
        console.warn('Error saving schedules to server', e);
      }
    }

    // Remove single schedule on server
    async function deleteScheduleOnServer(dateIso, id) {
      try {
        const res = await fetchJSON(`/schedules?date=${encodeURIComponent(dateIso)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) console.warn('Failed to delete schedule on server', res);
      } catch (e) {
        console.warn('Error deleting schedule on server', e);
      }
    }

    // Load persisted schedules from server immediately
    loadSchedulesFromServer();

    // Save visible schedules before the page unloads so user changes aren't lost
    window.addEventListener('beforeunload', () => {
      try {
        saveCurrentVisibleSchedules();
      } catch (e) {
        // ignore
      }
    });

    // Save visible schedule rows (from slotsTableBody) into schedulesByDate[selectedDate]
    function saveCurrentVisibleSchedules() {
      if (!selectedDate) return;
      const iso = getIso(selectedDate);
      const rows = Array.from(slotsTableBody.querySelectorAll('tr[data-schedule-id]'));
      const arr = rows.map(r => {
        const id = r.getAttribute('data-schedule-id');
        const start = r.querySelector('input[data-type="start"]')?.value || '';
        const end = r.querySelector('input[data-type="end"]')?.value || '';
        return { id, start, end };
      });
      schedulesByDate[iso] = arr;
      console.log('Saved schedules for', iso, arr);
      showMessage('Zeitplan für ' + iso + ' gespeichert');
      // persist to server
      saveSchedulesForDateToServer(iso);
      refreshCalendarHighlights();
    }

    // Render schedules for a specific date into the slots table (same table format as global slots)
    function renderSchedulesForDate(date) {
      selectedDate = date;
      const iso = getIso(date);
      const arr = schedulesByDate[iso] || [];
      slotsTableBody.innerHTML = '';
      if (arr.length === 0) {
        slotsTableBody.innerHTML = `<tr><td colspan="4" class="py-4 px-2 text-gray-400">Keine geplanten Routen für ${iso}</td></tr>`;
        return;
      }
      arr.forEach(s => {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-gray-700';
        tr.setAttribute('data-schedule-id', s.id);
        tr.innerHTML = `
          <td class="py-2 px-2">${s.id}</td>
          <td class="py-2 px-2">
            <input type="time" value="${s.start}" data-schedule-id="${s.id}" data-type="start" class="bg-gray-700 text-white rounded px-2 py-1">
          </td>
          <td class="py-2 px-4">
            <input type="time" value="${s.end}" data-schedule-id="${s.id}" data-type="end" class="bg-gray-700 text-white rounded px-2 py-1">
          </td>
          <td class="py-2 px-4">
            <button data-action="save-schedule" data-id="${s.id}" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded mr-2">Speichern</button>
            <button data-action="delete-schedule" data-id="${s.id}" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Löschen</button>
          </td>
        `;
        slotsTableBody.appendChild(tr);
      });
      refreshCalendarHighlights();
    }

    // Helper to create a new schedule row for the current selectedDate
    function addScheduleRowToCurrentDate(start = '08:00', end = '09:00') {
      if (!selectedDate) {
        showMessage('Bitte zuerst ein Datum im Kalender wählen', true);
        return;
      }
      const iso = getIso(selectedDate);
      if (!schedulesByDate[iso]) schedulesByDate[iso] = [];
      // create unique id for schedule
      let newId = 's-' + Date.now();
      schedulesByDate[iso].push({ id: newId, start, end });
      // persist created schedule
      saveSchedulesForDateToServer(iso);
      renderSchedulesForDate(selectedDate);
    }

    // ============ CALENDAR & DRAG-DROP FUNCTIONALITY ============
    // Drag and drop for schedule items
    if (typeof Sortable !== 'undefined' && scheduleList) {
      new Sortable(scheduleList, {
        animation: 150,
        ghostClass: 'bg-gray-600'
      });
    }

      // Calendar functionality
    if (calendarEl && monthLabel) {
      const today = dayjs();
      let currentMonth = today.startOf('month');
      let selectedDate = null;

      function renderCalendar(date) {
        calendarEl.innerHTML = '';
        monthLabel.textContent = date.format('MMMM YYYY');
        const startDay = date.startOf('month').day();
        const daysInMonth = date.daysInMonth();

        // Empty cells for days before start of month
        for (let i = 0; i < startDay; i++) {
          calendarEl.innerHTML += `<div></div>`;
        }

        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
          // Render each day with a data-day attribute so clicks can be handled
          const dayDate = date.date(i);
          const iso = dayDate.format('YYYY-MM-DD');
          // Check if this day has any schedules
          const hasSchedule = scheduleList?.querySelector(`li[data-date="${iso}"]`);
          // Check if this is today's date
          const isToday = dayDate.isSame(dayjs(), 'day');
          // Check if this is the selected date
          const isSelected = selectedDate && dayDate.isSame(selectedDate, 'day');
          // Classes for different states
          const classes = [
            'calendar-day',
            'rounded',
            'py-1',
            'cursor-pointer',
            'transition-all',
            'duration-200',
            hasSchedule ? 'bg-blue-900 hover:bg-blue-800' : 'bg-gray-800 hover:bg-gray-600',
            isToday ? 'ring-2 ring-yellow-500' : '',
            isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110' : ''
          ].filter(Boolean).join(' ');
          
          calendarEl.innerHTML += `<div data-day="${iso}" class="${classes}">${i}</div>`;
        }
      }

      // Helper to refresh calendar highlights
      function refreshCalendarHighlights() {
        const days = calendarEl.querySelectorAll('.calendar-day');
        days.forEach(day => {
          const iso = day.getAttribute('data-day');
          const hasSchedule = (schedulesByDate[iso] && schedulesByDate[iso].length > 0) || Boolean(scheduleList?.querySelector(`li[data-date="${iso}"]`));
          if (hasSchedule) {
            day.classList.remove('bg-gray-800', 'hover:bg-gray-600');
            day.classList.add('bg-blue-900', 'hover:bg-blue-800');
          } else {
            day.classList.remove('bg-blue-900', 'hover:bg-blue-800');
            day.classList.add('bg-gray-800', 'hover:bg-gray-600');
          }
        });
      }

      // Month navigation
      document.getElementById('prevMonth')?.addEventListener('click', () => {
        currentMonth = currentMonth.subtract(1, 'month');
        // If selected date is in the month we're navigating to, keep the selection
        if (selectedDate && !selectedDate.isSame(currentMonth, 'month')) {
          selectedDate = null;
        }
        renderCalendar(currentMonth);
        if (!selectedDate) loadSlots();
      });

      document.getElementById('nextMonth')?.addEventListener('click', () => {
        currentMonth = currentMonth.add(1, 'month');
        // If selected date is in the month we're navigating to, keep the selection
        if (selectedDate && !selectedDate.isSame(currentMonth, 'month')) {
          selectedDate = null;
        }
        renderCalendar(currentMonth);
        if (!selectedDate) loadSlots();
      });

      // Initial calendar render
      renderCalendar(currentMonth);

      // Click handler for calendar days -> switch to that date's schedules
      calendarEl.addEventListener('click', (ev) => {
        const dayEl = ev.target.closest('.calendar-day');
        if (!dayEl) return;
        const iso = dayEl.getAttribute('data-day');
        if (!iso) return;
        // Use dayjs to parse and display
        const d = dayjs(iso);
        // Disallow selecting past days
        if (d.isBefore(dayjs(), 'day')) {
          showMessage('Vergangene Tage können nicht ausgewählt werden', true);
          return;
        }

        // Before switching, save whatever is currently visible for the previous selectedDate
        if (selectedDate && !selectedDate.isSame(d, 'day')) {
          saveCurrentVisibleSchedules();
        }

        // Switch selection and render
        selectedDate = d;
        renderCalendar(currentMonth); // Refresh calendar to show selection
        renderSchedulesForDate(d);
      });

      // Helper: add a schedule entry into the schedule list
      function addScheduleEntryForDate(dayjsDate, start = '08:00', end = '09:00') {
        if (!scheduleList) return;
        const id = `sch-${Date.now()}`;
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-800 p-2 rounded mb-2';
        li.dataset.date = dayjsDate.format('YYYY-MM-DD');
        li.dataset.scheduleId = id;
        li.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="flex flex-col">
              <div class="text-sm text-white font-medium">${dayjsDate.format('dddd')}</div>
              <div class="text-xs text-gray-400">${dayjsDate.format('D. MMMM YYYY')}</div>
            </div>
            <input type="time" value="${start}" class="bg-gray-700 text-white rounded px-2 py-1 schedule-start">
            <span class="text-gray-400">to</span>
            <input type="time" value="${end}" class="bg-gray-700 text-white rounded px-2 py-1 schedule-end">
          </div>
          <div class="flex items-center gap-2">
            <button class="save-schedule bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">Save</button>
            <button class="remove-schedule bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">Remove</button>
          </div>
        `;
        scheduleList.appendChild(li);
      }

      // If the Add Schedule button exists, wire it to add a schedule to the currently selected date (or today)
      addScheduleBtn?.addEventListener('click', () => {
        const today = dayjs();
        // If there's no selected date, switch to today first (saving current visible schedules)
        if (!selectedDate) {
          selectedDate = today;
          renderCalendar(currentMonth);
          renderSchedulesForDate(selectedDate);
        }
        addScheduleRowToCurrentDate('08:00', '09:00');
      });

      // Delegate save/remove actions inside scheduleList
      scheduleList.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button');
        if (!btn) return;
        const li = btn.closest('li');
        if (!li) return;
        if (btn.classList.contains('remove-schedule')) {
          const date = li.dataset.date;
          // also remove from schedulesByDate if present
          if (date && schedulesByDate[date]) {
            // attempt to match by times (best-effort)
            const start = li.querySelector('.schedule-start')?.value;
            const end = li.querySelector('.schedule-end')?.value;
            schedulesByDate[date] = schedulesByDate[date].filter(s => !(s.start === start && s.end === end));
            // persist changes
            saveSchedulesForDateToServer(date);
          }
          li.remove();
          showMessage('Schedule removed');
          refreshCalendarHighlights();
        } else if (btn.classList.contains('save-schedule')) {
          // Collect values and save to in-memory schedulesByDate
          const date = li.dataset.date;
          const start = li.querySelector('.schedule-start')?.value;
          const end = li.querySelector('.schedule-end')?.value;
          if (date) {
            if (!schedulesByDate[date]) schedulesByDate[date] = [];
            // create an id and push — we don't try to dedupe here
            const id = 's-' + Date.now();
            schedulesByDate[date].push({ id, start, end });
            // persist changes
            saveSchedulesForDateToServer(date);
            showMessage('Schedule saved');
            refreshCalendarHighlights();
          } else {
            console.log('Save schedule: no date present on list item', li);
            showMessage('Fehlendes Datum', true);
          }
        }
      });
    }

    // Initialize map if available
    if (typeof window.switchMapTarget === 'function') {
      window.switchMapTarget('mapLoc');
    } else if (typeof window.createMap === 'function') {
      window.createMap('mapLoc');
    }
  }

  // Export initPatrol function
  window.initPatrol = initPatrol;

  // Watch for patrol container in case of dynamic page loads
  const observer = new MutationObserver(() => initPatrol());
  observer.observe(document.body, { childList: true, subtree: true });
})();