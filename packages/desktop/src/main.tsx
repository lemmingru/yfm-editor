import React from 'react';
import ReactDOM from 'react-dom/client';

// Editor + vendor + runtime styles (gravity-ui, diplodoc, KaTeX, Mermaid).
import '@yfm-editor/core/styles';
// Desktop shell chrome (window layout, status bar, reload banner, prefs modal).
import './styles.css';

import {App} from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
