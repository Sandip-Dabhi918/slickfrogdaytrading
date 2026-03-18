import "../styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "../lib/auth/AuthContext";
import CustomCursor from "../lib/cursor/CustomCursor";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}