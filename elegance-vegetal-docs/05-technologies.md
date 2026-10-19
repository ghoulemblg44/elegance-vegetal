# 5. Technologies Recommandées

| Couche | Technologie | Justification |
|---|---|---|
| Frontend | Next.js (React) + TypeScript | SEO (SSR/SSG), performance, responsive facilité |
| Style UI | Tailwind CSS + composants sur-mesure | Design premium cohérent, rapide à maintenir |
| État global | Zustand ou Redux Toolkit (léger) | Gestion du panier, de l'authentification |
| Backend | Node.js (NestJS) ou Express + TypeScript | Structure modulaire, scalable, maintenable |
| Base de données | PostgreSQL | Relationnel, fiable pour commandes et stocks |
| ORM | Prisma | Migrations claires, bonne expérience développeur |
| Authentification | JWT + refresh token, ou NextAuth | Sécurisé, standard de l'industrie |
| Paiement | Stripe (ou CIB/Edahabia pour le marché algérien local) | Fiable, bien documenté |
| Stockage images | Cloudinary ou Amazon S3 | Optimisation des images produits |
| Emailing | Resend ou SendGrid | Notifications de commandes |
| Panneau Admin | Next.js dédié ou React Admin | Construction rapide |
| Déploiement | Vercel (frontend) + Railway/Render/VPS (backend + DB) | Simplicité et scalabilité |
| Tests | Jest + Playwright | Fiabilité à long terme |
