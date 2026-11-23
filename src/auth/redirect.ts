import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// Página puente de MSAL v5: recoge la respuesta del login y se la entrega a la ventana principal.
broadcastResponseToMainFrame().catch((e) => {
  document.body.textContent = 'Error completando el inicio de sesión: ' + (e instanceof Error ? e.message : String(e));
});
