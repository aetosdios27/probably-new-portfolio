import PersonalPage from "./about/personal-page";

export default function HomePage() {
  return (
    <>
      {/* React hoists this into <head> in the server-rendered HTML. */}
      <link rel="me" href="https://portfolios.here/aetos" />
      <PersonalPage />
    </>
  );
}
