import React from 'react';
import ReactDOM from 'react-dom/client';

// Gravity UI base styles + fonts.
import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
// Markdown editor styles (wysiwyg, markup, yfm overrides).
import '@gravity-ui/markdown-editor/styles/styles.css';
// YFM + extension runtime styles, used by the split-mode HTML preview.
import '@diplodoc/transform/dist/css/yfm.css';
import '@diplodoc/cut-extension/runtime/styles.css';
import '@diplodoc/tabs-extension/runtime/styles.css';
// KaTeX / LaTeX styles (editor math nodes + split-preview formulas).
import '@diplodoc/latex-extension/runtime/styles';

import './styles.css';

import {App} from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
