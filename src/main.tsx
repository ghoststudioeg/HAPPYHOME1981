import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (import.meta.env.DEV) {
  const observer = new MutationObserver(() => {
    const emptySrcElements = Array.from(document.querySelectorAll('[src=""]'));
    if (emptySrcElements.length > 0) {
      console.error(
        '[IMAGE AUDIT] Empty src found:',
        emptySrcElements
      );
    }
  });
  observer.observe(document.documentElement, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['src'] 
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
