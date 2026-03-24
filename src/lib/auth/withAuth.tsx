import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "./AuthContext";

/**
 * Wraps a page component and redirects to /login if no active session.
 * Shows a minimal full-screen loader while the session is being hydrated.
 */
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedPage(props: P) {
    const { session, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !session) {
        router.replace("/login");
      }
    }, [loading, session, router]);

    if (loading || !session) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "#f7f5f2",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: "linear-gradient(135deg, #2563eb18, #2563eb0a)",
              border: "1.5px solid #bfcffd",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>⚡</div>
            <span style={{ fontSize: 12, color: "#9a9086", letterSpacing: "0.1em",
              fontFamily: "monospace", fontWeight: 500 }}>
              LOADING…
            </span>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
