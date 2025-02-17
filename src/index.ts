import { isMatch } from 'date-fns';
import { Between, In, IsNull, LessThan, LessThanOrEqual, Like, MoreThan, MoreThanOrEqual, Not, Brackets, SelectQueryBuilder } from 'typeorm';

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
}