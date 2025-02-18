import { isMatch } from 'date-fns';
import { Between, In, IsNull, LessThan, LessThanOrEqual, Like, MoreThan, MoreThanOrEqual, Not, Brackets, SelectQueryBuilder } from 'typeorm';
import { DataSource } from 'typeorm';

export interface IOptionsObject {
  LOOKUP_DELIMITER?: string;
  RELATION_DELIMITER?: string;
  EXACT?: string;
  NOT?: string;
  CONTAINS?: string;
  IS_NULL?: string;
  GT?: string;
  GTE?: string;
  LT?: string;
  LTE?: string;
  STARTS_WITH?: string;
  ENDS_WITH?: string;
  IN?: string;
  BETWEEN?: string;
  OR?: string;
  CONDITION_DELIMITER?: string;
  VALUE_DELIMITER?: string;
  DEFAULT_LIMIT?: string;
  GROUP_START?: string;
  GROUP_END?: string;
  AND?: string;
  NESTED_DELIMITER?: string;
}
export interface IQueryTypeOrm {
  select?: string[];
  relations?: string[];
  where?: {};
  order?: {};
  skip?: number;
  take?: number;
  cache?: boolean;
}
export interface IQueryObject {
  select?: string;
  join?: string;
  sort?: string;
  cache?: string;
  limit?: string;
  page?: string;
  filter?: string;
}
interface ILooseObject {
  [key: string]: any;
  [key: number]: any;
}
enum EDateType {
  Date = "yyyy-MM-dd",
  Datetime = "yyyy-MM-dd HH:MM:ss"
}

interface IWhereGroup {
  type: 'AND' | 'OR';
  conditions: (IWhereCondition | IWhereGroup)[];
}

interface IWhereCondition {
  field: string;
  operator: string;
  value: any;
  not?: boolean;
}

export interface IAdvancedQueryObject extends IQueryObject {
  orderNulls?: string; // Format: "field,ASC,NULLS_FIRST;field2,DESC,NULLS_LAST"
  groupBy?: string; // Format: "field1,field2"
  having?: string; // Format: "count > 5;sum > 1000"
  joinType?: string; // Format: "table,LEFT;table2,INNER"
  joinCondition?: string; // Format: "table.field=other.field;table2.field=other.field"
}

export interface IAdvancedOptions extends IOptionsObject {
  NULLS_FIRST?: string;
  NULLS_LAST?: string;
  HAVING_DELIMITER?: string;
  JOIN_TYPE_DELIMITER?: string;
  JOIN_CONDITION_DELIMITER?: string;
}

export class QueryBuilder {
  private options: IOptionsObject;
  constructor(configuration: IOptionsObject = {}) {
    this.options = {
      ...{
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
        NESTED_DELIMITER: '#',
      },
      ...configuration,
    };
  }

  public getOptions() {
    return this.options;
  }
  public build(query: IQueryObject) {
    const output: IQueryTypeOrm = {};
    if (!this.notValid(query.select)) {
      const select = query.select as string;
      output.select = select.split(this.options.VALUE_DELIMITER! as string);
    }
    if (!this.notValid(query.join)) {
      const join = query.join as string;
      output.relations = join.split(this.options.VALUE_DELIMITER! as string);
    }
    if (!this.notValid(query.sort)) {
      output.order = this.createOrderArray(query.sort as string);
    }
    if (!this.notValid(query.cache)) {
      const cache = query.cache as string;
      output.cache = JSON.parse(cache.toLowerCase());
    }
    if (!this.notValid(query.limit)) {
      const limit = parseInt(query.limit as string, 10);
      // if(!limit){
      //     throw new Error('Limit must be a number.');
      // }
      output.take = limit;
    }
    if (!this.notValid(query.page)) {
      const limit = query.limit || (this.options.DEFAULT_LIMIT! as string);
      const limitnum = parseInt(limit, 10);
      output.skip = limitnum * (parseInt(query.page as string, 10) - 1);
      output.take = limitnum;
    }
    if (!this.notValid(query.filter)) {
      output.where = this.createWhere(query.filter as string);
    }

    return output;
  }
  private notValid(value: string | undefined): boolean {
    if (!value) {
      return true;
    }
    return false;
  }

  private createOrderArray(sortString: string): { [key: string]: string } {
    const sortConditions = sortString.split(this.options.CONDITION_DELIMITER!);
    const order: ILooseObject = {};

    sortConditions.forEach(condition => {
      const [key, value] = condition.split(this.options.VALUE_DELIMITER!);
      if (key) {
        order[key] = (value || 'ASC').toUpperCase();
      }
    });
    return order;
  }
  private createWhere(filterString: string): object[] {
    if (!filterString) return [];

    // Handle NOT operator at the start
    let globalNot = false;
    if (filterString.startsWith(this.options.NOT!)) {
      globalNot = true;
      filterString = filterString.slice(this.options.NOT!.length);
    }

    // Handle grouped conditions
    const isGrouped = filterString.startsWith('(') && filterString.endsWith(')');
    if (isGrouped) {
      filterString = filterString.slice(1, -1);
    }

    // Split by OR operator first
    const orGroups = filterString.split(`${this.options.LOOKUP_DELIMITER}${this.options.OR}${this.options.LOOKUP_DELIMITER}`);
    const result: object[] = [];
    let currentObject: ILooseObject = {};

    for (const group of orGroups) {
      // Split conditions within each group
      const conditions = group.split(this.options.CONDITION_DELIMITER!);
      
      for (let condition of conditions) {
        if (!condition.trim()) continue;

        // Handle nested groups
        if (condition.includes('(') && condition.includes(')')) {
          const nestedStart = condition.indexOf('(');
          const nestedEnd = condition.lastIndexOf(')');
          const nestedGroup = condition.slice(nestedStart + 1, nestedEnd);
          
          // Process the nested group
          const nestedResults = this.createWhere(nestedGroup);
          
          // Combine all conditions from nested results into arrays
          for (const nestedObj of nestedResults) {
            Object.entries(nestedObj).forEach(([field, value]) => {
              if (field in currentObject) {
                if (!Array.isArray(currentObject[field])) {
                  currentObject[field] = [currentObject[field]];
                }
                if (Array.isArray(value)) {
                  currentObject[field].push(...value);
                } else {
                  currentObject[field].push(value);
                }
              } else {
                currentObject[field] = value;
              }
            });
          }
          continue;
        }

        const parts = condition.split(this.options.LOOKUP_DELIMITER!);
        if (parts.length < 2) continue;

        const [field, operator, value] = parts;
        if (!field || !operator) continue;

        const isNot = globalNot || operator.startsWith(this.options.NOT!);
        const finalOperator = operator.startsWith(this.options.NOT!) 
          ? operator.slice(this.options.NOT!.length) 
          : operator;

        const cleanField = field.replace(/[()]/g, '').trim();
        const cleanValue = value ? value.replace(/[()]/g, '').trim() : value;

        if (cleanField.includes(this.options.NESTED_DELIMITER!)) {
          // Handle nested fields
          const fieldParts = cleanField.split(this.options.NESTED_DELIMITER!);
          const lastField = fieldParts.pop()!;
          const whereObj = fieldParts.reduceRight(
            (acc, part) => ({ [part]: acc }), 
            this.createWhereObject(lastField, finalOperator, cleanValue, isNot)
          );
          currentObject = this.mergeDeep(currentObject, whereObj);
        } else {
          const whereObj = this.createWhereObject(cleanField, finalOperator, cleanValue, isNot);
          const fieldValue = whereObj[cleanField];

          if (cleanField in currentObject) {
            if (!Array.isArray(currentObject[cleanField])) {
              currentObject[cleanField] = [currentObject[cleanField]];
            }
            currentObject[cleanField].push(fieldValue);
          } else {
            currentObject[cleanField] = fieldValue;
          }
        }
      }
    }

    // Only push the final object if it has properties
    if (Object.keys(currentObject).length > 0) {
      // If we're inside a group, combine conditions
      // If we're at top level and have OR conditions, split into separate objects
      if (isGrouped || orGroups.length === 1) {
        result.push(currentObject);
      } else {
        // Split into separate objects for OR conditions
        Object.entries(currentObject).forEach(([field, value]) => {
          result.push({ [field]: value });
        });
      }
    }

    return result;
  }

  // Add this helper method for deep merging objects
  private mergeDeep(target: any, source: any): any {
    const isObject = (obj: any) => obj && typeof obj === 'object';
    
    if (!isObject(target) || !isObject(source)) {
      return source;
    }

    Object.keys(source).forEach(key => {
      const targetValue = target[key];
      const sourceValue = source[key];

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        target[key] = targetValue.concat(sourceValue);
      } else if (isObject(targetValue) && isObject(sourceValue)) {
        target[key] = this.mergeDeep(Object.assign({}, targetValue), sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });

    return target;
  }

  private handleNestedField(field: string, value: any): any {
    const parts = field.split(this.options.NESTED_DELIMITER!);
    const result: any = {};
    let current = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = {};
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
    return result;
  }

  private createWhereObject(field: string, operator: string, value: string, notOperator: boolean): ILooseObject {
    const obj: ILooseObject = {};
    let finalValue;

    switch (operator) {
      case this.options.EXACT:
        finalValue = value;
        break;
      case this.options.CONTAINS:
        finalValue = Like(`%${value}%`);
        break;
      case this.options.STARTS_WITH:
        finalValue = Like(`${value}%`);
        break;
      case this.options.ENDS_WITH:
        finalValue = Like(`%${value}`);
        break;
      case this.options.IS_NULL:
        finalValue = IsNull();
        break;
      case this.options.GT:
        finalValue = MoreThan(this.parseDateOrNumber(value));
        break;
      case this.options.GTE:
        finalValue = MoreThanOrEqual(this.parseDateOrNumber(value));
        break;
      case this.options.LT:
        finalValue = LessThan(this.parseDateOrNumber(value));
        break;
      case this.options.LTE:
        finalValue = LessThanOrEqual(this.parseDateOrNumber(value));
        break;
      case this.options.IN:
        finalValue = In(value.split(this.options.VALUE_DELIMITER!));
        break;
      case this.options.BETWEEN:
        const [start, end] = value.split(this.options.VALUE_DELIMITER!);
        finalValue = Between(this.parseDateOrNumber(start), this.parseDateOrNumber(end));
        break;
      default:
        finalValue = value;
    }

    obj[field] = notOperator ? Not(finalValue) : finalValue;
    return obj;
  }

  private parseDateOrNumber(value: string): number | string {
    if (isMatch(value, EDateType.Date) || isMatch(value, EDateType.Datetime)) {
      return value;
    }
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  public buildAdvanced(query: IAdvancedQueryObject, alias: string = 'entity', connection: DataSource): SelectQueryBuilder<any> {
    const queryBuilder = connection.createQueryBuilder();
    queryBuilder.from(alias, alias);

    // Handle select fields
    if (!this.notValid(query.select)) {
      const selectFields = (query.select || '').split(this.options.VALUE_DELIMITER!);
      queryBuilder.select(selectFields.map(field => `${alias}.${field}`));
    }

    // Handle joins with type and conditions
    if (!this.notValid(query.join)) {
      const joins = (query.join || '').split(this.options.VALUE_DELIMITER!);
      const joinTypes = query.joinType?.split(this.options.VALUE_DELIMITER!) || [];
      const joinConditions = query.joinCondition?.split(this.options.VALUE_DELIMITER!) || [];

      joins.forEach((join, index) => {
        const joinType = joinTypes[index] || '';
        const type = joinType.trim().toUpperCase();
        const condition = joinConditions[index];

        switch (type) {
          case 'LEFT':
            queryBuilder.leftJoin(join, join, condition || undefined);
            break;
          case 'RIGHT':
            queryBuilder.leftJoin(join, join, condition || undefined); // TypeORM doesn't support RIGHT JOIN, using LEFT as fallback
            break;
          case 'INNER':
            queryBuilder.innerJoin(join, join, condition || undefined);
            break;
          default:
            queryBuilder.leftJoin(join, join, condition || undefined); // Default to LEFT JOIN
        }
      });
    }

    // Handle where conditions
    if (!this.notValid(query.filter)) {
      const whereExpr = this.createAdvancedWhere((query.filter || ''), alias, queryBuilder);
      if (whereExpr) {
        queryBuilder.where(whereExpr);
      }
    }

    // Handle order with NULLS FIRST/LAST
    if (!this.notValid(query.sort)) {
      const orderClauses = (query.sort || '').split(this.options.CONDITION_DELIMITER!);
      const nullsOrder = query.orderNulls?.split(this.options.CONDITION_DELIMITER!);

      orderClauses.forEach((clause, index) => {
        const [field, direction = 'ASC'] = clause.split(this.options.VALUE_DELIMITER!);
        let orderExpr = `${alias}.${field} ${direction}`;

        if (nullsOrder?.[index]) {
          const [, , nullsPosition] = nullsOrder[index].split(this.options.VALUE_DELIMITER!);
          if (nullsPosition === 'NULLS_FIRST') {
            orderExpr += ' NULLS FIRST';
          } else if (nullsPosition === 'NULLS_LAST') {
            orderExpr += ' NULLS LAST';
          }
        }

        queryBuilder.addOrderBy(orderExpr);
      });
    }

    // Handle group by and having
    if (!this.notValid(query.groupBy)) {
      const groupFields = (query.groupBy || '')
        .split(this.options.VALUE_DELIMITER!)
        .map(field => field.trim())
        .filter(field => field);

      if (groupFields.length > 0) {
        const formattedGroupFields = groupFields.map(field => `${alias}.${field}`).join(', ');
        queryBuilder.groupBy(formattedGroupFields);

        if (!this.notValid(query.having)) {
          const havingClauses = (query.having || '').split(this.options.CONDITION_DELIMITER!);
          queryBuilder.having(havingClauses.join(' AND '));
        }
      }
    }

    // Handle pagination
    if (!this.notValid(query.page)) {
      const limit = parseInt(query.limit || this.options.DEFAULT_LIMIT!, 10);
      const page = parseInt(query.page || '1', 10);
      queryBuilder.skip(limit * (page - 1)).take(limit);
    } else if (!this.notValid(query.limit)) {
      queryBuilder.take(parseInt(query.limit || this.options.DEFAULT_LIMIT!, 10));
    }

    // Handle caching
    if (!this.notValid(query.cache)) {
      const cacheEnabled = JSON.parse((query.cache || 'false').toLowerCase());
      if (cacheEnabled) {
        queryBuilder.cache(true, 60000); // Cache for 1 minute by default
      }
    }

    return queryBuilder;
  }

  private createAdvancedWhere(filterString: string, alias: string, qb: SelectQueryBuilder<any>): string {
    if (!filterString) return '';

    // Handle NOT operator at the start
    let globalNot = false;
    if (filterString.startsWith(this.options.NOT!)) {
      globalNot = true;
      filterString = filterString.slice(this.options.NOT!.length);
    }

    // Handle grouped conditions
    const isGrouped = filterString.startsWith('(') && filterString.endsWith(')');
    if (isGrouped) {
      filterString = filterString.slice(1, -1);
    }

    // Split by OR operator first
    const orGroups = filterString.split(`${this.options.LOOKUP_DELIMITER}${this.options.OR}${this.options.LOOKUP_DELIMITER}`);
    const whereExpressions: string[] = [];

    for (const group of orGroups) {
      const conditions = group.split(this.options.CONDITION_DELIMITER!);
      const andExpressions: string[] = [];

      for (const condition of conditions) {
        if (!condition.trim()) continue;

        const parts = condition.split(this.options.LOOKUP_DELIMITER!);
        if (parts.length < 2) continue;

        const [field, operator, value] = parts;
        if (!field || !operator) continue;

        const isNot = globalNot || operator.startsWith(this.options.NOT!);
        const finalOperator = operator.startsWith(this.options.NOT!) 
          ? operator.slice(this.options.NOT!.length) 
          : operator;

        const paramName = `param_${Math.random().toString(36).substr(2, 9)}`;
        let expr = '';

        switch (finalOperator) {
          case this.options.EXACT:
            expr = `${alias}.${field} = :${paramName}`;
            qb.setParameter(paramName, value);
            break;
          case this.options.CONTAINS:
            expr = `${alias}.${field} LIKE :${paramName}`;
            qb.setParameter(paramName, `%${value}%`);
            break;
          case this.options.STARTS_WITH:
            expr = `${alias}.${field} LIKE :${paramName}`;
            qb.setParameter(paramName, `${value}%`);
            break;
          case this.options.ENDS_WITH:
            expr = `${alias}.${field} LIKE :${paramName}`;
            qb.setParameter(paramName, `%${value}`);
            break;
          case this.options.IS_NULL:
            expr = `${alias}.${field} IS NULL`;
            break;
          case this.options.GT:
            expr = `${alias}.${field} > :${paramName}`;
            qb.setParameter(paramName, this.parseDateOrNumber(value));
            break;
          case this.options.GTE:
            expr = `${alias}.${field} >= :${paramName}`;
            qb.setParameter(paramName, this.parseDateOrNumber(value));
            break;
          case this.options.LT:
            expr = `${alias}.${field} < :${paramName}`;
            qb.setParameter(paramName, this.parseDateOrNumber(value));
            break;
          case this.options.LTE:
            expr = `${alias}.${field} <= :${paramName}`;
            qb.setParameter(paramName, this.parseDateOrNumber(value));
            break;
          case this.options.IN:
            expr = `${alias}.${field} IN (:...${paramName})`;
            qb.setParameter(paramName, value.split(this.options.VALUE_DELIMITER!));
            break;
          case this.options.BETWEEN:
            const [start, end] = value.split(this.options.VALUE_DELIMITER!);
            expr = `${alias}.${field} BETWEEN :${paramName}_start AND :${paramName}_end`;
            qb.setParameter(`${paramName}_start`, this.parseDateOrNumber(start));
            qb.setParameter(`${paramName}_end`, this.parseDateOrNumber(end));
            break;
        }

        if (isNot && expr) {
          expr = `NOT (${expr})`;
        }

        if (expr) {
          andExpressions.push(expr);
        }
      }

      if (andExpressions.length > 0) {
        whereExpressions.push(`(${andExpressions.join(' AND ')})`);
      }
    }

    return whereExpressions.join(' OR ');
  }
}