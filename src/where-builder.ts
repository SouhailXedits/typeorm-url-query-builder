import {
  Between,
  In,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  WhereExpressionBuilder,
} from 'typeorm';

import { ILooseObject, IOptionsObject } from './interfaces';
import { createWhereObject, parseDateOrNumber } from './utils';

/**
 * WhereBuilder class responsible for building and handling SQL WHERE conditions
 */
export class WhereBuilder {
  private options: IOptionsObject;

  constructor(options: IOptionsObject) {
    this.options = options;
  }

  /**
   * Parse a filter string into an array of filter objects
   */
  public parseFilterString(filterString: string): object[] {
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

        // Handle all cases of NOT operators to ensure proper SQL generation
        // 1. Explicit NOT_EQUALS operator ($ne)
        if (operator === this.options.NOT_EQUALS) {
          const parsedValue = parseDateOrNumber(value);
          // Force using Not() with explicit marking for special handling
          andGroup[field] = Object.assign(Not(parsedValue), { _requiresNotEquals: true });
          continue;
        } 
          
        // 2. Negated equality operator (!$eq)
        const isNot = operator.startsWith(this.options.NOT!);
        const finalOperator = isNot ? operator.slice(this.options.NOT!.length) : operator;

        if (isNot && finalOperator === this.options.EXACT) {
          const parsedValue = parseDateOrNumber(value);
          // Force using Not() with explicit marking for special handling
          andGroup[field] = Object.assign(Not(parsedValue), { _requiresNotEquals: true });
          continue;
        }

        // Special handling for IS NULL
        if (finalOperator === this.options.IS_NULL) {
          andGroup[field] = isNot ? Not('IS_NULL') : 'IS_NULL';
        } else {
          const whereObj = createWhereObject(field, finalOperator, value, isNot, this.options);
          Object.assign(andGroup, whereObj);
        }
      }

      if (Object.keys(andGroup).length > 0) {
        result.push(andGroup);
      }
    }

    return result;
  }

  /**
   * Apply WHERE conditions to a query builder instance
   */
  public applyWhereConditions(
    qb: WhereExpressionBuilder,
    conditions: { [key: string]: any },
    alias: string,
  ): void {
    let isFirstCondition = true;

    Object.entries(conditions).forEach(([field, value]) => {
      // Special handling for Not operator to ensure proper SQL generation
      // TypeORM has a known issue where Not() objects don't always translate to the 
      // correct SQL operators when used in complex queries via QueryBuilder.
      // Instead of relying on TypeORM to handle the Not operator, we explicitly generate 
      // SQL with the <> operator to ensure consistent behavior for all data types.
      // This fixes a critical issue where TypeORM incorrectly generates = instead of <> 
      // despite using the Not operator in the query, resulting in incorrect query results.
      if (value instanceof Not || (value && typeof value === 'object' && value._requiresNotEquals)) {
        // Extract the actual value from the Not operator
        const notValue = (value as any).value;
        const paramName = `${field.replace(/\./g, '_')}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (field.includes(this.options.RELATION_DELIMITER!)) {
          const parts = field.split(this.options.RELATION_DELIMITER!);
          
          if (parts.length === 2) {
            // Simple relation (e.g., status.name)
            const [relation, subField] = parts;
            const relationAlias = `${alias}__${relation}`;
            
            if (notValue === 'IS_NULL') {
              // Handle IS NOT NULL case
              if (isFirstCondition) {
                qb.where(`${relationAlias}.${subField} IS NOT NULL`);
              } else {
                qb.andWhere(`${relationAlias}.${subField} IS NOT NULL`);
              }
            } else {
              // Use <> operator explicitly
              if (isFirstCondition) {
                qb.where(`${relationAlias}.${subField} <> :${paramName}`, { [paramName]: notValue });
              } else {
                qb.andWhere(`${relationAlias}.${subField} <> :${paramName}`, { [paramName]: notValue });
              }
            }
          } else if (parts.length > 2) {
            // Handle nested relations
            const parentRelation = parts[0];
            const childRelation = parts[1];
            const nestedField = parts[2];
            
            const parentAlias = `${alias}__${parentRelation}`;
            const nestedAlias = `${parentAlias}__${childRelation}`;
            
            if (notValue === 'IS_NULL') {
              // Handle IS NOT NULL case for nested relations
              if (isFirstCondition) {
                qb.where(`${nestedAlias}.${nestedField} IS NOT NULL`);
              } else {
                qb.andWhere(`${nestedAlias}.${nestedField} IS NOT NULL`);
              }
            } else {
              // Use <> operator explicitly for nested relations
              if (isFirstCondition) {
                qb.where(`${nestedAlias}.${nestedField} <> :${paramName}`, { [paramName]: notValue });
              } else {
                qb.andWhere(`${nestedAlias}.${nestedField} <> :${paramName}`, { [paramName]: notValue });
              }
            }
          }
        } else {
          // Handle simple fields with Not operator
          if (notValue === 'IS_NULL') {
            // Handle IS NOT NULL case
            if (isFirstCondition) {
              qb.where(`${alias}.${field} IS NOT NULL`);
            } else {
              qb.andWhere(`${alias}.${field} IS NOT NULL`);
            }
          } else {
            // Use <> operator explicitly
            if (isFirstCondition) {
              qb.where(`${alias}.${field} <> :${paramName}`, { [paramName]: notValue });
            } else {
              qb.andWhere(`${alias}.${field} <> :${paramName}`, { [paramName]: notValue });
            }
          }
        }
        
        isFirstCondition = false;
        return;
      }

      // Continue with existing code for other operators
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

  /**
   * Build a WHERE clause for a specific operator
   */
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
        // Always use <> operator for Not values to ensure proper SQL generation
        return {
          clause: `${alias}.${field} <> :${paramName}`,
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
} 