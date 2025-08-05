import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const SettingsPanel = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMachineMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const { error } = await supabase
        .from("machines")
        .insert([
          {
            name: data.name,
            description: data.description || null,
          },
        ]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Maschine erstellt",
        description: "Die Maschine wurde erfolgreich erstellt.",
      });
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Maschine konnte nicht erstellt werden.",
        variant: "destructive",
      });
      console.error("Error creating machine:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    createMachineMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neue Maschine erstellen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="machine-name">Name der Maschine</Label>
            <Input
              id="machine-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maschinen-Name eingeben"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="machine-description">Beschreibung (optional)</Label>
            <Textarea
              id="machine-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung der Maschine"
              rows={3}
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={!name.trim() || createMachineMutation.isPending}
          >
            {createMachineMutation.isPending ? "Erstelle..." : "Maschine erstellen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};