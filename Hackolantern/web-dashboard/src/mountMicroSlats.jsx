import React from 'react';
import ReactDOM from 'react-dom/client';
import MicroSlats from './MicroSlats';

export function renderMicroSlats(container, props = {}) {
  if (!container) return null;
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(MicroSlats, props));
  return root;
}

if (typeof window !== 'undefined') {
  window.renderMicroSlats = renderMicroSlats;
}
