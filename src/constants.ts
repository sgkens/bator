import { Table, Relation, Endpoint, Middleware } from './types';

export const INITIAL_TABLES: Table[] = [
  {
    id: 'users', name: 'users', color: '#f59e0b',
    x: 40, y: 80,
    fields: [
      { name: 'id', type: 'uuid', pk: true, faker: 'string.uuid' },
      { name: 'email', type: 'varchar', unique: true, faker: 'internet.email' },
      { name: 'name', type: 'varchar', faker: 'person.fullName' },
      { name: 'role', type: 'varchar', faker: 'helpers.arrayElement(["admin", "user", "editor"])' },
      { name: 'avatar_url', type: 'text', faker: 'image.avatar' },
      { name: 'created_at', type: 'timestamp', faker: 'date.recent' },
      { name: 'updated_at', type: 'timestamp', faker: 'date.recent' },
    ]
  },
  {
    id: 'products', name: 'products', color: '#22d3ee',
    x: 380, y: 40,
    fields: [
      { name: 'id', type: 'uuid', pk: true, faker: 'string.uuid' },
      { name: 'category_id', type: 'uuid', fk: 'categories.id' },
      { name: 'name', type: 'varchar', faker: 'commerce.productName' },
      { name: 'slug', type: 'varchar', faker: 'helpers.slugify' },
      { name: 'price', type: 'decimal', faker: 'commerce.price' },
      { name: 'stock', type: 'int', faker: 'number.int' },
      { name: 'description', type: 'text', faker: 'commerce.productDescription' },
      { name: 'created_at', type: 'timestamp' },
      { name: 'updated_at', type: 'timestamp' },
    ]
  }
];

export const INITIAL_RELATIONS: Relation[] = [
  { from: 'categories', fromField: 'id', to: 'products', toField: 'category_id' }
];

export const INITIAL_ENDPOINTS: Endpoint[] = [
  {
    id: '1',
    method: 'GET',
    path: '/api/users',
    latency: 12,
    tableId: 'users',
    tags: ['JWT Required', 'Seeded', 'Paginated']
  },
  {
    id: '2',
    method: 'GET',
    path: '/api/products',
    latency: 22,
    tableId: 'products'
  }
];

export const INITIAL_MIDDLEWARE: Middleware[] = [
  {
    id: 'jwt',
    name: 'JWT Auth',
    description: 'Stateless token verification middleware',
    enabled: true,
    icon: '🔑',
    config: { secret: 'mock_secret_key_dev', algorithm: 'HS256', expiry: '1h' }
  },
  {
    id: 'cors',
    name: 'CORS',
    description: 'Cross-origin resource sharing headers',
    enabled: true,
    icon: '🌐',
    config: { origins: '*', methods: 'GET,POST,PUT,DELETE,PATCH' }
  }
];
