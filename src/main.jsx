import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { DrillStateProvider } from './contexts/DrillStateContext'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Pre-paint theme & manifest initialization to prevent flickering
(function() {
  const savedTheme = localStorage.getItem('ufstats_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const manifestEl = document.getElementById('manifest-link');
  if (manifestEl) {
    manifestEl.setAttribute('href', savedTheme === 'dark' ? '/manifest_dark.json' : '/manifest.json');
  }
  const themedIcon = savedTheme === 'dark' ? '/logo_dark_icon.png' : '/logo_light_icon.png';
  const faviconEl = document.getElementById('favicon-link');
  if (faviconEl) {
    faviconEl.setAttribute('href', themedIcon);
  }
  const appleTouchEl = document.getElementById('apple-touch-link');
  if (appleTouchEl) {
    appleTouchEl.setAttribute('href', themedIcon);
  }
})();

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AuthProvider>
      <DrillStateProvider>
        <App />
      </DrillStateProvider>
    </AuthProvider>
  </ErrorBoundary>
)
