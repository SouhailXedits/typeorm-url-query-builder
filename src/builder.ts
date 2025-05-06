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
  ObjectLiteral,
  FindOptionsOrder,
} from 'typeorm';
import { 
  IOptionsObject, 
  IQueryTypeOrm, 
  IParserQueryObject, 
  ILooseObject,
  EDateType
} from './interfaces';
import { createWhereObject, isValidParam, parseDateOrNumber, getEntityColumns } from './utils';
import { IWhereBuilder, createWhereBuilder } from './where-builder-type';

export class QueryBuilder {
  private options: IOptionsObject;
  private whereBuilder: IWhereBuilder;

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
        NOT_EQUALS: '$ne',
      },
      ...configuration,
    };
    
    this.whereBuilder = createWhereBuilder(this.options);
  }

  public getOptions(): IOptionsObject {
    return this.options;
  }

  public build<T>(query: IParserQueryObject): IQueryTypeOrm<T> {
    const output: IQueryTypeOrm<T> = {};
    if (!isValidParam(query.select)) {
      const select = query.select as string;
      const selectFields = select.split(this.options.VALUE_DELIMITER! as string);
      // Convert array to object format that TypeORM expects
      output.select = selectFields.reduce((acc: any, field: string) => {
        acc[field] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }
    if (!isValidParam(query.join)) {
      const join = query.join as string;
      output.relations = join.split(this.options.VALUE_DELIMITER! as string);
    }
    if (!isValidParam(query.sort)) {
      const sortConditions = (query.sort as string).split(this.options.CONDITION_DELIMITER!);
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
      output.order = order as unknown as FindOptionsOrder<T>;
    }
    if (!isValidParam(query.cache)) {
      const cache = query.cache as string;
      output.cache = JSON.parse(cache.toLowerCase());
    }
    if (!isValidParam(query.limit)) {
      const limit = parseInt(query.limit as string, 10);
      output.take = limit;
    }
    if (!isValidParam(query.page)) {
      const limit = query.limit || (this.options.DEFAULT_LIMIT! as string);
      const limitnum = parseInt(limit, 10);
      output.skip = limitnum * (parseInt(query.page as string, 10) - 1);
      output.take = limitnum;
    }
    if (!isValidParam(query.filter)) {
      // Convert the parsed filter to FindOptionsWhere format
      const parsedFilter = this.whereBuilder.parseFilterString(query.filter as string);
      output.where = parsedFilter as unknown as Record<string, any>[];
    }

    return output;
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

  public buildAdvanced<T extends ObjectLiteral>(
    query: IParserQueryObject,
    alias: string,
    queryBuilder: SelectQueryBuilder<T>,
  ): SelectQueryBuilder<T> {
    // Ensure query is initialized
    query = query || {};
    
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
    if (query.sort) {
      const sortConditions = query.sort.split(this.options.CONDITION_DELIMITER!);
      sortConditions.forEach((condition) => {
        if (condition) {
          const parts = condition.split(this.options.VALUE_DELIMITER!);
          const field = parts[0];
          if (field) {
            sortFields.add(field);
          }
        }
      });
    }

    // First pass: Check for wildcards to determine if we need all fields for any relation
    // Also identify nested relations from select, sort, and filter
    if (query.select) {
      this.identifyNestedRelations(query.select, relationWildcards, nestedRelations);
    }

    // Also check for nested relations in filter
    if (query.filter) {
      this.identifyNestedRelationsInFilter(query.filter, nestedRelations);
    }

    // Handle select fields
    if (query.select) {
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
        if (!field) return;
        
        if (field === '*') {
          // Already handled above
          return;
        } else if (field.includes(this.options.RELATION_DELIMITER!)) {
          const parts = field.split(this.options.RELATION_DELIMITER!);

          if (parts.length === 2) {
            // Simple relation (e.g., status.name)
            const [relation, subField] = parts;
            if (!relation) return;
            
            const relationAlias = `${alias}__${relation}`;

            // Add join if not already added
            if (!joinedRelations.has(relation)) {
              // If wildcard is used for this relation, use leftJoinAndSelect
              if (relationWildcards.has(relation)) {
                // Use leftJoin instead of leftJoinAndSelect to avoid duplicate columns
                queryBuilder.leftJoin(`${alias}.${relation}`, relationAlias);

                // Manually add all columns from the relation
                // This gives us more control over column aliases
                const relationColumns = getEntityColumns(relation);
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
            if (!parentRelation || !childRelation) return;
            
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
              const nestedColumns = getEntityColumns(childRelation);
              nestedColumns.forEach((column) => {
                const columnRef = `${nestedAlias}.${column}`;
                const columnAlias = `${nestedAlias}_${column}`;
                if (!selectedColumns.has(columnRef)) {
                  queryBuilder.addSelect(`${columnRef}`, columnAlias);
                  selectedColumns.add(columnRef);
                }
              });
            } else if (nestedField) {
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
          if (!field) return;
          
          if (field.includes(this.options.RELATION_DELIMITER!)) {
            const parts = field.split(this.options.RELATION_DELIMITER!);
            if (parts.length < 2) return;
            
            const [relation, subField] = parts;
            if (!relation || !subField) return;
            
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
    if (query.join) {
      const joins = query.join.split(this.options.VALUE_DELIMITER!);
      joins.forEach((join) => {
        if (!join) return;
        
        const [relation, joinType = 'left'] = join.split(':');
        if (!relation) return;

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
          const relationColumns = getEntityColumns(relation);
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
            if (!childRelation) return;
            
            const nestedAlias = `${relationAlias}__${childRelation}`;
            const nestedRelationKey = `${relation}.${childRelation}`;

            if (!joinedRelations.has(nestedRelationKey)) {
              queryBuilder.leftJoin(`${relationAlias}.${childRelation}`, nestedAlias);
              joinedRelations.add(nestedRelationKey);

              // If wildcard is used for this nested relation, select all its fields
              if (relationWildcards.has(nestedRelationKey)) {
                const nestedColumns = getEntityColumns(childRelation);
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
    if (query.filter) {
      const whereConditions = this.whereBuilder.parseFilterString(query.filter);

      if (whereConditions.length > 0) {
        queryBuilder.where(
          new Brackets((qb) => {
            this.whereBuilder.applyWhereConditions(qb, whereConditions[0], alias);
          }),
        );

        // Apply OR conditions
        for (let i = 1; i < whereConditions.length; i++) {
          queryBuilder.orWhere(
            new Brackets((qb) => {
              this.whereBuilder.applyWhereConditions(qb, whereConditions[i], alias);
            }),
          );
        }
      }
    }

    // Handle sorting
    if (query.sort) {
      const orderBy = this.createOrderArray(query.sort);
      Object.entries(orderBy).forEach(([field, { direction, nulls }]) => {
        if (!field) return;
        
        if (field.includes(this.options.RELATION_DELIMITER!)) {
          const parts = field.split(this.options.RELATION_DELIMITER!);
          if (parts.length < 2) return;
          
          const [relation, subField] = parts;
          if (!relation || !subField) return;
          
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
    if (query.limit) {
      queryBuilder.take(parseInt(query.limit));
    } else if (this.options.DEFAULT_LIMIT) {
      queryBuilder.take(parseInt(this.options.DEFAULT_LIMIT));
    }

    if (query.page) {
      const limit = query.limit ? parseInt(query.limit) : 
        (this.options.DEFAULT_LIMIT ? parseInt(this.options.DEFAULT_LIMIT) : 25);
      const page = parseInt(query.page);
      queryBuilder.skip(limit * (page - 1));
      queryBuilder.take(limit);
    }

    return queryBuilder;
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
} 