# DESCRIPTION

This script generates dynamic templates for mockoon v1.20.0 schema from openapi 3 json file. 

# INSTRUCTIONS
```
Options:
      --help          Shows help                                      [boolean]
      --version       Shows version number                            [boolean]
  -a, --openapi-file  Absolute path to the openapi JSON file. E.g.
                      /home/mypath/openapi.json                      [required]
  -m, --mockoon-file  Absolute path to the mockoon JSON file. E.g.
                      /home/mypath/API_MOCKOON.json                  [required]
  -o, --output-path   Absolute path to the mockoon generated schema. E.g.
                      /home/mypath/schema.json                       [required]
  -n, --nested-level  The nested level of components data. Must be a number
                      between 1 and 4, both included. 2 by default. E.g. 2
```

# COMMAND
mtg

# Github repo
https://github.com/fullstackdeveloperbilbao/mockoon-automatic-templates

# NPM
https://www.npmjs.com/package/mockoon-template-generator