export type SeedOption = {
  name: string
  priceDelta?: number
  isDefault?: boolean
}

export type SeedOptionGroup = {
  name: string
  type: 'single' | 'multiple'
  required: boolean
  options: SeedOption[]
}

export type SeedDish = {
  name: string
  slug: string
  description: string
  price: number
  section: string
  isPopular?: boolean
  calories?: number
  allergens?: string[]
  optionGroups?: SeedOptionGroup[]
  /** Key into seeded media map */
  imageKey?: string
}

export type SeedRestaurant = {
  name: string
  slug: string
  description: string
  cuisines: string[]
  categorySlugs: string[]
  rating: number
  ratingCount: number
  prepTimeMinMinutes: number
  prepTimeMaxMinutes: number
  deliveryFee: number
  minOrder: number
  freeDeliveryThreshold?: number
  address: string
  location: [number, number] // [lng, lat] for Payload point
  closesAt: string
  sortOrder: number
  imageKey?: string
  ownerEmail: string
  ownerName: string
  dishes: SeedDish[]
}

export type SeedCategory = {
  title: string
  slug: string
  backgroundColor: string
  sortOrder: number
  imageKey?: string
  /** Nest under another seeded category slug (must already exist / be listed earlier). */
  parentSlug?: string
}

export type SeedBanner = {
  title: string
  subtitle: string
  categorySlug: string
  sortOrder: number
  imageKey?: string
}

export const seedCategories: SeedCategory[] = [
  { backgroundColor: '#FFE7D3', title: 'Offers', slug: 'offers', sortOrder: 1, imageKey: 'cat-offers' },
  { backgroundColor: '#FFEBD1', title: 'Pizza', slug: 'pizza', sortOrder: 2, imageKey: 'cat-pizza' },
  {
    backgroundColor: '#FFF1CC',
    title: 'Burgers',
    slug: 'burgers',
    sortOrder: 3,
    imageKey: 'cat-burgers',
  },
  { backgroundColor: '#FFE1E6', title: 'Sushi', slug: 'sushi', sortOrder: 4, imageKey: 'cat-sushi' },
  {
    backgroundColor: '#FBE2EF',
    title: 'Desserts',
    slug: 'desserts',
    sortOrder: 5,
    imageKey: 'cat-desserts',
  },
  {
    backgroundColor: '#DFF3E4',
    title: 'Healthy',
    slug: 'healthy',
    sortOrder: 6,
    imageKey: 'cat-healthy',
  },
  { backgroundColor: '#DDEEFB', title: 'Drinks', slug: 'drinks', sortOrder: 7, imageKey: 'cat-drinks' },
  // Nested examples (home strip typically shows roots only; these nest under parents)
  {
    backgroundColor: '#FFEBD1',
    parentSlug: 'pizza',
    sortOrder: 1,
    title: 'Vegetarian Pizza',
    slug: 'vegetarian-pizza',
  },
  {
    backgroundColor: '#FFF1CC',
    parentSlug: 'burgers',
    sortOrder: 1,
    title: 'Chicken Burgers',
    slug: 'chicken-burgers',
  },
]

export const seedBanners: SeedBanner[] = [
  {
    categorySlug: 'burgers',
    imageKey: 'banner-1',
    sortOrder: 1,
    subtitle: 'Order now',
    title: '20% off selected comfort favourites',
  },
  {
    categorySlug: 'offers',
    imageKey: 'banner-2',
    sortOrder: 2,
    subtitle: 'On orders over $15',
    title: 'Free delivery this weekend',
  },
  {
    categorySlug: 'sushi',
    imageKey: 'banner-3',
    sortOrder: 3,
    subtitle: 'Limited time',
    title: '$5 off your next order',
  },
]

export const seedRestaurants: SeedRestaurant[] = [
  {
    address: '3 Hoe Street, London E17',
    categorySlugs: ['pizza', 'offers'],
    closesAt: '22:30',
    cuisines: ['Italian', 'Pizza', 'Pasta'],
    deliveryFee: 490,
    description: 'Wood-fired pizza and fresh pasta, made to order by the Rossi family.',
    dishes: [
      {
        description: 'Slow-cooked pancetta, egg yolk and pecorino',
        imageKey: 'dish-pasta',
        isPopular: true,
        name: 'Spaghetti Carbonara',
        price: 649,
        section: 'Popular',
        slug: 'spaghetti-carbonara',
      },
      {
        allergens: ['Milk', 'Gluten'],
        calories: 680,
        description:
          'San Marzano tomato sauce, fior di latte mozzarella, fresh basil and extra virgin olive oil.',
        imageKey: 'dish-pasta',
        isPopular: true,
        name: 'Classic Margherita',
        optionGroups: [
          {
            name: 'Choose size',
            options: [
              { isDefault: true, name: 'Regular (10")', priceDelta: 0 },
              { name: 'Large (12")', priceDelta: 120 },
              { name: 'Extra Large (14")', priceDelta: 220 },
            ],
            required: true,
            type: 'single',
          },
          {
            name: 'Add extras',
            options: [
              { name: 'Extra Mozzarella', priceDelta: 100 },
              { name: 'Rocket', priceDelta: 80 },
              { name: 'Cherry Tomatoes', priceDelta: 80 },
            ],
            required: false,
            type: 'multiple',
          },
          {
            name: 'Remove',
            options: [{ name: 'No Cheese' }, { name: 'No Basil' }],
            required: false,
            type: 'multiple',
          },
        ],
        price: 429,
        section: 'Popular',
        slug: 'classic-margherita',
      },
      {
        description: 'Chilli, garlic and tomato with a slow simmer',
        name: 'Penne Arrabbiata',
        price: 549,
        section: 'Mains',
        slug: 'penne-arrabbiata',
      },
      {
        description: 'With garlic butter',
        name: 'Garlic Bread',
        price: 349,
        section: 'Sides',
        slug: 'garlic-bread',
      },
      {
        description: '330ml',
        name: 'Coca-Cola',
        price: 150,
        section: 'Drinks',
        slug: 'coca-cola',
      },
    ],
    imageKey: 'dish-pasta',
    location: [-0.0197, 51.5836],
    minOrder: 800,
    name: 'Bella Italia',
    ownerEmail: 'owner.bella@example.com',
    ownerName: 'Sofia Rossi',
    prepTimeMaxMinutes: 35,
    prepTimeMinMinutes: 25,
    rating: 4.6,
    ratingCount: 812,
    slug: 'bella-italia',
    sortOrder: 1,
  },
  {
    address: '18 Blackhorse Lane, London E17',
    categorySlugs: ['burgers', 'offers'],
    closesAt: '23:00',
    cuisines: ['Burgers', 'American'],
    deliveryFee: 490,
    description: 'Smashed patties, brioche buns and proper chips.',
    dishes: [
      {
        allergens: ['Milk', 'Gluten', 'Sesame'],
        calories: 940,
        description: 'Double patty, cheddar, pickles and house sauce in a brioche bun.',
        imageKey: 'dish-burger',
        isPopular: true,
        name: 'Double Cheeseburger',
        optionGroups: [
          {
            name: 'Choose your side',
            options: [
              { isDefault: true, name: 'Skin-on fries', priceDelta: 0 },
              { name: 'Sweet potato fries', priceDelta: 150 },
              { name: 'House salad', priceDelta: 100 },
            ],
            required: true,
            type: 'single',
          },
          {
            name: 'Add extras',
            options: [
              { name: 'Extra patty', priceDelta: 250 },
              { name: 'Bacon', priceDelta: 150 },
              { name: 'Jalapeños', priceDelta: 70 },
            ],
            required: false,
            type: 'multiple',
          },
          {
            name: 'Remove',
            options: [{ name: 'No pickles' }, { name: 'No sauce' }],
            required: false,
            type: 'multiple',
          },
        ],
        price: 899,
        section: 'Popular',
        slug: 'double-cheeseburger',
      },
      {
        description: 'Buttermilk chicken, slaw, chipotle mayo',
        imageKey: 'dish-burger',
        isPopular: true,
        name: 'Crispy Chicken Burger',
        price: 799,
        section: 'Popular',
        slug: 'crispy-chicken-burger',
      },
      {
        description: 'Skin-on, rosemary salt',
        name: 'Loaded Fries',
        price: 399,
        section: 'Sides',
        slug: 'loaded-fries',
      },
      {
        description: 'Vanilla or chocolate',
        name: 'Milkshake',
        price: 449,
        section: 'Drinks',
        slug: 'milkshake',
      },
    ],
    imageKey: 'dish-burger',
    location: [-0.041, 51.5871],
    minOrder: 1000,
    name: 'Grill House',
    ownerEmail: 'owner.grill@example.com',
    ownerName: 'Marcus Cole',
    prepTimeMaxMinutes: 30,
    prepTimeMinMinutes: 20,
    rating: 4.7,
    ratingCount: 642,
    slug: 'grill-house',
    sortOrder: 2,
  },
]

/** Remote placeholder images used when local RSAP assets are unavailable. */
export const remoteMediaUrls: Record<string, string> = {
  'banner-1':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/website/src/endpoints/seed/image-hero1.webp',
  'banner-2':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/tshirt-black.png',
  'banner-3':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/tshirt-white.png',
  'cat-burgers':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'cat-desserts':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'cat-drinks':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'cat-healthy':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'cat-offers':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'cat-pizza':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'cat-sushi':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/hat-logo.png',
  'dish-burger':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/tshirt-black.png',
  'dish-pasta':
    'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/ecommerce/src/endpoints/seed/tshirt-white.png',
  hero: 'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/3.x/templates/website/src/endpoints/seed/image-hero1.webp',
}
