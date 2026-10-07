import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[BOOT] Entry point loaded');

const rootEl = document.getElementById('root');
const rootExists = !!rootEl;
console.log('[BOOT]\nReact root exists =', rootExists);

if (rootEl) {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (mountErr: any) {
    console.error('[BOOT CRITICAL] Exception before App render:', mountErr);
    rootEl.innerHTML = `
      <div style="min-height:100vh;background:#050B14;color:#F87171;font-family:sans-serif;padding:32px;direction:rtl;text-align:right;">
        <h2 style="color:#EF4444;font-size:22px;margin-bottom:8px;">تعذر إقلاع تطبيق React</h2>
        <p style="color:#E2E8F0;font-size:14px;margin-bottom:16px;">حدث خطأ أثناء تهيئة واجهة المستخدم:</p>
        <pre style="background:#0F172A;padding:16px;border-radius:8px;color:#FCA5A5;font-size:12px;overflow:auto;direction:ltr;text-align:left;">${mountErr?.stack || mountErr?.message || String(mountErr)}</pre>
      </div>
    `;
  }
} else {
  console.error('[BOOT ERROR] No root element found in DOM');
}
