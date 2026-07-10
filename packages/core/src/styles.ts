// Aggregated stylesheet + runtime CSS for the YFM editor, imported once by any
// platform shell via `@yfm-editor/core/styles`. Keeps every consumer in sync
// with the exact set of vendor styles the editor and preview rely on.

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
// Mermaid zoom controls for diagrams rendered in split preview.
import '@diplodoc/mermaid-extension/styles/zoom.css';

// Editor layout, preview, and dark-theme code overrides shared across platforms.
import './editor.css';
