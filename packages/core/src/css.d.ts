// Allow CSS side-effect imports (e.g. `import './editor.css'`) to typecheck
// under bundlers that don't emit types for stylesheet modules.
declare module '*.css';
