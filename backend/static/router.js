console.log("✅ router.js loaded");

// Route mapping
window.routes = window.routes = {
  dashboard: '/dashboard',
  patrol: '/patrol',
  maintenance: '/maintenance',
  analytics: '/analytics',
};

function isMobileDevice() {
  return window.matchMedia("only screen and (max-width: 760px)").matches;
}

if (isMobileDevice()) {
  // Logic for mobile devices
  console.log("Detected device is a mobile.");
  
} else {
  // Logic for non-mobile devices
  console.log("Detected device is not a mobile.");
}


// Load a page dynamically
function loadPage(pageName) {
  // Special case: Settings is a modal
  if (pageName === 'settings') {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('hidden');
    return; // skip fetching, skip routing
  }

  const route = routes[pageName];
  if (!route) {
    console.warn(`No route defined for: ${pageName}`);
    return;
  }

  fetch(route, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(res => res.text())
    .then(html => {
      const main = document.getElementById('mainContent');
      main.innerHTML = html;

      // Re-run any <script> tags inside the injected HTML
      main.querySelectorAll("script").forEach(oldScript => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        document.body.appendChild(newScript);
        oldScript.remove();
      });

      // Run page-specific logic after dependencies are loaded
      runPageScripts(pageName);
    })
    .catch(err => {
      console.error(`❌ Failed to load ${pageName}:`, err);
    });
}

// Handle navigation clicks
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = e.target.closest('.nav-link');
        const page = target?.getAttribute('data-page');

        if (!page) return;

        // If it's settings, just open modal (no hash update)
        if (page === 'settings') {
          loadPage('settings');
          return;
        }

        // Update navbar active styles (from navi.js)
        document.querySelectorAll("a.nav-link").forEach(nav => {
          nav.classList.remove("text-white", "font-semibold", "border-b-2", "border-blue-500");
          nav.classList.add("text-gray-300");
        });
        target.classList.remove("text-gray-300");
        target.classList.add("text-white", "font-semibold", "border-b-2", "border-blue-500");

        loadPage(page);
        history.pushState(null, '', `#${page}`);
      });
  });

  // Load default page
  const initialPage = window.location.hash?.substring(1) || 'dashboard';
  if (initialPage !== 'settings') {
    loadPage(initialPage);
  }
});

function runPageScripts(pageName) {
  // Wait for dependencies before running page-specific logic
  function waitForDeps(deps, cb) {
    let interval = setInterval(() => {
      if (deps.every(dep => typeof window[dep] !== 'undefined')) {
        clearInterval(interval);
        cb();
      }
    }, 30);
  }

  if (pageName === 'dashboard') {
    waitForDeps(['ol', 'Sortable'], () => {
      // Dynamically load dashboard-specific scripts only once
      if (!document.querySelector('script[src$="mapControl.js"]')) {
        const mapScript = document.createElement('script');
        mapScript.src = '/static/mapControl.js';
        mapScript.defer = true;
        document.body.appendChild(mapScript);
      }
      if (!document.querySelector('script[src$="controller.js"]')) {
        const controllerScript = document.createElement('script');
        controllerScript.src = '/static/controller.js';
        controllerScript.defer = true;
        document.body.appendChild(controllerScript);
      }
      // Add more dashboard-specific scripts here if needed
    });
  }

  if (pageName === 'patrol') {
    waitForDeps(['ol', 'dayjs'], () => {
      // Load mapControl.js if not already loaded
      if (!document.querySelector('script[src$="mapControl.js"]')) {
        const mapScript = document.createElement('script');
        mapScript.src = '/static/mapControl.js';
        mapScript.defer = true;
        document.body.appendChild(mapScript);
      }
      // Load patrol.js if not already loaded
      if (!document.querySelector('script[src$="patrol.js"]')) {
        const patrolScript = document.createElement('script');
        patrolScript.src = '/static/patrol.js';
        patrolScript.defer = true;
        document.body.appendChild(patrolScript);
      }
      // Example: If Sortable is needed for patrol
      if (typeof Sortable !== 'undefined') {
        const el = document.getElementById('schedule-list');
        if (el) {
          new Sortable(el, {
            animation: 150,
            ghostClass: 'bg-gray-600'
          });
        }
      }
      // Example: Calendar logic (only if elements exist)
      const calendarEl = document.getElementById('calendar');
      const monthLabel = document.getElementById('monthLabel');
      if (calendarEl && monthLabel && typeof dayjs !== 'undefined') {
        const today = dayjs();
        let currentMonth = today.startOf('month');
        function renderCalendar(date) {
          calendarEl.innerHTML = '';
          monthLabel.textContent = date.format('MMMM YYYY');
          const startDay = date.startOf('month').day();
          const daysInMonth = date.daysInMonth();
          for (let i = 0; i < startDay; i++) {
            calendarEl.innerHTML += `<div></div>`;
          }
          for (let i = 1; i <= daysInMonth; i++) {
            calendarEl.innerHTML += `<div class="bg-gray-800 hover:bg-gray-600 rounded py-1">${i}</div>`;
          }
        }
        document.getElementById('prevMonth')?.addEventListener('click', () => {
          currentMonth = currentMonth.subtract(1, 'month');
          renderCalendar(currentMonth);
        });
        document.getElementById('nextMonth')?.addEventListener('click', () => {
          currentMonth = currentMonth.add(1, 'month');
          renderCalendar(currentMonth);
        });
        renderCalendar(currentMonth);
      }
      // If patrol map init function exists
      if (typeof initPatrolMap === 'function') {
        initPatrolMap();
      }
    });
  }
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const page = window.location.hash?.substring(1) || 'dashboard';
  if (page !== 'settings') {
    loadPage(page);
  }
});

// Close settings modal and clear hash if any
document.addEventListener('click', e => {
  if (e.target.id === 'closeSettings' || e.target.classList.contains('close-settings')) {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('hidden');
    history.pushState(null, '', window.location.pathname); // reset URL
  }
});
