import { defineConfig } from 'vite';
import { spawn } from 'child_process';

export default defineConfig({
  root: 'src/',
  server: {
    port: 3000,
  },
  plugins: [
    {
      name: 'backend-server',
      configureServer() {
        let backendProcess;

        return () => {
          // Start the backend server
          if (!backendProcess) {
            console.log('Starting backend server...');
            backendProcess = spawn('node', ['server/server.js'], {
              stdio: 'inherit',
              shell: true, // Ensures compatibility with different platforms
            });

            // Kill backend process when Vite stops
            process.on('exit', () => {
              if (backendProcess) backendProcess.kill();
            });
          }
        };
      },
    },
  ],
});
