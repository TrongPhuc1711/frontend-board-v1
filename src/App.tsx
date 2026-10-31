import { Routes, Route } from "react-router-dom";
import { configured } from "./api";
import { DataProvider } from "./context/DataContext";
import BoardPage from "./components/BoardPage";
import RequestDetailPage from "./components/RequestDetailPage";

export default function App() {
  if (!configured()) {
    return (
      <main className="board-page">
        <div className="error-banner" role="alert">
          Save <code>HELPDESK_URL</code> and <code>HELPDESK_TOKEN</code> in{" "}
          <code>.env</code>, then restart <code>npm run dev</code>.
        </div>
      </main>
    );
  }

  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/request/:id" element={<RequestDetailPage />} />
      </Routes>
    </DataProvider>
  );
}
