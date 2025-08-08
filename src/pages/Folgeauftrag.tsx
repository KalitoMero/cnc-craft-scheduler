import { useEffect, useState } from "react";
import PartFamilyForm from "@/components/PartFamilyForm";
import PartFamilyList from "@/components/PartFamilyList";

const Folgeauftrag = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  // Minimal SEO setup
  useEffect(() => {
    const title = "Teilefamilie erstellen & verwalten";
    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Teilefamilie erstellen: Name eingeben, Bauteile hinzufügen und speichern. Übersicht aller Teilefamilien.");
    if (!metaDesc.parentNode) document.head.appendChild(metaDesc);

    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", window.location.href);
    if (!canonical.parentNode) document.head.appendChild(canonical);
  }, []);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Folgeauftrag/Teilefamilie</h1>
        <p className="text-muted-foreground">Verwalten Sie Teilefamilien und Bauteile.</p>
      </header>

      <section aria-labelledby="create-family">
        <h2 id="create-family" className="sr-only">Neue Teilefamilie anlegen</h2>
        <PartFamilyForm onCreated={() => setRefreshKey((k) => k + 1)} />
      </section>

      <section aria-labelledby="family-list">
        <h2 id="family-list" className="sr-only">Bestehende Teilefamilien</h2>
        <PartFamilyList refreshKey={refreshKey} />
      </section>
    </main>
  );
};

export default Folgeauftrag;
