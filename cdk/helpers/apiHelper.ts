export enum ResolverType {
  Mutation = 'Mutation',
  Query = 'Query',
}

export const getBatchTemplate = (fieldName: string) => {
  return `
  {
    "version" : "2017-02-28",
    "operation": "BatchInvoke",
    "payload": {
      "fieldName": "${fieldName}",
      "source": $utils.toJson($context.source),
      "identity": $util.toJson($context.identity)
    }
  }
  `;
};
