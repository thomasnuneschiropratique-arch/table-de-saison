# Table de saison

Les repas de l'année (midis en solo, dîners avec Anna, matins de sport), sains, de saison, rapides à préparer, avec des listes de courses en paquets entiers et un suivi anti-gaspillage.

- **L'app** : https://thomasnuneschiropratique-arch.github.io/table-de-saison/
- **L'année en tableau** : [repas-de-l-annee.md](repas-de-l-annee.md) · [repas-de-l-annee.csv](repas-de-l-annee.csv)
- **Toutes les listes de courses** : [listes-de-courses.md](listes-de-courses.md)

## L'installer sur le téléphone

- **iPhone** : ouvre le lien dans Safari → bouton Partager → « Sur l'écran d'accueil ».
- **Android** : ouvre le lien dans Chrome → menu ⋮ → « Installer l'application ».

Elle s'ouvre ensuite en plein écran, comme une appli, et fonctionne même sans réseau.

## Activer le partage avec Anna (Firebase, gratuit)

Sans cette étape, l'app marche, mais chaque téléphone garde ses propres cases cochées et sa liste « Il manque ».

1. Va sur https://console.firebase.google.com, connecte-toi avec un compte Google et clique **Créer un projet** (nom : `table-de-saison`, Google Analytics inutile).
2. Menu **Build → Authentication → Commencer**, onglet **Sign-in method** : active **Anonyme**.
3. Menu **Build → Firestore Database → Créer une base de données**, emplacement `eur3 (europe-west)`, démarrer en **mode production**.
4. Onglet **Règles** de Firestore : remplace tout par le texte ci-dessous, en mettant ton code du foyer à la place de `TON-CODE-DU-FOYER`, puis **Publier** :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /foyers/TON-CODE-DU-FOYER/{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

5. Roue crantée **Paramètres du projet → Général → Vos applications → icône `</>`** (application Web), nom `table-de-saison`, sans Hosting. Firebase affiche un bloc `const firebaseConfig = { ... }` : copie ce qu'il y a entre les accolades.
6. Colle-le dans [docs/config.js](docs/config.js) à la place de `null` :

   ```js
   window.FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   ```

   Cette configuration n'est pas un secret, elle peut être publique. Le code du foyer, lui, ne doit pas être dans le dépôt : il n'est que dans les règles Firestore et sur vos téléphones.
7. Republie (voir plus bas). Au premier lancement, chaque téléphone demande le **code du foyer** (le même pour vous deux) et le prénom.

## Modifier l'app

La source est [table-de-saison.html](table-de-saison.html). Après une modification :

```bash
node construire-site.mjs
git add -A && git commit -m "Mise à jour" && git push
```

GitHub Pages republie le site en une minute environ.
