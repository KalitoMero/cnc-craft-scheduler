import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Folgeauftrag = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Folgeauftrag/Teilefamilie</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Folgeaufträge und Teilefamilien
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Folgeauftrag/Teilefamilie</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Diese Seite ist in Entwicklung. Hier können Sie zukünftig Folgeaufträge und Teilefamilien verwalten.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Folgeauftrag;