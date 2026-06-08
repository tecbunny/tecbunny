/**
 * TecBunny Secure Widget Launcher
 * public/embed/tecbunny-widget.js
 */
(function() {
  const SCRIPT_NAME = 'tecbunny-widget.js';
  const BASE_URL = 'https://tecbunny.com';
  
  const init = () => {
    const containers = document.querySelectorAll('[data-tecbunny-widget]');
    
    containers.forEach(container => {
      if (container.dataset.initialized) return;
      
      const refId = container.getAttribute('data-ref-id');
      const variant = container.getAttribute('data-variant') || 'configurator';
      
      if (!refId) {
        console.error('[TecBunny] Missing data-ref-id for embed widget.');
        return;
      }

      // Build Secure Sandbox Iframe
      const iframe = document.createElement('iframe');
      iframe.src = `${BASE_URL}/embed/${variant}?ref=${refId}&origin=${encodeURIComponent(window.location.origin)}`;
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '12px';
      iframe.style.overflow = 'hidden';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allow', 'payment; clipboard-write');
      
      // Responsive Height Handler via postMessage
      window.addEventListener('message', (event) => {
        if (event.origin !== BASE_URL) return;
        if (event.data.type === 'TECBUNNY_RESIZE') {
          iframe.style.height = `${event.data.height}px`;
        }
        if (event.data.type === 'TECBUNNY_TELEMETRY') {
          console.debug('[TecBunny Telemetry]', event.data.payload);
        }
      });

      container.innerHTML = '';
      container.appendChild(iframe);
      container.dataset.initialized = 'true';
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
