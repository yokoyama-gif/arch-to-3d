import { useState } from "react";
import SkyFactorPage from "./pages/SkyFactorPage";
import ExteriorEstimatePage from "./pages/ExteriorEstimatePage";

type Page = "estimate" | "skyfactor";

export default function App() {
  const [page, setPage] = useState<Page>("estimate");

  return (
    <>
      <nav className="app-nav">
        <button
          type="button"
          className={`app-nav-item ${page === "estimate" ? "app-nav-item--active" : ""}`}
          onClick={() => setPage("estimate")}
        >
          外構費用積算
        </button>
        <button
          type="button"
          className={`app-nav-item ${page === "skyfactor" ? "app-nav-item--active" : ""}`}
          onClick={() => setPage("skyfactor")}
        >
          天空率検討
        </button>
      </nav>
      {page === "estimate" ? <ExteriorEstimatePage /> : <SkyFactorPage />}
    </>
  );
}
