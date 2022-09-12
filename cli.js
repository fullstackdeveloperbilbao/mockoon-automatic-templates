#! /usr/bin/env node

const fs = require('fs');
const yargs = require('yargs/yargs');
const ProgressBar = require('progress');

const Parent = {
  ROOT: 1,
  NESTED_ARRAY: 2,
  NESTED_OBJECT: 3,
};

const StringFormat = {
  DATETIME: 'date-time',
};

const DataType = {
  INTEGER: 'integer',
  STRING: 'string',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
};

var nestingLevelLimit = 2;

const argv = yargs(process.argv.slice(2))
  .option('openapi-file', {
    alias: 'a',
    describe:
      'Absolute path to the openapi JSON file. E.g. /home/mypath/openapi.json',
  })
  .option('mockoon-file', {
    alias: 'm',
    describe:
      'Absolute path to the mockoon JSON file. E.g. /home/mypath/API_MOCKOON.json',
  })
  .option('output-path', {
    alias: 'o',
    describe:
      'Absolute path to the mockoon generated schema. E.g. /home/mypath/schema.json',
  })
  .option('nested-level', {
    alias: 'n',
    describe:
      'The nested level of components data. Must be a number between 1 and 4. E.g. 2',
  })
  .demandOption(
    ['openapi-file', 'mockoon-file', 'output-path'],
    'Please provide openapi-file, mockoon-file and output-path arguments to work with this tool'
  )
  .check((argv, _) => {
    const nl = argv['nested-level'];
    if (nl <= 0 || nl > 4) {
      throw new Error('Nested level must be a number between 1 and 4.');
    } else {
      return true;
    }
  }).argv;

const mnRaw = fs.readFileSync(argv['mockoon-file'], 'utf8');
const oaRaw = fs.readFileSync(argv['openapi-file'], 'utf8');

const mn = JSON.parse(mnRaw);
const oa = JSON.parse(oaRaw);

const mn_routes = mn.routes;
const bar = new ProgressBar('Creating mockoon schema [:bar] :percent :etas', { total: mn_routes.length - 1, width: 50 });

let mnData = {};
for (let i = 0; i < mn_routes.length; i++) {
  bar.tick();
  let mnHelper = {
    endpoint: mn_routes[i].endpoint,
    method: mn_routes[i].method,
  };
  if (mn_routes[i].responses) {
    if (!mnData[mnHelper.endpoint]) mnData[mnHelper.endpoint] = {};
    for (let j = 0; j < mn_routes[i].responses.length; j++) {
      const statusCode = mn_routes[i].responses[j].statusCode;
      const oaMethod =
        oa['paths'][endpointFormatToOpenapi(mnHelper.endpoint)][
          mnHelper.method
        ];
      const oaResponse = oaMethod['responses'][statusCode]['content'];
      if (!!oaResponse) {
        const oaSchema = oaResponse[Object.keys(oaResponse)[0]]['schema'];
        mnData[mnHelper.endpoint][mnHelper.method] = {
          [statusCode]: { body: {} },
        };

        createData(
          oaSchema,
          mnData,
          mnHelper.endpoint,
          mnHelper.method,
          statusCode
        );
      }
    }
  }
}

for (let i = 0; i < mn_routes.length; i++) {
  if (mn_routes[i].responses) {
    const route = mn_routes[i].endpoint;
    const method = mn_routes[i].method;
    for (let j = 0; j < mn_routes[i].responses.length; j++) {
      const statusCode = mn_routes[i].responses[j].statusCode;
      if (mnData[route][method]) {
        mn_routes[i].responses[j].body = JSON.stringify(
          mnData[route][method][statusCode].body,
          undefined,
          2
        );
      }
    }
  }
}

mn.routes = mn_routes;

fs.writeFileSync(
  argv['output-path'],
  JSON.stringify(mn, undefined, 2).replace(/\\\\\\/g, '\\'),
  { encoding: 'utf8' }
);

function getOAComponent(ref) {
  let component = JSON.parse(JSON.stringify(oa));
  for (let i = 0; i < ref.length; i++) {
    component = component[ref[i]];
  }
  return component;
}

function createData(schema, mnData, endpoint, method, statusCode) {
  let body;
  const parent = getParent(mnData, endpoint, method, statusCode);

  if (schema['type'] == DataType.INTEGER) {
    body = generateInteger();
    if (parent == Parent.NESTED_ARRAY) {
      mnData.push(body);
    } else if (parent == Parent.NESTED_OBJECT) {
      mnData[property] = body;
    } else if (parent == Parent.ROOT) {
      mnData[endpoint][method][statusCode].body = body;
    }
  } else if (schema['type'] == DataType.STRING) {
    if (schema['format'] == StringFormat.DATETIME) {
      body = generateDate();
    } else {
      body = generateString(schema['minLength'], schema['maxLength']);
    }
    if (parent == Parent.NESTED_ARRAY) {
      mnData.push(body);
    } else if (parent == Parent.NESTED_OBJECT) {
      mnData[property] = body;
    } else if (parent == Parent.ROOT) {
      mnData[endpoint][method][statusCode].body = body;
    }
  } else if (schema['type'] == DataType.BOOLEAN) {
    body = generateBoolean();
    if (parent == Parent.NESTED_ARRAY) {
      mnData.push(body);
    } else if (parent == Parent.NESTED_OBJECT) {
      mnData[property] = body;
    } else if (parent == Parent.ROOT) {
      mnData[endpoint][method][statusCode].body = body;
    }
  } else if (schema['type'] == DataType.ARRAY) {
    mnData[endpoint][method][statusCode].body = [];
    const nestingLevel = 0;
    generateArray(
      schema['items'],
      mnData[endpoint][method][statusCode].body,
      nestingLevel
    );
  } else if (isComponent(schema['$ref'])) {
    mnData[endpoint][method][statusCode].body = {};
    const nestingLevel = 0;
    generateObject(
      schema['$ref'],
      mnData[endpoint][method][statusCode].body,
      nestingLevel
    );
  }
}

function generateObject(schema, mnData, nestingLevel) {
  const componentRef = schema.substr(2).split('/');
  const component = getOAComponent(componentRef);
  const properties = component['properties'];

  if (argv['nested-level'] != undefined) {
    nestingLevelLimit = argv['nested-level'];
  }

  if (nestingLevel <= nestingLevelLimit) {
    nestingLevel++;
    for (let property in properties) {
      let body;
      if (properties[property]['type'] == DataType.INTEGER) {
        body = generateInteger();
        mnData[property] = body;
      } else if (properties[property]['type'] == DataType.STRING) {
        if (properties[property]['format'] == StringFormat.DATETIME) {
          body = generateDate();
        } else {
          body = generateString(
            properties[property]['minLength'],
            properties[property]['maxLength']
          );
        }
        mnData[property] = body;
      } else if (properties[property]['type'] == DataType.BOOLEAN) {
        body = generateBoolean();
        mnData[property] = body;
      } else if (properties[property]['type'] == DataType.ARRAY) {
        mnData[property] = [];
        generateArray(
          properties[property]['items'],
          mnData[property],
          nestingLevel
        );
      } else if (isComponent(properties[property]['$ref'])) {
        mnData[property] = {};
        generateObject(
          properties[property]['$ref'],
          mnData[property],
          nestingLevel
        );
      }
    }
  }
}

function generateArray(schema, mnData, nestingLevel) {
  const itemsLength = generateRandomNumber(1, 2);

  if (nestingLevel <= nestingLevelLimit) {
    for (let i = 0; i < itemsLength; i++) {
      if (schema['type'] == DataType.INTEGER) {
        body = generateInteger();
        mnData.push(body);
      } else if (schema['type'] == DataType.STRING) {
        if (schema['format'] == StringFormat.DATETIME) {
          body = generateDate();
        } else {
          body = generateString(schema['minLength'], schema['maxLength']);
        }
        mnData.push(body);
      } else if (schema['type'] == DataType.BOOLEAN) {
        body = generateBoolean();
        mnData.push(body);
      } else if (schema['type'] == DataType.ARRAY) {
        mnData.push([]);
        generateArray(
          properties[property]['items'],
          mnData[mnData.length - 1],
          nestingLevel
        );
      } else if (isComponent(schema['$ref'])) {
        mnData.push({});
        generateObject(schema['$ref'], mnData[mnData.length - 1], nestingLevel);
      }
    }
  }
}

function generateDate() {
  let data =
    "{{date '2020-11-20' '2023-11-25' \"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'\"}}";
  return data;
}

function generateString(minLength, maxLength) {
  let data = "{{faker 'random.alpha'";
  if (typeof minLength == 'number' && typeof maxLength == 'number') {
    data += ` ${generateRandomNumber(minLength, maxLength)} }}`;
  } else {
    data += ' 10 }}';
  }
  return data;
}

function generateInteger() {
  return "{{faker 'datatype.number' }}";
}

function generateBoolean() {
  return "{{faker 'datatype.boolean' }}";
}

function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function endpointFormatToOpenapi(endpoint) {
  endpoint = '/' + endpoint.replace(/:[a-zA-Z\d]*/g, replacer);
  return endpoint;
}

function getParent(mnData, endpoint, method, statusCode) {
  if (
    mnData[endpoint] !== undefined &&
    mnData[endpoint][method] !== undefined &&
    mnData[endpoint][method][statusCode] !== undefined
  ) {
    return Parent.ROOT;
  } else if (Object.prototype.toString.call(mnData) == '[object Object]') {
    return Parent.NESTED_OBJECT;
  } else if (Object.prototype.toString.call(mnData) == '[object Array]') {
    return Parent.NESTED_ARRAY;
  }
}

function isComponent(ref) {
  return /#\/components\/schemas/.test(ref);
}

function replacer(str) {
  return '{' + str.substr(1) + '}';
}
