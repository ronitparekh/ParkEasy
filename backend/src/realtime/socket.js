import { Server } from "socket.io";

let io = null;

export function initSocket(server, { cors } = {}) {
  io = new Server(server, {
    cors: cors || { origin: "*" },
  });

  io.on("connection", () => {
    // Connection intentionally lightweight.
  });

  return io;
}

export function emitDataUpdated(payload = {}) {
  if (!io) return;
  io.emit("data:updated", {
    ts: Date.now(),
    ...payload,
  });
}

export function getSocket() {
  return io;
}