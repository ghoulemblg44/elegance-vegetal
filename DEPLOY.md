# Déployer Élégance Végétal sur Vercel

## Prérequis

1. Compte [Vercel](https://vercel.com) (équipe `devlopement-web`)
2. Base **MongoDB Atlas** (obligatoire — Vercel ne peut pas utiliser MongoDB sur votre PC)

## 1. MongoDB Atlas (une seule fois)

1. Créez un cluster gratuit sur [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Database Access → utilisateur + mot de passe
3. Network Access → `Allow Access from Anywhere` (`0.0.0.0/0`) pour Vercel
4. Connect → Drivers → copiez l’URI `mongodb+srv://...`

## 2. Déployer

Dans ce dossier :

```bash
npx vercel login
npx vercel --prod
```

Liez le projet à votre équipe Vercel quand on vous le demande.

## 3. Variables d’environnement (Vercel → Project → Settings → Environment Variables)

| Nom | Valeur |
|---|---|
| `MONGODB_URI` | URI Atlas `mongodb+srv://...` |
| `JWT_SECRET` | longue chaîne aléatoire |
| `JWT_EXPIRES_IN` | `7d` |

Puis **Redeploy** le projet.

## 4. URLs

- Site : `https://votre-projet.vercel.app`
- Admin : `https://votre-projet.vercel.app/admin/`
- API health : `https://votre-projet.vercel.app/api/health`

## 5. Admin + produits

Après le premier déploiement, créez un admin et peupler les produits (en local pointant vers Atlas, ou via un script one-off) :

```bash
# Dans backend/.env : mettez la même MONGODB_URI Atlas
cd backend
npm run create-admin
npm run seed-products
```
