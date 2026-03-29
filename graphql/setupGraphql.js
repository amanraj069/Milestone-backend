const setupGraphql = (app) => {
  let createHandler;
  try {
    ({ createHandler } = require("graphql-http/lib/use/express"));
  } catch (error) {
    console.warn(
      "GraphQL is enabled but graphql-http is not installed. Run: npm i graphql graphql-http",
    );
    return;
  }

  const { schema, resolvers } = require("./schema");

  app.all(
    "/graphql",
    createHandler({
      schema,
      rootValue: resolvers,
      context: (req) => ({ req: req?.raw || req }),
    }),
  );

  console.log("GraphQL endpoint enabled at /graphql");
};

module.exports = setupGraphql;
