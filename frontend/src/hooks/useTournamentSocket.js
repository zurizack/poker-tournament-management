import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "../lib/api";

// Connects to one tournament's room. Pass a token for manager pages (enables
// manager:* actions); omit it for the anonymous, read-only player view.
export function useTournamentSocket({ tournamentId, token }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  // `error`: terminal — the server rejected the join (bad PIN, no such
  // tournament). `connectionIssue`: transient — the socket itself can't
  // reach the server (wrong SERVER_URL, a CORS rejection, a sleeping Render
  // instance); socket.io keeps auto-retrying, so this clears on reconnect.
  const [error, setError] = useState(null);
  const [connectionIssue, setConnectionIssue] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!tournamentId) return;

    setState(null);
    setError(null);
    setConnectionIssue(null);

    const socket = io(SERVER_URL, { auth: token ? { token } : undefined });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setConnectionIssue(null);
    });
    socket.on("disconnect", () => setConnected(false));
    // Without this, a socket that never connects leaves the UI stuck on
    // "Connecting..." forever — the join ack below is the only other place
    // state gets set here, and it never fires if the connection itself fails.
    socket.on("connect_error", (err) => {
      setConnectionIssue(`Couldn't reach the tournament server (${err.message}). Retrying...`);
    });
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

  return { state, connected, error, connectionIssue, sendManagerAction };
}
