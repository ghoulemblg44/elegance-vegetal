# 7. Modèle de Données — Élégance Végétal

## Entités principales

### User
| Champ | Type | Notes |
|---|---|---|
| id | UUID | Clé primaire |
| email | string | unique |
| password_hash | string | |
| firstName / lastName | string | |
| phone | string | |
| role | enum | `client`, `admin`, `manager` |
| createdAt / updatedAt | datetime | |

### Address (relation 1-N avec User)
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| userId | UUID | Clé étrangère |
| label | string | ex : "Domicile", "Bureau" |
| fullName | string | destinataire (peut différer du compte, cas des cadeaux) |
| street, city, zipCode, wilaya/pays | string | |
| phone | string | |
| isDefault | boolean | |

### Category
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | ex : "Bouquets", "Plantes vertes" |
| slug | string | unique, pour les URL |
| parentId | UUID nullable | pour les sous-catégories |
| imageUrl | string | |

### Occasion
Table séparée, car un produit peut être associé à plusieurs occasions.
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | Mariage, Deuil, Anniversaire, Saint-Valentin... |

### Product
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | |
| slug | string | |
| description | text | |
| careInstructions | text | conseils d'entretien |
| basePrice | decimal | |
| categoryId | UUID | Clé étrangère |
| isPerishable | boolean | true pour les fleurs et plantes fraîches |
| status | enum | `active`, `draft`, `out_of_stock` |
| createdAt / updatedAt | datetime | |

### ProductVariant
Gère les différentes tailles / formats d'un même produit.
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| productId | UUID | Clé étrangère |
| name | string | ex : "Petit", "Moyen", "Grand" |
| price | decimal | |
| stockQuantity | int | |
| sku | string | |

### ProductImage
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| productId | UUID | Clé étrangère |
| url | string | |
| order | int | ordre d'affichage |

### ProductOccasion (table de liaison N-N)
- productId
- occasionId

### Cart / CartItem
| Champ | Type | Notes |
|---|---|---|
| cart.id | UUID | lié à userId ou sessionId (invité) |
| cartItem.variantId | UUID | |
| cartItem.quantity | int | |
| cartItem.customMessage | string | carte message personnalisée |

### Order
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| userId | UUID nullable | nullable si commande en tant qu'invité |
| status | enum | `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled` |
| deliveryAddressId | UUID | |
| deliverySlot | datetime range | créneau choisi par le client |
| totalAmount | decimal | |
| paymentStatus | enum | `pending`, `paid`, `failed`, `refunded` |
| giftMessage | string | |
| isGift | boolean | |
| createdAt | datetime | |

### OrderItem
| Champ | Type | Notes |
|---|---|---|
| orderId | UUID | |
| variantId | UUID | |
| quantity | int | |
| unitPrice | decimal | prix au moment de la commande (snapshot) |

### Review
| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| productId | UUID | |
| userId | UUID | |
| rating | int (1 à 5) | |
| comment | text | |
| photoUrl | string nullable | |
| status | enum | `pending`, `approved`, `rejected` — modération admin |

### BlogPost (optionnel, phase ultérieure)
| Champ | Type |
|---|---|
| id | UUID |
| title | string |
| slug | string |
| content | text |
| coverImage | string |
| publishedAt | datetime |

## Relations clés à retenir

- **Product → ProductVariant** : essentiel, car un bouquet a souvent plusieurs
  tailles et prix différents.
- **Snapshot des prix dans la commande** : ne jamais recalculer le prix depuis
  `Product` après coup ; toujours stocker `unitPrice` dans `OrderItem` au moment
  de la commande.
- **Gestion du stock périssable** : `stockQuantity` doit pouvoir être mis à jour
  rapidement côté admin, avec des alertes de seuil bas à prévoir dans la logique
  métier du backend (cette logique ne fait pas partie du schéma de données lui-même,
  mais doit être anticipée dès la conception de l'API).
