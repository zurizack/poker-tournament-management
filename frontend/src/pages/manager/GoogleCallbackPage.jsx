import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get("token");
    const username = searchParams.get("username");
    if (token && username) {
      loginWithToken(token, username);
      navigate("/manager", { replace: true });
    } else {
      navigate("/manager/login?error=google_auth_failed", { replace: true });
    }
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
      Signing you in...
    </div>
  );
}
