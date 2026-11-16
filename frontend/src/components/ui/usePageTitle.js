import { useEffect } from "react";

export default function usePageTitle(title) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | CapyTOEIC`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
