const AWS = require('aws-sdk');
const AWS_ES = require('http-aws-es');
const elasticsearch = require('elasticsearch');
const walkDir = require(`${__dirname}/walkDir`);
const url = require('url');

let client = elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error',
});

if (process.env.NODE_ENV === 'production') {
  es = url.parse(process.env.ELASTICSEARCH_URL)
  client = elasticsearch.Client({
    host: es.host,
    log: 'error',
  });
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create index to store all maps
async function createIndex() {
  const body = {
    settings: {
      analysis: {
        filter: {
          autocomplete_filter: {
            type: 'ngram',
            min_gram: 1,
            max_gram: 20,
          },
        },

        analyzer: {
          autocomplete: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'autocomplete_filter'],
          },
        },
      },
    },

    mappings: {
      map: {
        properties: {
          title: { type: 'string', index: 'not_analyzed' },
          key: { type: 'string', analyzer: 'autocomplete' },
        },
      },
    },
  };

  console.log('creating new index');
  console.log(await client.indices.create({ index: 'maps', body }));
}

// Create map
async function createMap(map, i) {
  const parsedMap = Object.assign({}, map);
  delete parsedMap.id;

  // Set the map key for each search. If there's a tag use that,
  // otherwise use the leftmost topic on the title.
  if (map.tag) {
    parsedMap.key = map.tag;
  } else {
    const splitTitle = map.title.split(' - ');
    parsedMap.key = splitTitle[splitTitle.length - 1];
  }

  const options = {
    id: i,
    index: 'maps',
    type: 'map',
    body: parsedMap,
  };

  console.log(await client.create(options));
  console.log(parsedMap.title, 'added');
}

// Add all maps to index
async function createMaps() {
  const visited = [];
  let id = 0;

  for (let map of walkDir('.')) {
    if (!visited.includes(map.title)) {
      visited.push(map.title);
      map.id = id;
      id += 1;

      if (process.env.NODE_ENV === 'production') {
        await sleep(200);
      }

      await createMap(map, map.id);
    }
  }
}

// Check if the index already exists, if it does delete it; then
// create a new index and load all maps.
async function setup() {
  const indexExists = await client.indices.exists({ index: 'maps' });

  if (indexExists) {
    console.log('deleting old maps');
    console.log(await client.deleteByQuery({
      index: 'maps',
      body: {
        query: {
          match_all: {},
        },
      },
    }));

    console.log('deleting old index');
    console.log(await client.indices.delete({ index: 'maps' }));
  }

  await createIndex();
  await createMaps();
}

setup()
  .then(() => console.log('done'))
  .catch((err) => {
    console.error(err);
    process.exit();
  });
