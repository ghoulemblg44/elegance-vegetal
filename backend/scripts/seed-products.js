require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Product = require('../src/modules/products/product.model');

const CATALOG = [
  {
    slug: 'eternel',
    name: 'Bouquet Éternel',
    category: 'Bouquets',
    price: 8500,
    description: 'Pivoines blush et eucalyptus, composé pour durer plusieurs jours.',
    story:
      "Un bouquet d'atelier aux pivoines blush, relevé d'eucalyptus et de tiges de saison. Préparé le matin même, il tient plusieurs jours dans un vase propre, à l'abri du soleil direct. Idéal pour un anniversaire, un merci, ou simplement pour habiller une table.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — préparé le jour même',
    image: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1400&q=80',
    alt: 'Bouquet de pivoines blush et eucalyptus',
    stock: 15,
  },
  {
    slug: 'champetre',
    name: 'Bouquet Champêtre',
    category: 'Bouquets',
    price: 5800,
    description: 'Fleurs des champs, lumière douce, esprit de jardin au naturel.',
    story:
      "Des fleurs des champs, cueillies pour leur lumière plutôt que pour leur opulence. Le Bouquet Champêtre évoque un jardin en fin de matinée : libre, parfumé, un peu irrégulier. Il se glisse aussi bien dans une cuisine que dans une chambre d'amis.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — préparé le jour même',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1400&q=80',
    alt: 'Bouquet champêtre de fleurs jaunes et blanches',
    stock: 15,
  },
  {
    slug: 'jardin-secret',
    name: 'Jardin Secret',
    category: 'Bouquets',
    price: 7200,
    description: "Roses pâles, feuillage soyeux et un parfum discret d'atelier.",
    story:
      "Roses pâles, feuillage soyeux et un parfum d'atelier tout en retenue. Jardin Secret est pensé comme un geste intime : on l'offre sans bruit, on le pose près d'une fenêtre. Les tiges sont liées à la main, sans architecture trop savante.",
    availability: 'limited',
    availabilityLabel: "Dernières tiges aujourd'hui",
    image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1400&q=80',
    alt: 'Bouquet romantique de roses et feuillage',
    stock: 3,
  },
  {
    slug: 'damas',
    name: 'Roses de Damas',
    category: 'Roses',
    price: 6500,
    description: 'Une botte classique de roses rouges, profondes et veloutées.',
    story:
      "La botte classique, sans détour : des roses rouges profondes, veloutées, choisies pour la densité de leur corolle. Elles arrivent hydratées, prêtes à ouvrir. Un langage floral que l'on comprend en un regard.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — préparé le jour même',
    image: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=1400&q=80',
    alt: 'Botte de roses rouges profondes',
    stock: 15,
  },
  {
    slug: 'epure',
    name: 'Roses Blanches Épure',
    category: 'Roses',
    price: 7800,
    description: "Roses blanches long-stem, d'une simplicité cérémonielle.",
    story:
      "Des roses blanches long-stem, d'une simplicité cérémonielle. Épure convient aux mariages, aux hommages, et à toutes les tables où le silence a sa place. Chaque tige est calibrée pour une ligne nette dans le vase.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — préparé le jour même',
    image: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=1400&q=80',
    alt: 'Bouquet de roses et fleurs blanches',
    stock: 15,
  },
  {
    slug: 'peche',
    name: 'Roses Pêche',
    category: 'Roses',
    price: 5900,
    description: 'Teinte abricot, idéale pour un cadeau tendre ou un merci.',
    story:
      "Une teinte abricot, plus tendre que le rouge, plus vive que le crème. Les Roses Pêche sont le cadeau d'un merci, d'une naissance, d'une visite. Elles s'accordent aux intérieurs clairs et aux nappes de lin.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — préparé le jour même',
    image: 'https://images.unsplash.com/photo-1518621736915-f3b1c707cce5?auto=format&fit=crop&w=1400&q=80',
    alt: 'Roses pêche et feuillage',
    stock: 15,
  },
  {
    slug: 'monstera',
    name: 'Monstera Deliciosa',
    category: 'Plantes',
    price: 4200,
    description: 'Plante graphique, facile à vivre, en pot terracotta.',
    story:
      'Une plante graphique, facile à vivre, livrée en pot terracotta. Le Monstera aime la lumière indirecte et un arrosage mesuré. Notice d’entretien jointe. Il grandit avec la maison, saison après saison.',
    availability: 'in-stock',
    availabilityLabel: 'En stock',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80',
    alt: 'Monstera deliciosa en pot terracotta',
    stock: 15,
  },
  {
    slug: 'orchidee',
    name: 'Orchidée Phalaenopsis',
    category: 'Plantes',
    price: 7500,
    description: 'Floraison longue, silhouette précieuse, pot céramique inclus.',
    story:
      "Floraison longue, silhouette précieuse, pot céramique inclus. L'orchidée Phalaenopsis préfère une pièce lumineuse sans soleil brûlant. Un glaçon une fois par semaine, ou un arrosage léger, suffit souvent.",
    availability: 'limited',
    availabilityLabel: 'Derniers pots en atelier',
    image: 'https://images.unsplash.com/photo-1455659817273-f96807779a8a?auto=format&fit=crop&w=1400&q=80',
    alt: 'Orchidée blanche en pot céramique',
    stock: 3,
  },
  {
    slug: 'ficus',
    name: 'Ficus Lyrata',
    category: 'Plantes',
    price: 6800,
    description: 'Grandes feuilles lyre, présence sculpturale pour le salon.',
    story:
      "Grandes feuilles en forme de lyre, présence sculpturale pour un salon ou un bureau. Le Ficus Lyrata demande de la constance : même place, lumière vive filtrée, pas de courants d'air. Une pièce signature, livrée avec cache-pot.",
    availability: 'made-to-order',
    availabilityLabel: 'Sur commande — 48 h',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1400&q=80',
    alt: 'Plante verte en pot clair',
    stock: 0,
  },
  {
    slug: 'luna',
    name: 'Fleurs séchées Luna',
    category: 'Fleurs séchées',
    price: 3900,
    description: 'Botte durable, tons sable et eucalyptus, sans entretien.',
    story:
      "Une botte durable, tons sable et eucalyptus, sans eau ni entretien. Luna se pose dans un vase sec, à l'abri de l'humidité. Elle traverse les saisons et les déménagements, comme un souvenir végétal.",
    availability: 'in-stock',
    availabilityLabel: 'En stock',
    image: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=1400&q=80',
    alt: 'Botte de fleurs séchées et eucalyptus',
    stock: 15,
  },
  {
    slug: 'avoine',
    name: 'Avoine & Eucalyptus',
    category: 'Fleurs séchées',
    price: 3500,
    description: 'Textures naturelles pour un vase, un mur ou un cadeau durable.',
    story:
      'Avoine, eucalyptus et textures naturelles pour un vase, un mur, ou un cadeau qui ne fane pas. La botte peut se défaire en petites compositions. Un geste sobre, un peu campagnard, très contemporain.',
    availability: 'in-stock',
    availabilityLabel: 'En stock',
    image: 'https://images.unsplash.com/photo-1523694576729-ed1669c1cdc5?auto=format&fit=crop&w=1400&q=80',
    alt: 'Composition de fleurs séchées beiges',
    stock: 15,
  },
  {
    slug: 'neige',
    name: "Neige d'Atelier",
    category: 'Compositions',
    price: 9200,
    description: "Roses blanches et gypsophile, pièce d'apparat pour la table.",
    story:
      "Roses blanches et gypsophile, pièce d'apparat pour une table ou un buffet. Neige d'Atelier est composée dans un contenant stable, prête à poser. Elle habille un dîner, une cérémonie, un hommage, sans effet de surcharge.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — préparé le jour même',
    image: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=1400&q=80',
    alt: 'Composition blanche de roses et gypsophile',
    stock: 15,
  },
  {
    slug: 'hortensia',
    name: 'Composition Hortensia',
    category: 'Compositions',
    price: 10500,
    description: 'Volume généreux, tons poudrés, conçue pour un buffet ou un hall.',
    story:
      "Volume généreux, tons poudrés, conçue pour un buffet, un hall, un mariage. L'hortensia apporte la masse, les roses et le feuillage la précision. Une pièce d'atelier, à livrer de préférence le matin de l'événement.",
    availability: 'made-to-order',
    availabilityLabel: 'Sur commande — 48 h',
    image: 'https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&w=1400&q=80',
    alt: 'Composition florale poudrée dans les mains',
    stock: 0,
  },
  {
    slug: 'valentine',
    name: 'Éclat Saint-Valentin',
    category: 'Cadeaux',
    price: 12000,
    description: 'Bouquet romantique, ruban et carte message offerts.',
    story:
      'Bouquet romantique, ruban et carte message offerts. Éclat Saint-Valentin se livre avec un mot manuscrit si vous le souhaitez, et peut rester anonyme. Un geste clair, généreux, sans besoin d’en dire davantage.',
    availability: 'limited',
    availabilityLabel: 'Dernières pièces pour la saison',
    image: 'https://images.unsplash.com/photo-1455582916367-09f2adc16354?auto=format&fit=crop&w=1400&q=80',
    alt: 'Bouquet romantique de roses et pivoines',
    stock: 3,
  },
  {
    slug: 'douceur',
    name: 'Coffret Douceur',
    category: 'Cadeaux',
    price: 8900,
    description: 'Fleurs, petit vase et un mot manuscrit, prêt à offrir.',
    story:
      "Fleurs, petit vase et un mot manuscrit, le tout prêt à offrir. Le Coffret Douceur évite la course au contenant : tout est pensé pour être déposé tel quel. Un cadeau d'hôtesse, de remerciement, de reconsolation.",
    availability: 'in-stock',
    availabilityLabel: 'En stock — prêt à offrir',
    image: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1400&q=80',
    alt: 'Coffret cadeau floral',
    stock: 15,
  },
  {
    slug: 'panier',
    name: 'Panier Vert',
    category: 'Cadeaux',
    price: 6400,
    description: "Plante d'intérieur, cache-pot tressé et notice d'entretien.",
    story:
      "Une plante d'intérieur, un cache-pot tressé et une notice d'entretien. Le Panier Vert est le cadeau de ceux qui préfèrent quelque chose qui reste. À livrer à domicile ou à retirer à l'atelier d'Hydra.",
    availability: 'in-stock',
    availabilityLabel: 'En stock',
    image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80',
    alt: 'Panier cadeau de plantes vertes',
    stock: 15,
  },
];

const run = async () => {
  await connectDatabase();

  let created = 0;
  let skipped = 0;

  for (const item of CATALOG) {
    const existing = await Product.findOne({
      $or: [{ slug: item.slug }, { name: item.name }],
    });

    if (existing) {
      skipped += 1;
      console.log(`Skipped (already present): ${item.name}`);
      continue;
    }

    await Product.create({
      ...item,
      isActive: true,
    });
    created += 1;
    console.log(`Created: ${item.name}`);
  }

  const total = await Product.countDocuments();
  console.log(`Seed finished. Created ${created}, skipped ${skipped}. MongoDB now has ${total} product(s).`);
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
