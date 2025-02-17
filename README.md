# Typeorm-Query-Parser

Typeorm Query Parser is an advanced URL string parser for TypeORM that supports complex filtering, nested relations, and grouped conditions.

## Installation

```sh
$ npm install typeorm-advanced-query-parser
```

## Usage Example

```javascript
import { QueryBuilder } from 'typeorm-advanced-query-parser';

const query = req.query;
const options = {};
const parser = new QueryBuilder(options);
const parsedQuery = parser.build(query);

EntityRepository.find(parsedQuery);
```

## Features

- Advanced filtering with AND/OR conditions
- Nested field filtering
- Grouped conditions
- Support for all common comparison operators
- Pagination and sorting
- Relation joining
- Query result caching

## Documentation

### Available Query Parameters
- [select](#select)
- [sort](#sort)
- [filter](#filter)
- [limit](#limit)
- [page](#page)
- [cache](#cache)
- [join](#join)

### Select
Select specific fields from the database:
```
example.com?select=field1,field2
```

### Sort
Sort results by multiple fields:
```
example.com?sort=field1,ASC;field2,DESC
```
Note: Defaults to ASC if order is not specified

### Filter
Specify conditions for data filtering. Supports complex queries including nested fields, grouped conditions, and AND/OR operations.

Basic filtering:
```
example.com?filter=id||$eq||4
```

Nested field filtering:
```
example.com?filter=user#profile#city||$eq||NewYork
```

Grouped conditions:
```
example.com?filter=(name||$eq||John;age||$gt||25)
```

OR conditions:
```
example.com?filter=name||$eq||John||$or||age||$gt||25
```

### Filter Operators
- `$eq` - Equal
- `$cont` - Contains
- `$isnull` - Is null
- `$gt` - Greater than
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal
- `$starts` - Starts with
- `$ends` - Ends with
- `$in` - In array
- `$between` - Between values
- `!` - Negation prefix (can be used with any operator)

### Limit
Limit the number of returned rows:
```
example.com?limit=10
```
Default: 25

### Page
Enable pagination:
```
example.com?limit=25&page=2
```
Page numbers start from 1

### Cache
Enable/disable query result caching:
```
example.com?cache=true
```
Default: false

### Join
Include related entities:
```
example.com?join=relation1,relation2,relation3.nested
```

## Configuration Options

You can customize the parser behavior by passing options to the QueryBuilder constructor:

```javascript
const options = {
    LOOKUP_DELIMITER: '||',
    RELATION_DELIMITER: '.',
    CONDITION_DELIMITER: ';',
    VALUE_DELIMITER: ',',
    EXACT: '$eq',
    NOT: '!',
    CONTAINS: '$cont',
    IS_NULL: '$isnull',
    GT: '$gt',
    GTE: '$gte',
    LT: '$lt',
    LTE: '$lte',
    STARTS_WITH: '$starts',
    ENDS_WITH: '$ends',
    IN: '$in',
    BETWEEN: '$between',
    OR: '$or',
    DEFAULT_LIMIT: '25',
    GROUP_START: '(',
    GROUP_END: ')',
    AND: '$and',
    NESTED_DELIMITER: '#'
};

const parser = new QueryBuilder(options);
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[MIT](https://choosealicense.com/licenses/mit/)
