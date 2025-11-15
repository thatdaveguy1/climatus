// Prebuilt client bundle (ES module)
// This minimal bundle uses the importmap in index.html to resolve "react" and "react-dom/client" to CDN URLs.
// It avoids JSX by using React.createElement so no compilation is required.
import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [status, setStatus] = React.useState(null);
  const [health, setHealth] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    fetch('/api/accuracy/status')
      .then(r => r.json())
      .then(data => { if (mounted) setStatus(data); })
      .catch(() => { if (mounted) setStatus({ error: 'unavailable' }); });

    fetch('/api/health')
      .then(r => r.json())
      .then(data => { if (mounted) setHealth(data); })
      .catch(() => { if (mounted) setHealth({ status: 'error' }); });

    return () => { mounted = false; };
  }, []);

  return React.createElement('div', { style: { fontFamily: 'system-ui, -apple-system, Roboto, "Helvetica Neue", Arial', padding: 20 } },
    React.createElement('h1', { style: { fontSize: '1.5rem', marginBottom: '0.75rem' } }, 'Climatus'),
    React.createElement('p', null, 'A server-hosted Climatus client bundle.'),
    React.createElement('div', { style: { marginTop: 12 } },
      React.createElement('h2', null, 'API status'),
      status ? React.createElement('pre', null, JSON.stringify(status, null, 2)) : React.createElement('div', null, 'Loading...')
    ),
    React.createElement('div', { style: { marginTop: 12 } },
      React.createElement('h2', null, 'Health'),
      health ? React.createElement('pre', null, JSON.stringify(health, null, 2)) : React.createElement('div', null, 'Loading...')
    )
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(React.createElement(App));
} else {
  console.error('Root element not found');
}
