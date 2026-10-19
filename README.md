# Élégance Végétal

Site e-commerce de fleurs, bouquets, plantes et compositions florales.

Ce dépôt contient les **fondations** du projet uniquement (structure, serveur Express, page d’accueil temporaire). Le catalogue, le panier, l’authentification, l’admin et les modèles de données seront ajoutés dans les étapes suivantes.

La documentation de cadrage se trouve dans [`elegance-vegetal-docs/`](./elegance-vegetal-docs/) — elle n’est pas modifiée par le code.

## Structure

```
elegance-vegetal/
├── elegance-vegetal-docs/   # Cadrage projet (source de vérité)
├── frontend/                # Site client — HTML, CSS, JavaScript
├── backend/                 # API REST — Node.js, Express, MongoDB
├── README.md
└── .gitignore
```

Frontend et backend restent strictement séparés. Ils communiqueront plus tard via l’API REST.

## Stack actuelle

| Couche | Technologie |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla), design responsive |
| Backend | Node.js, Express.js, MongoDB (Mongoose), dotenv, CORS |

## Prérequis

- [Node.js](https://nodejs.org/) (LTS recommandé)
- npm (fourni avec Node.js)
- MongoDB n’est **pas encore** utilisé à cette étape

## Lancer le backend

```bash
cd backend
npm install
npm run dev
```

Le serveur démarre sur [http://localhost:5000](http://localhost:5000).

Vérifier que l’API répond :

```bash
GET http://localhost:5000/api/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "message": "Élégance Végétal API is running"
}
```

Scripts npm :

| Commande | Rôle |
|---|---|
| `npm run dev` | Démarre le serveur avec redémarrage automatique (nodemon) |
| `npm start` | Démarre le serveur en mode production |

Les variables d’environnement se configurent à partir de `backend/.env.example` (copier vers `backend/.env`).

## Ouvrir le frontend

Le frontend est statique. Ouvrir `frontend/index.html` dans le navigateur, ou servir le dossier avec un serveur local, par exemple :

```bash
cd frontend
npx --yes serve .
```

Puis ouvrir l’URL indiquée (souvent [http://localhost:3000](http://localhost:3000)).

## Étape actuelle

Fondations uniquement :

- structure frontend / backend
- serveur Express
- route `GET /api/health`
- page d’accueil temporaire avec le titre **Elégance Végétal**
