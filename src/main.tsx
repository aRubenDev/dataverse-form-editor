import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { EditorProvider } from './state/EditorContext';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <EditorProvider>
        <App />
      </EditorProvider>
    </AuthProvider>
  </StrictMode>,
);
