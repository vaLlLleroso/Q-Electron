// Ensure the loadPage function is globally available
if (typeof loadPage !== 'function' && typeof window.loadPage === 'function') {
  var loadPage = window.loadPage;
}

document.querySelectorAll("a.nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();

    const page = link.getAttribute("data-page");
    if (!page) return;

    // Load the correct page content
    if (typeof loadPage === 'function') {
      loadPage(page);
    }

    // Update navbar active styles
    document.querySelectorAll("a.nav-link").forEach(nav => {
      nav.classList.remove("text-white", "font-semibold", "border-b-2", "border-blue-500");
      nav.classList.add("text-gray-300"); // reset
    });

    link.classList.remove("text-gray-300");
    link.classList.add("text-white", "font-semibold", "border-b-2", "border-blue-500");
  });
});
