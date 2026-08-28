# 4. Architecture du Projet

Séparation stricte entre frontend et backend, communication via une API REST
(évolutive vers GraphQL si le besoin se présente plus tard).

```
elegance-vegetal/
│
├── frontend/                 # Site client (Next.js recommandé)
│   ├── src/
│   │   ├── app/ (ou pages/)
│   │   ├── components/       # UI réutilisables (Button, Card, etc.)
│   │   ├── features/         # Modules (catalogue, panier, checkout, compte)
│   │   ├── lib/               # Appels API, helpers
│   │   ├── hooks/
│   │   ├── store/             # Gestion d'état (panier, auth)
│   │   └── styles/
│   └── public/
│
├── admin/                     # Panneau admin (application séparée ou route protégée)
│   └── ... (même structure)
│
├── backend/                   # API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── products/
│   │   │   ├── orders/
│   │   │   ├── users/
│   │   │   ├── payments/
│   │   │   ├── delivery/
│   │   │   └── reviews/
│   │   ├── middlewares/
│   │   ├── config/
│   │   └── utils/
│   └── prisma/ (ou migrations DB)
│
└── docs/                       # Documentation technique
```

## Pourquoi séparer l'admin du frontend ?

- Éviter d'exposer du code ou de la logique métier admin dans le bundle public
- Permettre une évolution indépendante des deux applications
- Sécuriser plus facilement l'accès (sous-domaine dédié, ex. `admin.elegance-vegetal.com`)
- Faciliter la maintenance : une équipe ou un développeur peut travailler sur l'admin
  sans risquer de casser le site client
