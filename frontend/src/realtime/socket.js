import { io } from "socket.io-client";
import { baseURL } from "../api/api";

let socket;

export function getRealtimeSocket() {
  if (socket) return socket;

  socket = io(baseURL, {
    transports: ["websocket", "polling"],
    withCredentials: true,
  });

  return socket;
}

export function subscribeDataUpdated(handler) {
  const s = getRealtimeSocket();
  s.on("data:updated", handler);
  return () => s.off("data:updated", handler);
}