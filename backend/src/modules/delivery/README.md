# Delivery pricing

Single source of truth for delivery tariffs and the weight surcharge.

| File | Role |
|---|---|
| `delivery.config.js` | **Tariff table (as supplied by the owner)**, `ADDITIONAL_TARIFF_TABLE`, weight rule |
| `delivery.wilayas.js` | The 58 wilayas (must equal `frontend/js/wilayas.js` — a test enforces it) |
| `delivery.calculator.js` | Pure functions: tariff lookup, `calculateWeightSurcharge`, `sumWeight`, `calculateDelivery` |
| `delivery.service.js` | `priceOrder()` — reads prices/weights from MongoDB, returns the authoritative quote |

`priceOrder()` is used by **both** `POST /api/delivery/quote` (what checkout displays) and
`POST /api/orders` (what is stored), so the two can never disagree.

```
total = subtotal + deliveryFee (tariff of wilaya + method) + weightSurcharge
weightSurcharge = ceil((totalKg - freeKg) / stepKg) * feePerStep     (0 if totalKg <= freeKg)
```

Defaults: `freeKg = 5`, `stepKg = 5`, `feePerStep = 50`. Override with
`DELIVERY_WEIGHT_FREE_KG`, `DELIVERY_WEIGHT_STEP_KG`, `DELIVERY_WEIGHT_STEP_FEE`.

## Things the owner must still provide

1. **Tariffs for 10 wilayas** absent from the supplied table (49 Timimoun, 50 Bordj Badji Mokhtar,
   51 Ouled Djellal, 52 Béni Abbès, 53 In Salah, 54 In Guezzam, 55 Touggourt, 56 Djanet,
   57 El M'Ghair, 58 El Meniaa). Add rows to `ADDITIONAL_TARIFF_TABLE`. Until then, checkout shows
   "tarif indisponible" and refuses the order — no price is invented.
2. **Product weights** (Admin → Produits → field "Poids unitaire (kg)"). Products without a weight
   add no surcharge; the order is flagged "Poids non renseigné" in Admin. Set
   `DELIVERY_REQUIRE_PRODUCT_WEIGHTS=true` to refuse such orders instead.
3. Confirm with the carrier that the first 5 kg are free and that +50 DA applies to every *started* 5 kg.

## Tests

```bash
cd backend && npm test
```
