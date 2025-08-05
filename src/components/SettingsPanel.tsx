import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RefreshCw, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Setting {
  key: string;
  value: any;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'textarea';
}

interface ExcelColumnConfig {
  id: string;
  columnNumber: number;
  displayName: string;
}

const defaultSettings: Setting[] = [
  {
    key: 'auto_refresh_interval',
    value: 30,
    description: 'Automatische Aktualisierung der Aufträge (Sekunden)',
    type: 'number'
  },
  {
    key: 'show_completed_orders',
    value: true,
    description: 'Abgeschlossene Aufträge anzeigen',
    type: 'boolean'
  },
  {
    key: 'max_orders_per_machine',
    value: 50,
    description: 'Maximale Anzahl Aufträge pro Maschine',
    type: 'number'
  },
  {
    key: 'company_name',
    value: 'Meine Firma',
    description: 'Firmenname',
    type: 'text'
  },
  {
    key: 'notification_settings',
    value: 'Bei Status-Änderungen und neuen Aufträgen benachrichtigen',
    description: 'Benachrichtigungseinstellungen',
    type: 'textarea'
  },
  {
    key: 'ba_column_number',
    value: 1,
    description: 'Spalte für BA-Nummer (Betriebsauftragsnummer)',
    type: 'number'
  },
  {
    key: 'machine_column_number',
    value: 2,
    description: 'Spalte für Maschinen',
    type: 'number'
  }
];

export function SettingsPanel() {
  const [settings, setSettings] = useState<Setting[]>(defaultSettings);
  const [extraColumns, setExtraColumns] = useState<ExcelColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchExtraColumns();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) throw error;

      // Merge fetched settings with defaults
      const updatedSettings = defaultSettings.map(defaultSetting => {
        const savedSetting = data?.find(s => s.setting_key === defaultSetting.key);
        if (savedSetting) {
          return {
            ...defaultSetting,
            value: savedSetting.setting_value
          };
        }
        return defaultSetting;
      });

      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExtraColumns = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('setting_key', 'extra_columns');

      if (error) throw error;

      if (data && data.length > 0) {
        setExtraColumns((data[0].setting_value as unknown as ExcelColumnConfig[]) || []);
      }
    } catch (error) {
      console.error('Error fetching extra columns:', error);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => prev.map(setting => 
      setting.key === key ? { ...setting, value } : setting
    ));
  };

  const addExtraColumn = () => {
    const newColumn: ExcelColumnConfig = {
      id: Date.now().toString(),
      columnNumber: 1,
      displayName: 'Neue Spalte'
    };
    setExtraColumns(prev => [...prev, newColumn]);
  };

  const removeExtraColumn = (id: string) => {
    setExtraColumns(prev => prev.filter(col => col.id !== id));
  };

  const updateExtraColumn = (id: string, field: keyof ExcelColumnConfig, value: string | number) => {
    setExtraColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const settingsToSave = settings.map(setting => ({
        setting_key: setting.key,
        setting_value: setting.value,
        description: setting.description
      }));

      // Save extra columns
      settingsToSave.push({
        setting_key: 'extra_columns',
        setting_value: extraColumns,
        description: 'Zusätzliche Excel-Spalten Konfiguration'
      });

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('settings')
          .upsert(setting, { onConflict: 'setting_key' });

        if (error) throw error;
      }

      toast({
        title: "Erfolgreich",
        description: "Einstellungen wurden gespeichert.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Sind Sie sicher, dass Sie alle Einstellungen zurücksetzen möchten?')) {
      setSettings(defaultSettings);
      toast({
        title: "Zurückgesetzt",
        description: "Einstellungen wurden auf Standardwerte zurückgesetzt.",
      });
    }
  };

  const renderSettingInput = (setting: Setting) => {
    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={setting.value}
              onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
            />
            <Label>{setting.description}</Label>
          </div>
        );
      
      case 'number':
        return (
          <div className="space-y-2">
            <Label>{setting.description}</Label>
            <Input
              type="number"
              value={setting.value}
              onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value) || 0)}
            />
          </div>
        );
      
      case 'textarea':
        return (
          <div className="space-y-2">
            <Label>{setting.description}</Label>
            <Textarea
              value={setting.value}
              onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            />
          </div>
        );
      
      default:
        return (
          <div className="space-y-2">
            <Label>{setting.description}</Label>
            <Input
              value={setting.value}
              onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Einstellungen</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Zurücksetzen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Speichere...' : 'Speichern'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">Allgemeine Einstellungen</TabsTrigger>
          <TabsTrigger value="excel">Excel-Spalten</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6">
            {settings.map((setting) => (
              <Card key={setting.key}>
                <CardHeader>
                  <CardTitle className="text-lg">{setting.description}</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderSettingInput(setting)}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="excel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>BA-Nummer und Maschinen Konfiguration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Spalte für BA-Nummer (Betriebsauftragsnummer)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.find(s => s.key === 'ba_column_number')?.value || 1}
                    onChange={(e) => handleSettingChange('ba_column_number', parseInt(e.target.value) || 1)}
                    placeholder="Spaltennummer eingeben..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Geben Sie die Spaltennummer ein, in der sich die BA-Nummer befindet (z.B. 1 für Spalte A, 2 für Spalte B)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Spalte für Maschinen</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.find(s => s.key === 'machine_column_number')?.value || 2}
                    onChange={(e) => handleSettingChange('machine_column_number', parseInt(e.target.value) || 2)}
                    placeholder="Spaltennummer eingeben..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Geben Sie die Spaltennummer ein, in der sich die Maschinenbezeichnung befindet. Maschinen werden automatisch aus den Excel-Daten erstellt.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Zusätzliche Spalten</CardTitle>
                <Button onClick={addExtraColumn} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Spalte hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {extraColumns.length === 0 ? (
                  <p className="text-muted-foreground">
                    Keine zusätzlichen Spalten konfiguriert. Klicken Sie auf "Spalte hinzufügen" um eine neue Spalte zu definieren.
                  </p>
                ) : (
                  extraColumns.map((column) => (
                    <div key={column.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div>
                          <Label>Spaltennummer</Label>
                          <Input
                            type="number"
                            min="1"
                            value={column.columnNumber}
                            onChange={(e) => updateExtraColumn(column.id, 'columnNumber', parseInt(e.target.value) || 1)}
                            placeholder="z.B. 7"
                          />
                        </div>
                        <div>
                          <Label>Anzeigename</Label>
                          <Input
                            value={column.displayName}
                            onChange={(e) => updateExtraColumn(column.id, 'displayName', e.target.value)}
                            placeholder="z.B. Kunde, Material, etc."
                          />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeExtraColumn(column.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}