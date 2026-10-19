// Store settings the API starts with. The admin can change them later (PATCH /api/settings).

export const DEFAULT_SETTINGS = {
  deliveryFee: 80,
  freeDeliveryMin: 3000,
  store: {
    name: 'Bugasan ni Ali',
    tagline: 'Rice Ordering · Retail & Wholesale',
    address: 'Stall 12, Public Market Rd., Brgy. Poblacion',
    phone: '0917 555 0100',
    hours: 'Mon – Sat, 6:00 AM – 6:00 PM',
    gcash: '0917 555 0100 · Ali M.',
    maya: '0917 555 0100 · Ali M.',
    bank: 'BDO · 0012-3456-7890 · Bugasan ni Ali',
  },
  riders: [
    { name: 'Ben Torres', phone: '0918 555 0155', vehicle: 'Tricycle' },
    { name: 'Jomar Aquino', phone: '0920 555 0166', vehicle: 'Multicab' },
  ],
  categories: ['Premium', 'Regular', 'Specialty', 'Imported'],
};
