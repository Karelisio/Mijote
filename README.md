# Mijote

Carnet de recettes personnel pour Android : 100 % hors ligne, Material You, import depuis le web, mode cuisine, planning de repas, liste de courses et envoi en un geste vers **Mago**.

## Fonctionnalités

- **Recettes** : photo, portions, temps, difficulté, catégorie, tags, source, notes, ingrédients structurés par sections, étapes avec minuteurs détectés automatiquement (« cuire 20 min » → bouton), note sur 5, favoris, compteur « cuisinée X fois ».
- **Portions** : recalcul avec arrondis intelligents (330 g, 1 ½ c. à soupe, 2 ½ œufs…).
- **Import** : lien web (JSON-LD schema.org, microdata, heuristiques Marmiton / 750g / CuisineAZ / blogs), « Partager vers Mijote » depuis le navigateur, texte collé. Écran de vérification, photo téléchargée et compressée localement.
- **Mode cuisine** : plein écran, écran allumé, gros texte, étapes au swipe, ingrédients cochables, minuteurs multiples avec notification en arrière-plan.
- **Organisation** : recherche plein texte (SQLite FTS5, insensible aux accents), filtres, collections, grille/liste, recette au hasard, « Qu'est-ce que je peux cuisiner ? ».
- **Planning & courses** : planning hebdo, liste générée depuis une recette ou la semaine, quantités fusionnées et converties, regroupées par rayon.
- **Mago** : bouton « Envoyer dans Mago » (recette, planning, liste) via deep link `mago://import`, fusion des doublons, correspondance des catégories, liste cible par défaut, repli en partage texte si Mago est absent.
- **Partage & sauvegarde** : texte formaté ou jolie carte image, export/import `.zip` (JSON + photos), sauvegarde automatique quotidienne (5 dernières conservées).
- **UI** : Material 3, couleurs dynamiques Android 12+ (repli sur couleur de base), thème clair/sombre/système, edge-to-edge, FR/EN, raccourcis d'app (Nouvelle recette, Liste de courses).

## Stack

Vite · React 18 · TypeScript strict · Capacitor 8 (Android) · SQLite (`@capacitor-community/sqlite`, FTS5) · Zustand · React Router · Framer Motion · Vitest.

```
src/
  db/          drivers SQLite (natif + wasm), migrations versionnées, dépôts, données d'exemple
  import/      parseurs d'import (JSON-LD, microdata, heuristiques, texte, lignes d'ingrédients)
  features/    recipes · cooking · planner · shopping · mago · import · backup · settings
  ui/          composants Material 3
  theme/       palette dynamique + styles globaux
  i18n/        fr / en (clés typées)
  config/      unités, rayons, correspondance catégories Mijote → Mago
  platform/    pont natif, images, partage, bouton retour
android/       projet natif (plugin MijoteNative, manifest, raccourcis, signature)
assets/        sources SVG de l'icône et du splash
```

## Développement

Prérequis : Node 22+, JDK 21, Android SDK (API 36) pour le natif.

```bash
npm install
npm run dev            # app dans le navigateur (SQLite wasm, proxy d'import en dev)
npm test               # Vitest
npm run lint && npm run typecheck
```

Sur Android :

```bash
npm run cap:sync       # build web + cap sync android
npx cap open android   # ou : npx cap run android --flavor github
```

Régénérer icônes et splash après modification de `assets/*.svg` :

```bash
npm run assets
```

## Variantes et mises à jour in-app

| Variante | Artefact                 | Mises à jour                                                                                                                                                          |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github` | APK de la GitHub Release | intégrées : au lancement (toutes les 12 h max) et depuis Réglages → Mises à jour, Mijote consulte la dernière release, télécharge l'APK et ouvre l'installeur Android |
| `play`   | AAB pour Google Play     | gérées par le Play Store (pas de permission `REQUEST_INSTALL_PACKAGES`)                                                                                               |

Au premier update, Android demande d'autoriser Mijote à « installer des applications inconnues » ; l'app y renvoie puis reprend l'installation. L'APK est signé avec la même clé à chaque release, condition pour qu'Android accepte la mise à jour.

## Intégration Mago

Mijote ouvre `mago://import?data=<payload>` où `payload` est du JSON encodé en **base64url** (UTF-8, sans padding) :

```json
{
  "version": 1,
  "source": "Mijote",
  "listName": "Courses",
  "items": [
    {
      "name": "Farine",
      "quantity": 450,
      "unit": "g",
      "category": "Pantry",
      "note": "",
      "recipeTitle": "Crêpes, Quiche"
    }
  ]
}
```

- `listName` est omis si aucune liste par défaut n'est réglée dans Mijote.
- `quantity` peut être `null` (« sel »), `unit` est un libellé lisible (« g », « c. à soupe »).
- Correspondance rayons → catégories Mago : `src/config/magoCategories.ts`.
- Côté Mago, déclarer un intent-filter `VIEW` sur le schéma `mago` / hôte `import` et décoder `data`.

## Release

La version (`versionName` / `versionCode`) est dérivée du tag git `vX.Y.Z` (`1.2.3` → `10203`).

### 1. Clé de signature (une seule fois)

```bash
keytool -genkeypair -v -keystore mijote-release.jks -alias mijote \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 mijote-release.jks > mijote-release.jks.b64   # macOS : base64 -i mijote-release.jks
```

Conservez le `.jks` et ses mots de passe en lieu sûr (hors du dépôt) : sans eux, impossible de publier une mise à jour.

### 2. Secrets GitHub (Settings → Secrets and variables → Actions)

| Secret                      | Valeur                              |
| --------------------------- | ----------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | contenu de `mijote-release.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore            |
| `ANDROID_KEY_ALIAS`         | `mijote`                            |
| `ANDROID_KEY_PASSWORD`      | mot de passe de la clé              |

### 3. Publier

```bash
git tag v1.0.0 && git push --tags
```

Le workflow `release.yml` lance lint + tests, construit l'APK et l'AAB signés et crée la GitHub Release avec le changelog des commits. Il peut aussi être lancé manuellement (Actions → Release → Run workflow).

`ci.yml` tourne sur chaque push/PR : lint, format, typecheck, tests, build web et build Android debug.
