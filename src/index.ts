import { isMatch } from 'date-fns';
import {
  Between,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Brackets,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import { DataSource } from 'typeorm';
import {
  FindOptionsSelect,
  FindOptionsSelectByString,
  FindOptionsOrder,
  FindOptionsWhere,
} from 'typeorm';

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
export interface IQueryTypeOrm<T = any> {
  select?: FindOptionsSelect<T> | FindOptionsSelectByString<T>;
  relations?: string[];
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  order?: FindOptionsOrder<T>;
  skip?: number;
  take?: number;
  cache?: boolean;
}
export interface IParserQueryObject {
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
  Date = 'yyyy-MM-dd',
  Datetime = 'yyyy-MM-dd HH:MM:ss',
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

export interface IAdvancedQueryObject extends IParserQueryObject {
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
  public build<T>(query: IParserQueryObject): IQueryTypeOrm<T> {
    const output: IQueryTypeOrm<T> = {};
    if (!this.notValid(query.select)) {
      const select = query.select as string;
      const selectFields = select.split(this.options.VALUE_DELIMITER! as string);
      // Convert array to object format that TypeORM expects
      output.select = selectFields.reduce((acc: any, field: string) => {
        acc[field] = true;
        return acc;
      }, {} as FindOptionsSelect<T>);
    }
    if (!this.notValid(query.join)) {
      const join = query.join as string;
      output.relations = join.split(this.options.VALUE_DELIMITER! as string);
    }
    if (!this.notValid(query.sort)) {
      const orderByObj = this.createOrderArray(query.sort as string);
      // Convert to TypeORM order format - use any to bypass type checking
      const order: any = {};
      Object.entries(orderByObj).forEach(([field, { direction, nulls }]) => {
        if (nulls) {
          // TypeORM supports nulls option in FindOptionsOrder
          order[field] = {
            order: direction,
            nulls: nulls === 'NULLS FIRST' ? 'NULLS FIRST' : 'NULLS LAST',
          };
        } else {
          order[field] = direction;
        }
      });
      output.order = order as FindOptionsOrder<T>;
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
      // Convert the parsed filter to FindOptionsWhere format
      const parsedFilter = this.parseFilterString(query.filter as string);
      output.where = parsedFilter as unknown as FindOptionsWhere<T>[];
    }

    return output;
  }
  private notValid(value: string | undefined): boolean {
    if (!value) {
      return true;
    }
    return false;
  }

  private createOrderArray(sortString: string): {
    [key: string]: { direction: string; nulls?: string };
  } {
    const sortConditions = sortString.split(this.options.CONDITION_DELIMITER!);
    const order: { [key: string]: { direction: string; nulls?: string } } = {};

    sortConditions.forEach((condition) => {
      const parts = condition.split(this.options.VALUE_DELIMITER!);
      if (parts.length > 0 && parts[0]) {
        const key = parts[0];
        const direction = (parts[1] || 'ASC').toUpperCase();

        // Check if NULLS FIRST or NULLS LAST is specified
        let nulls: string | undefined = undefined;
        if (parts.length > 2) {
          const nullsOption = parts[2].toUpperCase();
          if (nullsOption === 'NULLS FIRST' || nullsOption === 'NULLS_FIRST') {
            nulls = 'NULLS FIRST';
          } else if (nullsOption === 'NULLS LAST' || nullsOption === 'NULLS_LAST') {
            nulls = 'NULLS LAST';
          }
        }

        order[key] = { direction, nulls };
      }
    });
    return order;
  }
  private parseFilterString(filterString: string): object[] {
    if (!filterString) return [];

    // Split by OR operator
    const orGroups = filterString.split(
      `${this.options.LOOKUP_DELIMITER}${this.options.OR}${this.options.LOOKUP_DELIMITER}`,
    );
    const result: object[] = [];

    for (const group of orGroups) {
      // Split by AND operator
      const andConditions = group.split(
        `${this.options.LOOKUP_DELIMITER}${this.options.AND}${this.options.LOOKUP_DELIMITER}`,
      );
      const andGroup: { [key: string]: any } = {};

      for (const condition of andConditions) {
        if (!condition.trim()) continue;

        const parts = condition.split(this.options.LOOKUP_DELIMITER!);
        if (parts.length < 2) continue;

        const [field, operator, value] = parts;
        if (!field || !operator) continue;

        const isNot = operator.startsWith(this.options.NOT!);
        const finalOperator = isNot ? operator.slice(this.options.NOT!.length) : operator;

        // Special handling for IS NULL
        if (finalOperator === this.options.IS_NULL) {
          andGroup[field] = 'IS_NULL';
        } else {
          const whereObj = this.createWhereObject(field, finalOperator, value, isNot);
          Object.assign(andGroup, whereObj);
        }
      }

      if (Object.keys(andGroup).length > 0) {
        result.push(andGroup);
      }
    }

    return result;
  }

  private applyWhereConditions(
    qb: WhereExpressionBuilder,
    conditions: { [key: string]: any },
    alias: string,
  ): void {
    let isFirstCondition = true;

    Object.entries(conditions).forEach(([field, value]) => {
      // Check if field contains a relation
      if (field.includes(this.options.RELATION_DELIMITER!)) {
        const parts = field.split(this.options.RELATION_DELIMITER!);

        if (parts.length === 2) {
          // Simple relation (e.g., status.name)
          const [relation, subField] = parts;
          const relationAlias = `${alias}__${relation}`;

          if (value === 'IS_NULL') {
            if (isFirstCondition) {
              qb.where(`${relationAlias}.${subField} IS NULL`);
            } else {
              qb.andWhere(`${relationAlias}.${subField} IS NULL`);
            }
          } else if (typeof value === 'object' && value !== null) {
            // Handle complex operators like In, Between, etc.
            const paramName = `${field.replace(/\./g, '_')}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            const whereClause = this.buildWhereClause(relationAlias, subField, value, paramName);

            if (isFirstCondition) {
              qb.where(whereClause.clause, whereClause.params);
            } else {
              qb.andWhere(whereClause.clause, whereClause.params);
            }
          } else {
            const paramName = `${field.replace(/\./g, '_')}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            if (isFirstCondition) {
              qb.where(`${relationAlias}.${subField} = :${paramName}`, { [paramName]: value });
            } else {
              qb.andWhere(`${relationAlias}.${subField} = :${paramName}`, { [paramName]: value });
            }
          }
        } else if (parts.length > 2) {
          // Nested relation (e.g., status.category.name)
          const parentRelation = parts[0];
          const childRelation = parts[1];
          const nestedField = parts[2]; // The actual field in the nested relation

          const parentAlias = `${alias}__${parentRelation}`;
          const nestedAlias = `${parentAlias}__${childRelation}`;

          if (value === 'IS_NULL') {
            if (isFirstCondition) {
              qb.where(`${nestedAlias}.${nestedField} IS NULL`);
            } else {
              qb.andWhere(`${nestedAlias}.${nestedField} IS NULL`);
            }
          } else if (typeof value === 'object' && value !== null) {
            // Handle complex operators like In, Between, etc.
            const paramName = `${field.replace(/\./g, '_')}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            const whereClause = this.buildWhereClause(nestedAlias, nestedField, value, paramName);

            if (isFirstCondition) {
              qb.where(whereClause.clause, whereClause.params);
            } else {
              qb.andWhere(whereClause.clause, whereClause.params);
            }
          } else {
            const paramName = `${field.replace(/\./g, '_')}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            if (isFirstCondition) {
              qb.where(`${nestedAlias}.${nestedField} = :${paramName}`, { [paramName]: value });
            } else {
              qb.andWhere(`${nestedAlias}.${nestedField} = :${paramName}`, { [paramName]: value });
            }
          }
        }
      } else {
        if (value === 'IS_NULL') {
          if (isFirstCondition) {
            qb.where(`${alias}.${field} IS NULL`);
          } else {
            qb.andWhere(`${alias}.${field} IS NULL`);
          }
        } else if (typeof value === 'object' && value !== null) {
          // Handle complex operators like In, Between, etc.
          const paramName = `${field}_${Math.random().toString(36).substr(2, 9)}`;
          const whereClause = this.buildWhereClause(alias, field, value, paramName);

          if (isFirstCondition) {
            qb.where(whereClause.clause, whereClause.params);
          } else {
            qb.andWhere(whereClause.clause, whereClause.params);
          }
        } else {
          const paramName = `${field}_${Math.random().toString(36).substr(2, 9)}`;
          if (isFirstCondition) {
            qb.where(`${alias}.${field} = :${paramName}`, { [paramName]: value });
          } else {
            qb.andWhere(`${alias}.${field} = :${paramName}`, { [paramName]: value });
          }
        }
      }

      isFirstCondition = false;
    });
  }

  // Helper method to build WHERE clause for complex operators
  private buildWhereClause(
    alias: string,
    field: string,
    value: any,
    paramName: string,
  ): { clause: string; params: any } {
    if (value instanceof In) {
      return {
        clause: `${alias}.${field} IN (:...${paramName})`,
        params: { [paramName]: (value as any).value },
      };
    } else if (value instanceof Between) {
      const betweenValue = (value as any).value;
      return {
        clause: `${alias}.${field} BETWEEN :${paramName}_start AND :${paramName}_end`,
        params: {
          [`${paramName}_start`]: betweenValue[0],
          [`${paramName}_end`]: betweenValue[1],
        },
      };
    } else if (value instanceof Like) {
      return {
        clause: `${alias}.${field} LIKE :${paramName}`,
        params: { [paramName]: (value as any).value },
      };
    } else if (value instanceof MoreThan) {
      return {
        clause: `${alias}.${field} > :${paramName}`,
        params: { [paramName]: (value as any).value },
      };
    } else if (value instanceof MoreThanOrEqual) {
      return {
        clause: `${alias}.${field} >= :${paramName}`,
        params: { [paramName]: (value as any).value },
      };
    } else if (value instanceof LessThan) {
      return {
        clause: `${alias}.${field} < :${paramName}`,
        params: { [paramName]: (value as any).value },
      };
    } else if (value instanceof LessThanOrEqual) {
      return {
        clause: `${alias}.${field} <= :${paramName}`,
        params: { [paramName]: (value as any).value },
      };
    } else if (value instanceof Not) {
      const notValue = (value as any).value;
      if (notValue === 'IS_NULL') {
        return {
          clause: `${alias}.${field} IS NOT NULL`,
          params: {},
        };
      } else {
        return {
          clause: `${alias}.${field} != :${paramName}`,
          params: { [paramName]: notValue },
        };
      }
    } else {
      // Default to equals
      return {
        clause: `${alias}.${field} = :${paramName}`,
        params: { [paramName]: value },
      };
    }
  }

  private createWhere(filterString: string): object[] {
    if (!filterString) return [];

    // Split by OR operator first
    const orGroups = filterString.split(
      `${this.options.LOOKUP_DELIMITER}${this.options.OR}${this.options.LOOKUP_DELIMITER}`,
    );
    const result: object[] = [];

    for (const group of orGroups) {
      // Split by AND operator
      const andConditions = group.split(
        `${this.options.LOOKUP_DELIMITER}${this.options.AND}${this.options.LOOKUP_DELIMITER}`,
      );
      const andGroup: { [key: string]: any } = {};

      for (const condition of andConditions) {
        if (!condition.trim()) continue;

        const parts = condition.split(this.options.LOOKUP_DELIMITER!);
        if (parts.length < 2) continue;

        const [field, operator, value] = parts;
        if (!field || !operator) continue;

        const isNot = operator.startsWith(this.options.NOT!);
        const finalOperator = isNot ? operator.slice(this.options.NOT!.length) : operator;

        const whereObj = this.createWhereObject(field, finalOperator, value, isNot);
        Object.assign(andGroup, whereObj);
      }

      if (Object.keys(andGroup).length > 0) {
        result.push(andGroup);
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

    Object.keys(source).forEach((key) => {
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

  private createWhereObject(
    field: string,
    operator: string,
    value: string,
    notOperator: boolean,
  ): ILooseObject {
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
        finalValue = 'IS_NULL'; // Special marker for IS NULL condition
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

  public buildAdvanced<T>(
    query: IParserQueryObject,
    alias: string,
    queryBuilder: SelectQueryBuilder<T>,
  ): SelectQueryBuilder<T> {
    // Track joined relations to prevent duplicates
    const joinedRelations = new Set<string>();
    // Track selected columns to prevent duplicates
    const selectedColumns = new Set<string>();
    // Track relations with wildcard selectors
    const relationWildcards = new Set<string>();
    // Track nested relations (e.g., status.category)
    const nestedRelations = new Map<string, Set<string>>();

    // Get sort fields that need to be included in select
    const sortFields = new Set<string>();
    if (!this.notValid(query.sort)) {
      const sortConditions = query.sort.split(this.options.CONDITION_DELIMITER!);
      sortConditions.forEach((condition) => {
        const [field] = condition.split(this.options.VALUE_DELIMITER!);
        if (field) {
          sortFields.add(field);
        }
      });
    }

    // First pass: Check for wildcards to determine if we need all fields for any relation
    // Also identify nested relations from select, sort, and filter
    if (!this.notValid(query.select)) {
      this.identifyNestedRelations(query.select, relationWildcards, nestedRelations);
    }

    // Also check for nested relations in filter
    if (!this.notValid(query.filter)) {
      this.identifyNestedRelationsInFilter(query.filter, nestedRelations);
    }

    // Also check for nested relations in sort
    // if (!this.notValid(query.sort)) {
    //   this.identifyNestedRelationsInSort(query.sort, nestedRelations);
    // }

    // Handle select fields
    if (!this.notValid(query.select)) {
      const selectFields = query.select.split(this.options.VALUE_DELIMITER!);

      // First, handle root table selection
      const hasRootWildcard = selectFields.includes('*');

      // Always start with selecting the ID to ensure proper distinct handling
      queryBuilder.select(`${alias}.id`);
      selectedColumns.add(`${alias}.id`);

      if (hasRootWildcard) {
        // Add all fields from the main table
        const fields = [
          'statusCount',
          'priorityCount',
          'assignedCount',
          'markdownDescription',
          'subtaskCount',
          'taskPath',
          'clickupUserEmail',
          'clickupParentId',
          'name',
          'description',
          'estimation',
          'order',
          'priority',
          'startDate',
          'dueDate',
          'parentId',
          'statusId',
          'fileId',
          'ownerId',
          'assigned_to',
          'dependencies',
          'deletedAt',
          'createdAt',
          'updatedAt',
          'importId',
          'clickupId',
        ];

        fields.forEach((field) => {
          const columnRef = `${alias}.${field}`;
          if (!selectedColumns.has(columnRef)) {
            queryBuilder.addSelect(columnRef);
            selectedColumns.add(columnRef);
          }
        });
        sortFields.clear(); // If selecting all fields, no need to add sort fields separately
      }

      // Second pass: Handle relation selections
      selectFields.forEach((field) => {
        if (field === '*') {
          // Already handled above
          return;
        } else if (field.includes(this.options.RELATION_DELIMITER!)) {
          const parts = field.split(this.options.RELATION_DELIMITER!);

          if (parts.length === 2) {
            // Simple relation (e.g., status.name)
            const [relation, subField] = parts;
            const relationAlias = `${alias}__${relation}`;

            // Add join if not already added
            if (!joinedRelations.has(relation)) {
              // If wildcard is used for this relation, use leftJoinAndSelect
              if (relationWildcards.has(relation)) {
                // Use leftJoin instead of leftJoinAndSelect to avoid duplicate columns
                queryBuilder.leftJoin(`${alias}.${relation}`, relationAlias);

                // Manually add all columns from the relation
                // This gives us more control over column aliases
                const relationColumns = this.getEntityColumns(relation);
                relationColumns.forEach((column) => {
                  const columnRef = `${relationAlias}.${column}`;
                  const columnAlias = `${relationAlias}_${column}`;
                  if (!selectedColumns.has(columnRef)) {
                    queryBuilder.addSelect(`${columnRef}`, columnAlias);
                    selectedColumns.add(columnRef);
                  }
                });
              } else {
                queryBuilder.leftJoin(`${alias}.${relation}`, relationAlias);
              }
              joinedRelations.add(relation);
            }

            // Only add specific field selection if not using wildcard for this relation
            if (!relationWildcards.has(relation) && subField && subField !== '*') {
              const columnRef = `${relationAlias}.${subField}`;
              const columnAlias = `${relationAlias}_${subField}`;
              if (!selectedColumns.has(columnRef)) {
                queryBuilder.addSelect(columnRef, columnAlias);
                selectedColumns.add(columnRef);
              }
            }
          } else if (parts.length > 2) {
            // Nested relation (e.g., status.category.name)
            const parentRelation = parts[0];
            const childRelation = parts[1];
            const nestedField = parts.slice(2).join(this.options.RELATION_DELIMITER!);

            // Create aliases for both parent and nested relations
            const parentAlias = `${alias}__${parentRelation}`;
            const nestedAlias = `${parentAlias}__${childRelation}`;

            // Add join for parent relation if not already added
            if (!joinedRelations.has(parentRelation)) {
              queryBuilder.leftJoin(`${alias}.${parentRelation}`, parentAlias);
              joinedRelations.add(parentRelation);
            }

            // Add join for nested relation
            const nestedRelationKey = `${parentAlias}.${childRelation}`;
            if (!joinedRelations.has(nestedRelationKey)) {
              queryBuilder.leftJoin(`${parentAlias}.${childRelation}`, nestedAlias);
              joinedRelations.add(nestedRelationKey);
            }

            // Handle wildcard for nested relation
            const nestedRelationFullKey = `${parentRelation}.${childRelation}`;
            if (nestedField === '*' || relationWildcards.has(nestedRelationFullKey)) {
              // Add all columns from the nested relation
              const nestedColumns = this.getEntityColumns(childRelation);
              nestedColumns.forEach((column) => {
                const columnRef = `${nestedAlias}.${column}`;
                const columnAlias = `${nestedAlias}_${column}`;
                if (!selectedColumns.has(columnRef)) {
                  queryBuilder.addSelect(`${columnRef}`, columnAlias);
                  selectedColumns.add(columnRef);
                }
              });
            } else {
              // Add specific field from nested relation
              const columnRef = `${nestedAlias}.${nestedField}`;
              const columnAlias = `${nestedAlias}_${nestedField}`;
              if (!selectedColumns.has(columnRef)) {
                queryBuilder.addSelect(columnRef, columnAlias);
                selectedColumns.add(columnRef);
              }
            }
          }
        } else if (field !== 'id' && !hasRootWildcard) {
          // Handle non-relation fields only if not using root wildcard
          const columnRef = `${alias}.${field}`;
          if (!selectedColumns.has(columnRef)) {
            queryBuilder.addSelect(columnRef);
            selectedColumns.add(columnRef);
          }
          sortFields.delete(field); // Remove from sortFields if explicitly selected
        }
      });

      // Add any remaining sort fields that weren't explicitly selected
      if (!hasRootWildcard) {
        // Only add sort fields if not using root wildcard
        sortFields.forEach((field) => {
          if (field.includes(this.options.RELATION_DELIMITER!)) {
            const [relation, subField] = field.split(this.options.RELATION_DELIMITER!);
            const relationAlias = `${alias}__${relation}`;

            // Add join if not already added
            if (!joinedRelations.has(relation)) {
              queryBuilder.leftJoin(`${alias}.${relation}`, relationAlias);
              joinedRelations.add(relation);
            }

            const columnRef = `${relationAlias}.${subField}`;
            if (!selectedColumns.has(columnRef)) {
              queryBuilder.addSelect(columnRef);
              selectedColumns.add(columnRef);
            }
          } else {
            const columnRef = `${alias}.${field}`;
            if (!selectedColumns.has(columnRef)) {
              queryBuilder.addSelect(columnRef);
              selectedColumns.add(columnRef);
            }
          }
        });
      }
    } else {
      // If no select specified, select all from main table
      queryBuilder.select(`${alias}.*`);
    }

    // Handle joins for cases where relations are specified in join but not in select
    if (!this.notValid(query.join)) {
      const joins = query.join.split(this.options.VALUE_DELIMITER!);
      joins.forEach((join) => {
        const [relation, joinType = 'left'] = join.split(':');

        // Skip if already joined
        if (joinedRelations.has(relation)) {
          return;
        }

        const relationAlias = `${alias}__${relation}`;

        // Check if this relation is in select with specific fields
        const isInSelect = query.select?.includes(`${relation}.`);
        const hasWildcard = query.select?.includes(`${relation}.*`);

        if (!isInSelect) {
          // If relation is not in select at all, just join it without selecting fields
          if (joinType.toLowerCase() === 'inner') {
            queryBuilder.innerJoin(`${alias}.${relation}`, relationAlias);
          } else {
            queryBuilder.leftJoin(`${alias}.${relation}`, relationAlias);
          }
        } else if (hasWildcard && !relationWildcards.has(relation)) {
          // If relation has wildcard in select but wasn't processed yet
          if (joinType.toLowerCase() === 'inner') {
            queryBuilder.innerJoin(`${alias}.${relation}`, relationAlias);
          } else {
            queryBuilder.leftJoin(`${alias}.${relation}`, relationAlias);
          }

          // Manually add all columns from the relation
          const relationColumns = this.getEntityColumns(relation);
          relationColumns.forEach((column) => {
            const columnRef = `${relationAlias}.${column}`;
            const columnAlias = `${relationAlias}_${column}`;
            if (!selectedColumns.has(columnRef)) {
              queryBuilder.addSelect(`${columnRef}`, columnAlias);
              selectedColumns.add(columnRef);
            }
          });
        }

        joinedRelations.add(relation);

        // Check if we need to join any nested relations for this relation
        if (nestedRelations.has(relation)) {
          const childRelations = nestedRelations.get(relation)!;
          childRelations.forEach((childRelation) => {
            const nestedAlias = `${relationAlias}__${childRelation}`;
            const nestedRelationKey = `${relation}.${childRelation}`;

            if (!joinedRelations.has(nestedRelationKey)) {
              queryBuilder.leftJoin(`${relationAlias}.${childRelation}`, nestedAlias);
              joinedRelations.add(nestedRelationKey);

              // If wildcard is used for this nested relation, select all its fields
              if (relationWildcards.has(nestedRelationKey)) {
                const nestedColumns = this.getEntityColumns(childRelation);
                nestedColumns.forEach((column) => {
                  const columnRef = `${nestedAlias}.${column}`;
                  const columnAlias = `${nestedAlias}_${column}`;
                  if (!selectedColumns.has(columnRef)) {
                    queryBuilder.addSelect(`${columnRef}`, columnAlias);
                    selectedColumns.add(columnRef);
                  }
                });
              }
            }
          });
        }
      });
    }

    // Handle where conditions
    if (!this.notValid(query.filter)) {
      const whereConditions = this.parseFilterString(query.filter);

      if (whereConditions.length > 0) {
        queryBuilder.where(
          new Brackets((qb) => {
            this.applyWhereConditions(qb, whereConditions[0], alias);
          }),
        );

        // Apply OR conditions
        for (let i = 1; i < whereConditions.length; i++) {
          queryBuilder.orWhere(
            new Brackets((qb) => {
              this.applyWhereConditions(qb, whereConditions[i], alias);
            }),
          );
        }
      }
    }

    // Handle sorting
    if (!this.notValid(query.sort)) {
      const orderBy = this.createOrderArray(query.sort);
      Object.entries(orderBy).forEach(([field, { direction, nulls }]) => {
        if (field.includes(this.options.RELATION_DELIMITER!)) {
          const [relation, subField] = field.split(this.options.RELATION_DELIMITER!);
          const relationAlias = `${alias}__${relation}`;
          // Use the column alias instead of the direct column reference
          const columnAlias = `${relationAlias}_${subField}`;

          // Apply the order with NULLS FIRST/LAST if specified
          if (nulls) {
            queryBuilder.orderBy(
              `${columnAlias}`,
              direction as 'ASC' | 'DESC',
              nulls === 'NULLS FIRST' ? 'NULLS FIRST' : 'NULLS LAST',
            );
          } else {
            queryBuilder.orderBy(columnAlias, direction as 'ASC' | 'DESC');
          }
        } else {
          // Apply the order with NULLS FIRST/LAST if specified
          if (nulls) {
            queryBuilder.orderBy(
              `${alias}.${field}`,
              direction as 'ASC' | 'DESC',
              nulls === 'NULLS FIRST' ? 'NULLS FIRST' : 'NULLS LAST',
            );
          } else {
            queryBuilder.orderBy(`${alias}.${field}`, direction as 'ASC' | 'DESC');
          }
        }
      });
    }

    // Handle pagination
    if (!this.notValid(query.limit)) {
      queryBuilder.take(parseInt(query.limit));
    }

    if (!this.notValid(query.page)) {
      const limit = parseInt(query.limit || this.options.DEFAULT_LIMIT!);
      const page = parseInt(query.page);
      queryBuilder.skip(limit * (page - 1));
      queryBuilder.take(limit);
    }

    return queryBuilder;
  }

  // Helper method to get columns for an entity
  private getEntityColumns(entityName: string): string[] {
    // This is a simplified approach - in a real implementation, you would
    // get this information from TypeORM metadata or a schema definition
    const columnMap: { [key: string]: string[] } = {
      status: [
        'id',
        'name',
        'color',
        'order',
        'categoryId',
        'spaceId',
        'fileId',
        'folderId',
        'deletedAt',
        'createdAt',
        'updatedAt',
        'clickupId',
      ],
      owner: [
        'id',
        'jobTitle',
        'centralId',
        'email',
        'firstName',
        'lastName',
        'fullName',
        'username',
        'avatar',
        'birthDate',
        'lastActive',
        'isInvited',
        'deletedAt',
        'createdAt',
        'updatedAt',
      ],
      subtasks: [
        'statusCount',
        'priorityCount',
        'assignedCount',
        'markdownDescription',
        'subtaskCount',
        'taskPath',
        'clickupUserEmail',
        'clickupParentId',
        'id',
        'name',
        'description',
        'estimation',
        'order',
        'priority',
        'startDate',
        'dueDate',
        'parentId',
        'statusId',
        'fileId',
        'ownerId',
        'assigned_to',
        'dependencies',
        'deletedAt',
        'createdAt',
        'updatedAt',
        'importId',
        'clickupId',
      ],
      category: ['id', 'name', 'color', 'order', 'deletedAt', 'createdAt', 'updatedAt'],
      tags: ['id', 'name', 'color', 'deletedAt', 'createdAt', 'updatedAt'],
      file: ['id', 'name', 'size', 'type', 'url', 'deletedAt', 'createdAt', 'updatedAt'],
      timers: ['id', 'start', 'end', 'duration', 'deletedAt', 'createdAt', 'updatedAt'],
      attachments: ['id', 'name', 'size', 'type', 'url', 'deletedAt', 'createdAt', 'updatedAt'],
      comments: ['id', 'text', 'deletedAt', 'createdAt', 'updatedAt'],
      notifications: ['id', 'type', 'deletedAt', 'createdAt', 'updatedAt'],
      customFieldsValues: ['id', 'value', 'deletedAt', 'createdAt', 'updatedAt'],
    };

    return columnMap[entityName] || ['id'];
  }

  // Helper method to identify nested relations in select
  private identifyNestedRelations(
    selectString: string,
    relationWildcards: Set<string>,
    nestedRelations: Map<string, Set<string>>,
  ): void {
    const selectFields = selectString.split(this.options.VALUE_DELIMITER!);
    selectFields.forEach((field) => {
      if (field.includes(this.options.RELATION_DELIMITER!)) {
        const parts = field.split(this.options.RELATION_DELIMITER!);

        if (parts.length === 2) {
          // Simple relation (e.g., status.name)
          const [relation, subField] = parts;
          if (subField === '*') {
            relationWildcards.add(relation);
          }
        } else if (parts.length > 2) {
          // Nested relation (e.g., status.category.name)
          const parentRelation = parts[0];
          const childRelation = parts[1];
          const nestedField = parts.slice(2).join(this.options.RELATION_DELIMITER!);

          // Track the nested relation
          if (!nestedRelations.has(parentRelation)) {
            nestedRelations.set(parentRelation, new Set());
          }
          nestedRelations.get(parentRelation)!.add(childRelation);

          // Handle wildcard for nested relation
          if (nestedField === '*') {
            const nestedRelationKey = `${parentRelation}.${childRelation}`;
            relationWildcards.add(nestedRelationKey);
          }
        }
      }
    });
  }

  // Helper method to identify nested relations in filter
  private identifyNestedRelationsInFilter(
    filterString: string,
    nestedRelations: Map<string, Set<string>>,
  ): void {
    // Split by OR operator
    const orGroups = filterString.split(
      `${this.options.LOOKUP_DELIMITER}${this.options.OR}${this.options.LOOKUP_DELIMITER}`,
    );

    for (const group of orGroups) {
      // Split by AND operator
      const andConditions = group.split(
        `${this.options.LOOKUP_DELIMITER}${this.options.AND}${this.options.LOOKUP_DELIMITER}`,
      );

      for (const condition of andConditions) {
        if (!condition.trim()) continue;

        const parts = condition.split(this.options.LOOKUP_DELIMITER!);
        if (parts.length < 2) continue;

        const [field] = parts;
        if (!field) continue;

        // Check if field contains nested relations
        if (field.includes(this.options.RELATION_DELIMITER!)) {
          const fieldParts = field.split(this.options.RELATION_DELIMITER!);

          if (fieldParts.length > 2) {
            // Nested relation (e.g., status.category.order)
            const parentRelation = fieldParts[0];
            const childRelation = fieldParts[1];

            // Track the nested relation
            if (!nestedRelations.has(parentRelation)) {
              nestedRelations.set(parentRelation, new Set());
            }
            nestedRelations.get(parentRelation)!.add(childRelation);
          }
        }
      }
    }
  }

  // Helper method to identify nested relations in sort
  private identifyNestedRelationsInSort(
    sortString: string,
    nestedRelations: Map<string, Set<string>>,
  ): void {
    const sortConditions = sortString.split(this.options.CONDITION_DELIMITER!);

    sortConditions.forEach((condition) => {
      const [field] = condition.split(this.options.VALUE_DELIMITER!);

      if (field && field.includes(this.options.RELATION_DELIMITER!)) {
        const fieldParts = field.split(this.options.RELATION_DELIMITER!);

        if (fieldParts.length > 2) {
          // Nested relation (e.g., status.category.name)
          const parentRelation = fieldParts[0];
          const childRelation = fieldParts[1];

          // Track the nested relation
          if (!nestedRelations.has(parentRelation)) {
            nestedRelations.set(parentRelation, new Set());
          }
          nestedRelations.get(parentRelation)!.add(childRelation);
        }
      }
    });
  }
}
