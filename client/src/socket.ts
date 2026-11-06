import { io } from 'socket.io-client';

// Empty = same origin (Vite dev proxy, nginx in Docker, or the Node server serving the build).
export const apiUrl: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const socket = io(apiUrl || undefined, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000
});
