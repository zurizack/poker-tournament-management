import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "../lib/api";

// Connects to one tournament's room. Pass a token for manager pages (enables
// manager:* actions); omit it for the anonymous, read-only player view.
export function useTournamentSocket({ tournamentId, token }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!tournamentId) return;

    setState(null);
    setError(null);

    const socket = io(SERVER_URL, { auth: token ? { token } : undefined });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("tournament:state", setState);

    socket.emit("tournament:join", { tournamentId }, (ack) => {
      if (!ack?.ok) {
        setError(ack?.error || "Unable to join tournament");
        return;
      }
      setState(ack.state);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tournamentId, token]);

  const sendManagerAction = useCallback(
    (event, payload = {}) =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          reject(new Error("Not connected"));
          return;
        }
        socket.emit(event, { tournamentId, ...payload }, (ack) => {
          if (!ack?.ok) {
            reject(new Error(ack?.error || "Action failed"));
            return;
          }
          resolve(ack);
        });
      }),
    [tournamentId],
  );

  return { state, connected, error, sendManagerAction };
}
