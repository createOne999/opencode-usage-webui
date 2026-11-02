# Tableau de bord d’utilisation d’OpenCode

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

Un tableau de bord web local et léger pour **OpenCode V2**, qui vous permet d’explorer dans votre navigateur l’utilisation des tokens, les coûts des modèles, les performances des outils et le contexte de session pour chaque requête.

Exécutez **`/usage-dashboard`** dans OpenCode Mini ou dans la TUI complète pour ouvrir le tableau de bord. Il s’exécute dans le processus du plug-in OpenCode, sans base de données supplémentaire ni démon en arrière-plan.

![OpenCode Usage Dashboard](screenshot.png)

## Ce que vous pouvez explorer

- **Vue d’ensemble (`/stats`) :** nombre total de tokens, coût enregistré en USD, sessions, Steps des modèles, activité quotidienne, répartition des tokens et tendances journalières des tokens à la demande.
- **Modèles (`/models`) :** graphiques et tableaux des tokens et des coûts par fournisseur, modèle et variant — avec tri par nombre de tokens, coût, Steps ou nom du modèle.
- **Outils (`/tools`) :** volume d’appels, nombres de réussites, d’échecs et d’appels incomplets, ainsi que le temps d’exécution médian (`P50`) de chaque outil.
- **Sessions et contexte des requêtes (`/sessions`) :** recherchez des sessions par titre, naviguez entre les sessions parentes et enfants, consultez les chronologies de tokens et de coûts par requête, et affichez l’historique enregistré avant tout Step sélectionné.

## Démarrage rapide

Ajoutez le plug-in à votre fichier `opencode.json` :

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Exécutez ensuite **`/usage-dashboard`** dans OpenCode pour ouvrir le tableau de bord dans votre navigateur par défaut, ou accédez directement à <http://127.0.0.1:7331/stats> (`http://localhost:7331/stats` et `http://[::1]:7331/stats` fonctionnent également).

### Personnaliser le port

Le port par défaut est `7331`. Si vous exécutez plusieurs projets simultanément ou souhaitez utiliser un autre port, définissez `options.port` (utilisez `0` pour choisir automatiquement un port disponible) :

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Utiliser le tableau de bord

- **Filtres de date et de projet :** les filtres sont définis par défaut sur le mois en cours et le projet actuel, selon le fuseau horaire de votre navigateur (date de fin incluse). Vous pouvez à tout moment choisir **Tous les projets** ou un projet spécifique.
- **Interface multilingue :** changez de langue à l’aide du sélecteur en haut de page. La langue choisie (`?lang=...`), la période, le filtre de projet et le lien vers la requête active restent dans l’URL ; vous pouvez ainsi facilement enregistrer une vue dans vos favoris ou l’actualiser.
- **Répartition journalière des tokens :** sur la page Vue d’ensemble, cliquez sur **Charger les tokens journaliers** pour afficher les graphiques quotidiens des tokens d’entrée, de sortie, de raisonnement et de lecture/écriture du cache pour la période sélectionnée.
- **Inspecter le contexte d’une requête :**
  1. Ouvrez **Sessions / requêtes** et sélectionnez une session (utilisez le badge ou la section **Sessions enfants** pour passer d’une session de sous-agent associée à une autre).
  2. Cliquez sur un point du graphique des requêtes ou sur un horodatage dans le tableau des requêtes.
  3. Parcourez **Historique enregistré avant la requête** (notamment les demandes de l’utilisateur, les réponses précédentes, les appels d’outils, les compétences et les résumés de compactage) à côté de **Réponse à la requête sélectionnée**.
  4. Cliquez sur **Charger 100 entrées d’historique supplémentaires** pour consulter les messages précédents d’une longue session.

### Informations utiles sur les métriques

- **Nombre de tokens :** affiché dans des unités compactes `K`, `M`, `B` et `T` (avec jusqu’à deux décimales), tandis que le tri et les totaux utilisent les valeurs exactes. Le nombre total de tokens correspond à `input + output + reasoning + cache.read + cache.write`.
- **Estimations des coûts :** les coûts sont indiqués en USD et calculés à partir de l’utilisation communiquée par le fournisseur et des tarifs du catalogue de modèles, à titre indicatif.
- **Vue du contexte enregistré :** l’inspecteur de requêtes reconstitue le contexte à partir de l’historique de session enregistré et des limites de compactage achevées jusqu’au Step sélectionné.

## Conçu pour rester local et privé

- **Boucle locale uniquement :** le serveur est strictement lié à la boucle locale (`127.0.0.1` et `::1`) et valide les en-têtes de même origine afin que vos données d’utilisation restent accessibles uniquement sur votre machine.
- **Aucun stockage supplémentaire ni télémétrie :** les données sont lues à la demande depuis le service partagé OpenCode V2 en cours d’exécution sur votre machine. Les ressources de l’interface et les traductions sont intégrées localement, sans CDN externe, analytique ni fichier de données supplémentaire. Pour désinstaller le plug-in, supprimez simplement son entrée de `opencode.json`.

## Exécuter depuis les sources

Conçu pour OpenCode **2.2.0** et Bun **1.4.2**. Depuis la racine du dépôt :

```powershell
bun run setup
opencode mini
# Inside OpenCode: /usage-dashboard
```

Si vous travaillez dans un environnement distant, WSL ou sans interface graphique où un navigateur ne peut pas s’ouvrir automatiquement, vérifiez l’URL active du tableau de bord et son état de disponibilité depuis votre terminal :

```powershell
bun run status
```

### Vérifications de développement

```powershell
bun run build
bun run typecheck
bun run test
```

## Licence

Sous licence MIT. Consultez [LICENSE](LICENSE) pour plus de détails.
