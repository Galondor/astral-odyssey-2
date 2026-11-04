import { useEffect, useState } from "react";

export default function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 1000px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1000px)");
    const change = (event) => setMobile(event.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return mobile;
}
