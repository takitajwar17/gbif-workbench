// Curated example research prompts that produce rich GBIF results:
// distribution models, range shifts, phenology, invasive species tracking,
// pollinator decline, marine/freshwater, multi-taxa comparisons, multi-country
// studies, seasonality, habitat associations, and temporal trends.
//
// Each entry pairs a short label with a question phrased the way a researcher
// would actually type it. The list is intentionally long — QuestionCard shows
// a random subset and offers a "Show 3 more" button to reshuffle.

export interface DemoPrompt {
  label: string
  question: string
}

export const DEMO_PROMPTS: DemoPrompt[] = [
  // ---- Terrestrial mammals ----
  {
    label: 'Jaguar range in Brazil',
    question: 'Where do jaguars (Panthera onca) currently occur in Brazil, and how has their range changed since 2000?',
  },
  {
    label: 'Lion distribution model',
    question:
      'Can GBIF occurrence records support a species distribution model for Panthera leo across sub-Saharan Africa?',
  },
  {
    label: 'Snow leopard highlands',
    question:
      'What does GBIF tell us about the elevational range and country distribution of snow leopards (Panthera uncia) across Central Asia since 2010?',
  },
  {
    label: 'African elephant tracking',
    question:
      'How are African bush elephant (Loxodonta africana) occurrence records distributed across countries and protected areas from 2000 to 2024?',
  },
  {
    label: 'Tiger habitat corridors',
    question:
      'Use GBIF data to identify remaining habitat corridors for Bengal tigers (Panthera tigris tigris) between India, Nepal, and Bhutan.',
  },
  {
    label: 'Wolf recolonization',
    question:
      'Has the grey wolf (Canis lupus) recolonized its historical range in Western Europe since 2000 according to GBIF occurrence records?',
  },
  {
    label: 'Bear range expansion',
    question:
      'How has brown bear (Ursus arctos) occurrence expanded into new regions of Italy, France, and Spain over the past two decades?',
  },
  {
    label: 'Primate conservation',
    question:
      'What is the distribution of the western gorilla (Gorilla gorilla) on GBIF, and which countries hold the most occurrence records?',
  },

  // ---- Birds ----
  {
    label: 'Kingfisher range shifts',
    question:
      'I want to study climate-driven range shifts of common kingfishers (Alcedo atthis) in Europe from 1990 to 2025.',
  },
  {
    label: 'Migratory shorebirds',
    question:
      'What does GBIF tell us about the seasonal migration timing of bar-tailed godwits (Limosa lapponica) along the East Asian–Australasian Flyway?',
  },
  {
    label: 'Raptor decline',
    question:
      'Are there signs of decline in common buzzard (Buteo buteo) records in the United Kingdom over the last 30 years based on GBIF data?',
  },
  {
    label: 'Owl distribution',
    question:
      'Compare the distribution of tawny owls (Strix aluco) on GBIF across Britain, France, and Germany in the last decade.',
  },
  {
    label: 'Songbird phenology',
    question:
      'Use GBIF records to test whether the breeding phenology of European robins (Erithacus rubecula) has shifted earlier over the past 50 years.',
  },
  {
    label: 'Penguin colonies',
    question:
      'What is the spatial distribution of emperor penguin (Aptenodytes forsteri) colonies in Antarctica according to GBIF, and which datasets contribute the most records?',
  },
  {
    label: 'Hummingbird species richness across the Andes',
    question:
      'How does hummingbird (Trochilidae) species richness vary by country in the Andes according to GBIF occurrence records?',
  },

  // ---- Reptiles & amphibians ----
  {
    label: 'Frog decline in Bangladesh',
    question: 'Can GBIF show whether frog populations are declining in Bangladesh since 2000?',
  },
  {
    label: 'Salamander hotspots',
    question:
      'Where are the GBIF record hotspots for fire salamanders (Salamandra salamandra) in Western Europe, and are records declining locally?',
  },
  {
    label: 'Sea turtle nesting',
    question:
      'What does GBIF tell us about sea turtle nesting occurrences along the Mediterranean coast, and which countries report the most records?',
  },
  {
    label: 'Chytrid risk zones',
    question:
      'Use GBIF amphibian occurrence records to identify regions at potential risk from chytrid fungus (Batrachochytrium dendrobatidis) exposure.',
  },

  // ---- Insects & pollinators ----
  {
    label: 'Bee decline',
    question:
      'Can GBIF occurrence records document long-term declines in bumblebee (Bombus) species across Europe since 1990?',
  },
  {
    label: 'Butterfly range shifts',
    question:
      'Have common European butterflies (e.g., Papilio machaon, Vanessa cardui) shifted their ranges northward since 2000 according to GBIF?',
  },
  {
    label: 'Pollinator richness',
    question:
      'How does wild pollinator (bees, hoverflies, butterflies) species richness vary across agricultural landscapes in France according to GBIF?',
  },
  {
    label: 'Dragonfly climate',
    question:
      'Use GBIF occurrence data to assess whether dragonfly (Odonata) distributions are tracking climate warming in Northern Europe.',
  },
  {
    label: 'Firefly observations',
    question:
      'What is the distribution of common fireflies (Lampyris noctiluca) on GBIF in Europe, and how many records are citizen-science derived?',
  },

  // ---- Marine & freshwater ----
  {
    label: 'Coral reef fish across the Indo-Pacific',
    question:
      'What does GBIF tell us about the geographic distribution and habitat associations of coral reef fish in the Indo-Pacific?',
  },
  {
    label: 'Whale migration',
    question:
      'Use GBIF occurrence records to map the seasonal migration of humpback whales (Megaptera novaeangliae) along the East Australian coast.',
  },
  {
    label: 'Shark bycatch',
    question:
      'Which countries report the most blue shark (Prionace glauca) occurrence records on GBIF, and what temporal coverage is available?',
  },
  {
    label: 'Freshwater mussels',
    question:
      'What is the distribution of freshwater mussels (Unionidae) on GBIF in North America, and are records declining since 2000?',
  },
  {
    label: 'Seabird hotspots',
    question:
      'Identify the GBIF record hotspots for northern gannet (Morus bassanus) colonies across the North Atlantic.',
  },

  // ---- Plants & fungi ----
  {
    label: 'European beech flowering shifts',
    question:
      'Use GBIF plant occurrence records to study shifts in European beech (Fagus sylvatica) flowering phenology over the last 40 years.',
  },
  {
    label: 'Invasive plants',
    question:
      'Can GBIF document the invasion spread of Japanese knotweed (Reynoutria japonica) across Europe since 2000?',
  },
  {
    label: 'Orchid hotspots',
    question:
      'Where are the GBIF record hotspots for wild orchids (Orchidaceae) in tropical Africa, and which datasets contribute the most records?',
  },
  {
    label: 'Porcini fruiting-season trends',
    question:
      'What does GBIF tell us about fruiting-season trends in common porcini mushrooms (Boletus edulis) across Europe?',
  },
  {
    label: 'Urban flora',
    question:
      'How does urban-rural plant species richness differ across German cities according to GBIF occurrence records?',
  },

  // ---- Multi-taxon / biome-scale ----
  {
    label: 'Amazon biodiversity',
    question:
      'What is the distribution and richness of mammals, birds, and amphibians on GBIF across the Amazon basin since 2010?',
  },
  {
    label: 'African savanna',
    question:
      'Use GBIF occurrence records to compare large mammal distributions between the Serengeti and the Maasai Mara ecosystems.',
  },
  {
    label: 'Coral triangle',
    question:
      'What does GBIF tell us about reef-fish and coral species richness across the Coral Triangle region?',
  },
  {
    label: 'Boreal tree northward shifts',
    question:
      'Can GBIF records detect northward shifts of boreal tree species in Canada and Russia over the past three decades?',
  },
  {
    label: 'Island biogeography',
    question:
      'Use GBIF occurrence records to study the relationship between island area and species richness for birds in the Canary Islands.',
  },

  // ---- Habitats, threats, conservation ----
  {
    label: 'Protected area coverage',
    question:
      'How well are GBIF occurrence records for African elephants (Loxodonta africana) distributed inside versus outside protected areas?',
  },
  {
    label: 'Deforestation signals',
    question:
      'Does the GBIF record density for forest-dependent birds decline in newly deforested regions of Brazil since 2010?',
  },
  {
    label: 'Citizen science trends',
    question:
      'What share of European bird occurrence records on GBIF comes from citizen-science platforms like iNaturalist and eBird?',
  },
  {
    label: 'Bias assessment',
    question:
      'Use GBIF to assess geographic and temporal sampling bias in mammal occurrence records across the Global South.',
  },
]

/**
 * Returns `count` prompts chosen uniformly at random, without repeats.
 * Fisher–Yates partial shuffle on a copy of the list.
 */
export function pickRandomPrompts(count = 3): DemoPrompt[] {
  const pool = DEMO_PROMPTS.slice()
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(0, n)
}