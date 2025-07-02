import { jest } from "@jest/globals";

// A factory for creating a fresh, chainable query builder mock for each test.
const createMockQueryBuilder = () => {
  const builder: any = {};

  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "from",
    "eq",
    "in",
    "is",
    "order",
    "gte",
    "lte",
    "limit",
    "single",
    "maybeSingle",
    "then",
  ];

  methods.forEach((method) => {
    builder[method] = jest.fn((...args: any[]) => {
      // Finalizers should be then-able, returning a promise.
      if (["single", "maybeSingle", "then"].includes(method)) {
        return Promise.resolve({ data: null, error: null });
      }
      // Other methods return the builder to allow chaining.
      return builder;
    });
  });

  // Special handling for 'then' to make queries await-able in tests.
  builder.then = jest.fn((resolve: any) => resolve({ data: [], error: null }));

  return builder;
};

// The createClient function returns a Supabase mock that uses a fresh query builder.
export const createClient = jest.fn(() => {
  const mockQueryBuilder = createMockQueryBuilder();
  return {
    from: jest.fn(() => mockQueryBuilder),
    auth: {
      admin: {
        getUserById: jest.fn<any>().mockResolvedValue({
          data: { user: { email: "test@example.com" } },
          error: null,
        }),
      },
    },
  };
});
