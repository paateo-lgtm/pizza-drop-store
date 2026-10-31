# Legt den ersten Admin-Zugang in der Produktionsdatenbank (Neon-Zweig "production") an.
# Voraussetzung: Neon-CLI angemeldet (`neon login`). E-Mail, Name und Passwort werden abgefragt.
$ErrorActionPreference = "Stop"
$url = (neon connection-string production --project-id little-pine-70647821 --pooled | Out-String).Trim()
if (-not $url.StartsWith("postgres")) { throw "Keine Verbindungsadresse von der Neon-CLI erhalten." }
$env:DATABASE_URL = $url
try {
  npm run admin:create
} finally {
  Remove-Item Env:DATABASE_URL
}
