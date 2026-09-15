import { webApp } from "./max/bridge";

export function App() {
  const user = webApp?.initDataUnsafe.user;
  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>MAX Events</h1>
      <p>{user ? `Привет, ${user.first_name}!` : "Откройте приложение внутри MAX, чтобы авторизоваться."}</p>
    </main>
  );
}
