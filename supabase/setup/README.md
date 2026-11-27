# Kalender-Testbranch
Die Live-Datenbank und IONOS werden durch diese PR nicht geändert. Die bisherige App lädt auch ohne die neue Spalte; Endzeiten können erst nach dem SQL-Setup gespeichert werden.
1. Testprojekt mit den bestehenden events/calendar_members Tabellen und Policies einrichten. Für isolierte Tests die URL und den Publishable Key in src/app/services/supabase.service.ts lokal ersetzen (niemals Service Role im Browser).
2. calendar-upgrades.sql im Testprojekt ausführen. Für Produktion später als reguläre Supabase-Migration übernehmen. Die SQL-Datei ist noch nicht angewendet.
3. Ein eigenes VAPID-Schlüsselpaar erzeugen (z.B. web-push generate-vapid-keys). VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: eigene Kontaktadresse) und ein starkes zufälliges CALENDAR_WEBHOOK_SECRET als Edge Function Secrets hinterlegen. Keine privaten Schlüssel in Git.
4. calendar-push deployen mit --no-verify-jwt. Die Funktion gibt nur den öffentlichen Schlüssel ohne Webhook-Secret aus. Für Versand wird das Webhook-Secret geprüft.
5. Database Webhook für INSERT auf public.events, POST an die calendar-push Edge Function, Content-Type application/json, x-calendar-webhook-secret mit dem passenden Secret. Secret nur im Dashboard hinterlegen, nicht im Repo.
6. Mit zwei Testkonten auf zwei Android-Geräten unter HTTPS prüfen: Glocke einschalten, neuen Termin anlegen, Gegenüber erhält genau eine Nachricht, Ersteller keine; Bearbeiten/Löschen löst nichts aus; bei Abmeldung wird das Gerät abgemeldet. Benachrichtigung enthält absichtlich keinen Termintitel.
7. Prüfe Ganztägig, einzelne Uhrzeit, Zeitspanne, Bearbeiten/Entfernen einer Endzeit und ungültige Spannen. Über Mitternacht wird nicht unterstützt.
Der Versand ist best effort: Duplikate werden verhindert, fehlgeschlagene Sendungen werden nicht automatisch wiederholt. Musikwechsel fehlt noch (Audiodatei nicht im Repository).
