const Querier = require('./querier');

const main = async () => {
  const querier = new Querier({
    uri: 'https://hackerone.com/graphql'
  });

  const response = await querier.queryReports({
    disclosed_at: "2022-09-01T00:00:00.000Z"
  });

  console.log(JSON.stringify(response, null, 2));
  // console.log(response.data.hactivity_items.edges)
}

main()