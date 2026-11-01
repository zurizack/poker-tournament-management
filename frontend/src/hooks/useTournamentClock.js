import { useCallback, useEffect, useState } from "react";
import { socket } from "../socket";

export function useTournamentClock() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function handleStateUpdate(nextState) {
      setState(nextState);
    }

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("state:update", handleStateUpdate);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state:update", handleStateUpdate);
    };
  }, []);

  const start = useCallback(() => socket.emit("control:start"), []);
  const pause = useCallback(() => socket.emit("control:pause"), []);
  const reset = useCallback(() => socket.emit("control:reset"), []);
  const skipLevel = useCallback(() => socket.emit("control:skipLevel"), []);
  const previousLevel = useCallback(() => socket.emit("control:previousLevel"), []);

  return { state, connected, start, pause, reset, skipLevel, previousLevel };
}
